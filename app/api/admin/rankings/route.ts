/**
 * Consolidated Admin Rankings Management API
 *
 * Endpoints:
 * - GET: List periods, check data, get progress
 * - POST: Preview, build, set current, create period
 * - DELETE: Delete ranking period
 * - PUT: Update or sync rankings
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { writeRankingsStaticCache } from "@/lib/cache/rankings-static-cache";
import { RankingsRepository } from "@/lib/db/repositories/rankings.repository";
import { ToolsRepository } from "@/lib/db/repositories/tools.repository";
import { loggers } from "@/lib/logger";
import { ALGORITHM_VERSION } from "@/lib/ranking-algorithm-v76";
// Canonical scoring path (#93): the build/preview actions below now score
// tools with the SAME pure `computeRankings()` core that `regenerateRankings()`
// uses for the live cron/CLI path (RankingEngineV76), so admin previews can
// never diverge from what a real regeneration would produce.
//
// This route deliberately does NOT call `regenerateRankings()` itself: that
// function's persistence contract always deletes any existing snapshot for
// the target period and flips `is_current = true` for whatever it saves.
// Admin "build" must be able to stage/update a non-live period without ever
// touching the live pointer (that is what the separate "set-current" action
// is for), so persistence stays local to this route via `RankingsRepository`,
// exactly as it did before this migration — only the SCORING engine changed.
import {
  buildPreviousRankMap,
  computeRankings,
  RANKING_ALGORITHM_VERSION,
  type RankingSourceTool,
} from "@/lib/services/ranking-generation.service";

/**
 * Adapt a `ToolsRepository` row into the shape `computeRankings()` expects.
 *
 * `ToolsRepository.findByStatus()` returns the raw `tools.data` JSONB spread
 * onto the row (see `mapDbToolToData`), which is structurally equivalent to
 * the `row.data` object `regenerateRankings()`'s own persistence adapter reads
 * directly from Drizzle — so passing the whole row through as `data` here
 * reproduces the exact same `info`/`metrics` shape the canonical engine
 * expects (including the top-level-vs-nested `metrics` canonicalization).
 */
function toRankingSourceTool(tool: {
  id: string;
  name: string;
  slug: string;
  category: string;
  status: string;
  [key: string]: unknown;
}): RankingSourceTool {
  return {
    id: tool.id,
    name: tool.name,
    slug: tool.slug,
    category: tool.category,
    status: tool.status,
    data: tool as unknown as Record<string, unknown>,
  };
}

/** Map the canonical engine's camelCase factor keys to the admin route's long-standing snake_case response contract. */
function toSnakeCaseFactorScores(factorScores: Record<string, number>) {
  return {
    agentic_capability: factorScores["agenticCapability"] ?? 0,
    innovation: factorScores["innovation"] ?? 0,
    technical_performance: factorScores["technicalPerformance"] ?? 0,
    developer_adoption: factorScores["developerAdoption"] ?? 0,
    market_traction: factorScores["marketTraction"] ?? 0,
    business_sentiment: factorScores["businessSentiment"] ?? 0,
    development_velocity: factorScores["developmentVelocity"] ?? 0,
    platform_resilience: factorScores["platformResilience"] ?? 0,
  };
}

/**
 * GET /api/admin/rankings
 */
export async function GET(request: NextRequest) {
  // Check admin authentication
  const authResult = await requireAdmin();
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "periods";
    const rankingsRepo = new RankingsRepository();

    switch (action) {
      case "periods": {
        // List all ranking periods
        const allRankings = await rankingsRepo.findAll();
        const periodData = allRankings.map((ranking) => ({
          period: ranking.period,
          tool_count: ranking.data?.rankings?.length || 0,
          algorithm_version: ranking.algorithm_version,
          generated_at: ranking.data?.generated_at || ranking.created_at.toISOString(),
          is_current: ranking.is_current,
        }));

        return NextResponse.json({
          periods: periodData,
          total: periodData.length,
        });
      }

      case "check-data": {
        // Check rankings data integrity
        const period = searchParams.get("period");

        if (!period) {
          const allRankings = await rankingsRepo.findAll();
          const allData = allRankings.map((ranking) => ({
            period: ranking.period,
            rankings: ranking.data?.rankings?.length || 0,
            has_scores: ranking.data?.rankings?.every((r: any) => r.score !== undefined) || false,
            algorithm_version: ranking.algorithm_version,
          }));

          return NextResponse.json({ periods: allData });
        }

        const data = await rankingsRepo.getByPeriod(period);
        if (!data) {
          return NextResponse.json(
            { error: `No data found for period ${period}` },
            { status: 404 }
          );
        }

        return NextResponse.json({
          period,
          tool_count: data.data?.rankings?.length || 0,
          algorithm_version: data.algorithm_version,
          generated_at: data.data?.generated_at || data.created_at.toISOString(),
          sample_rankings: data.data?.rankings?.slice(0, 5) || [],
        });
      }

      case "progress": {
        // Get ranking generation progress
        // This would typically track async job progress
        return NextResponse.json({
          status: "idle",
          progress: 0,
          message: "No ranking generation in progress",
        });
      }

      case "all": {
        // Get all rankings data
        const allRankings = await rankingsRepo.findAll();
        const formattedRankings = allRankings.map((ranking) => ({
          period: ranking.period,
          rankings: ranking.data?.rankings || [],
          metadata: {
            algorithm_version: ranking.algorithm_version,
            generated_at: ranking.data?.generated_at || ranking.created_at.toISOString(),
            is_current: ranking.is_current,
          },
        }));

        return NextResponse.json({
          periods: formattedRankings,
          total_periods: formattedRankings.length,
        });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    loggers.api.error("Error in admin/rankings GET", { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/admin/rankings
 */
export async function POST(request: NextRequest) {
  // Check admin authentication
  const authResult = await requireAdmin();
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "preview": {
        // Preview rankings
        const { period, algorithm_version = ALGORITHM_VERSION, preview_date, compare_with } = body;

        if (!period) {
          return NextResponse.json({ error: "Period parameter is required" }, { status: 400 });
        }

        const toolsRepo = new ToolsRepository();
        const rankingsRepo = new RankingsRepository();

        // Get comparison period
        let comparisonPeriod = compare_with;
        let currentRankings: any[] = [];

        if (compare_with === "auto" || !compare_with) {
          const availableRankings = await rankingsRepo.findAll();
          for (const ranking of availableRankings) {
            if (ranking.period < period) {
              comparisonPeriod = ranking.period;
              currentRankings = ranking.data?.rankings || [];
              break;
            }
          }
        } else if (comparisonPeriod && comparisonPeriod !== "none") {
          const periodData = await rankingsRepo.getByPeriod(comparisonPeriod);
          if (periodData) {
            currentRankings = periodData.data?.rankings || [];
          }
        }

        // Fetch tools
        let tools = await toolsRepo.findByStatus("active");

        // Filter by preview date if provided
        if (preview_date) {
          const cutoffDate = new Date(preview_date);
          tools = tools.filter((tool) => {
            const launchDate = tool["launch_date"];
            const createdAt = tool["created_at"];
            const dateValue = launchDate || createdAt || new Date();
            const toolDate = new Date(dateValue as string | number | Date);
            return toolDate <= cutoffDate;
          });
        }

        // Score with the canonical V7.6 engine (same pure core as
        // `regenerateRankings()`) and rank against the comparison snapshot.
        const referenceDate = preview_date ? new Date(preview_date) : new Date(period);
        const sourceTools = tools.map(toRankingSourceTool);
        const previousRankMap = buildPreviousRankMap({ rankings: currentRankings });
        const scored = computeRankings(sourceTools, previousRankMap, referenceDate);

        // Generate comparison data
        const currentRankingsMap = new Map(currentRankings.map((r) => [r.tool_id, r]));

        const comparisons = scored.map((entry) => {
          const currentRanking = currentRankingsMap.get(entry.tool_id);
          const previousPosition = entry.movement.previous_position;

          return {
            tool_id: entry.tool_id,
            tool_name: entry.tool_name,
            category: entry.category || "",
            current_rank: entry.rank,
            current_score: entry.score,
            previous_rank: previousPosition ?? undefined,
            previous_score: currentRanking?.score,
            rank_change: entry.movement.change,
            score_change: currentRanking ? entry.score - currentRanking.score : entry.score,
            movement: previousPosition == null ? "new" : entry.movement.direction,
          };
        });

        return NextResponse.json({
          success: true,
          preview: {
            period,
            algorithm_version,
            total_tools: scored.length,
            rankings_comparison: comparisons,
            comparison_period: comparisonPeriod,
          },
        });
      }

      case "build": {
        // Build and save rankings
        const { period, dry_run = false } = body;

        if (!period) {
          return NextResponse.json({ error: "Period is required" }, { status: 400 });
        }

        const toolsRepo = new ToolsRepository();
        const rankingsRepo = new RankingsRepository();

        const tools = await toolsRepo.findByStatus("active");

        // Score with the canonical V7.6 engine (same pure core as
        // `regenerateRankings()`). No comparison snapshot for "build" — it
        // never computed movement historically, only position/score.
        const sourceTools = tools.map(toRankingSourceTool);
        const scored = computeRankings(sourceTools, new Map(), new Date(period));

        const rankings = scored.map((entry) => ({
          position: entry.rank,
          tool_id: entry.tool_id,
          tool_name: entry.tool_name,
          tool_slug: entry.tool_slug,
          score: entry.score,
          factor_scores: toSnakeCaseFactorScores(entry.factor_scores),
        }));

        if (dry_run) {
          return NextResponse.json({
            success: true,
            dry_run: true,
            period,
            rankings: rankings.slice(0, 10),
            total: rankings.length,
          });
        }

        // Save rankings to database
        const rankingData = {
          period,
          algorithm_version: RANKING_ALGORITHM_VERSION,
          generated_at: new Date().toISOString(),
          rankings,
        };

        // Check if period exists
        const existing = await rankingsRepo.getByPeriod(period);
        if (existing) {
          await rankingsRepo.update(existing.id, {
            data: rankingData,
            algorithm_version: RANKING_ALGORITHM_VERSION,
          });
        } else {
          await rankingsRepo.create({
            period,
            algorithm_version: RANKING_ALGORITHM_VERSION,
            is_current: false,
            data: rankingData,
          });
        }

        // Also update public rankings.json if this is the current period
        const currentRanking = await rankingsRepo.getCurrentRankings();
        if (currentRanking && currentRanking.period === period) {
          const publicPath = join(process.cwd(), "public", "data", "rankings.json");
          writeFileSync(publicPath, JSON.stringify(rankingData, null, 2));
        }

        return NextResponse.json({
          success: true,
          period,
          rankings_count: rankings.length,
          message: "Rankings built and saved successfully",
        });
      }

      case "set-current": {
        // Set current ranking period
        const { period } = body;

        if (!period) {
          return NextResponse.json({ error: "Period is required" }, { status: 400 });
        }

        const rankingsRepo = new RankingsRepository();
        const data = await rankingsRepo.getByPeriod(period);

        if (!data) {
          return NextResponse.json(
            { error: `No rankings found for period ${period}` },
            { status: 404 }
          );
        }

        // Set as current
        await rankingsRepo.setAsCurrent(data.id);

        // Update public rankings.json
        const publicPath = join(process.cwd(), "public", "data", "rankings.json");
        writeFileSync(
          publicPath,
          JSON.stringify(
            {
              ...data.data,
              is_current: true,
            },
            null,
            2
          )
        );

        return NextResponse.json({
          success: true,
          message: `Set ${period} as current ranking period`,
        });
      }

      case "create-period": {
        // Create new ranking period
        const { period, copy_from } = body;

        if (!period) {
          return NextResponse.json({ error: "Period is required" }, { status: 400 });
        }

        const rankingsRepo = new RankingsRepository();

        // Check if period already exists
        const existing = await rankingsRepo.getByPeriod(period);
        if (existing) {
          return NextResponse.json({ error: `Period ${period} already exists` }, { status: 400 });
        }

        let rankingData: any;
        if (copy_from) {
          // Copy from existing period
          const sourceData = await rankingsRepo.getByPeriod(copy_from);
          if (!sourceData) {
            return NextResponse.json(
              { error: `Source period ${copy_from} not found` },
              { status: 404 }
            );
          }
          rankingData = {
            ...sourceData.data,
            period,
            generated_at: new Date().toISOString(),
          };
        } else {
          // Create empty period
          rankingData = {
            period,
            algorithm_version: RANKING_ALGORITHM_VERSION,
            generated_at: new Date().toISOString(),
            rankings: [],
          };
        }

        await rankingsRepo.create({
          period,
          algorithm_version: rankingData.algorithm_version || RANKING_ALGORITHM_VERSION,
          is_current: false,
          data: rankingData,
        });

        return NextResponse.json({
          success: true,
          message: `Created ranking period ${period}`,
          period,
          copied_from: copy_from || null,
        });
      }

      case "sync-current": {
        // Sync current rankings
        const rankingsRepo = new RankingsRepository();
        const currentData = await rankingsRepo.getCurrentRankings();

        if (!currentData) {
          // Use most recent period as fallback
          const allRankings = await rankingsRepo.findAll();
          if (allRankings.length > 0) {
            const latestRanking = allRankings[0];
            if (latestRanking) {
              await rankingsRepo.setAsCurrent(latestRanking.id);

              // Update public files
              const publicPath = join(process.cwd(), "public", "data", "rankings.json");
              writeFileSync(
                publicPath,
                JSON.stringify(
                  {
                    ...latestRanking?.data,
                    is_current: true,
                  },
                  null,
                  2
                )
              );

              writeRankingsStaticCache({
                ...latestRanking?.data,
                is_current: true,
              });

              return NextResponse.json({
                success: true,
                message: `Synced rankings from period ${latestRanking?.period}`,
                period: latestRanking?.period,
                rankings_count: latestRanking?.data?.rankings?.length || 0,
              });
            }
          }
          return NextResponse.json({ error: "No rankings data found" }, { status: 404 });
        }

        // Update public files
        const publicPath = join(process.cwd(), "public", "data", "rankings.json");
        writeFileSync(
          publicPath,
          JSON.stringify(
            {
              ...currentData.data,
              is_current: true,
            },
            null,
            2
          )
        );

        writeRankingsStaticCache({
          ...currentData.data,
          is_current: true,
        });

        return NextResponse.json({
          success: true,
          message: `Synced current rankings from period ${currentData.period}`,
          period: currentData.period,
          rankings_count: currentData.data?.rankings?.length || 0,
        });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    loggers.api.error("Error in admin/rankings POST", { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/rankings
 */
export async function DELETE(request: NextRequest) {
  // Check admin authentication
  const authResult = await requireAdmin();
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period");

    if (!period) {
      return NextResponse.json({ error: "Period is required" }, { status: 400 });
    }

    const rankingsRepo = new RankingsRepository();
    const data = await rankingsRepo.getByPeriod(period);

    if (!data) {
      return NextResponse.json({ error: `Period ${period} not found` }, { status: 404 });
    }

    if (data.is_current) {
      return NextResponse.json({ error: "Cannot delete current ranking period" }, { status: 400 });
    }

    // Delete from database
    // Note: RankingsRepository doesn't have a delete method yet
    // For now, we'll just return an error
    return NextResponse.json(
      { error: "Delete operation not yet implemented in database" },
      { status: 501 }
    );
  } catch (error) {
    loggers.api.error("Error in admin/rankings DELETE", { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
