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
import { invalidateRankingsCache } from "@/lib/cache/invalidation.service";
import { writeRankingsStaticCache } from "@/lib/cache/rankings-static-cache";
import { type RankingData, RankingsRepository } from "@/lib/db/repositories/rankings.repository";
import { loggers } from "@/lib/logger";
// #256: readers and the static-file writer accept bare-array and wrapped snapshots.
import { isUnreadableSnapshot, snapshotDocument } from "@/lib/rankings/snapshot-rows";
// #93: build and preview run the cron's pipeline in draft / dry-run mode (V6 retired).
import {
  RANKING_ALGORITHM_VERSION,
  RankingGenerationInProgressError,
  RankingPeriodIsCurrentError,
  regenerateRankings,
} from "@/lib/services/ranking-generation.service";
import { buildPreviewComparison, previewRankings, snapshotRows } from "@/lib/services/ranking-preview.service";

/**
 * The current row as the `{ rankings: [...] }` object that `public/data/rankings.json`
 * and the static cache hold (the shape their readers take), marked `is_current` (#256).
 */
function currentSnapshotDocument(row: RankingData): Record<string, unknown> {
  return snapshotDocument(
    row.data,
    {
      period: row.period,
      algorithm_version: row.algorithm_version,
      generated_at: (row.published_at ?? row.created_at).toISOString(),
    },
    { is_current: true }
  );
}

/** 409 for a stored snapshot whose rows cannot be read; nothing is written (#256). */
function unreadableSnapshot(period: string): NextResponse {
  return NextResponse.json(
    { error: `Stored rankings for period ${period} have no readable rows; nothing was written` },
    { status: 409 }
  );
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
          tool_count: snapshotRows(ranking.data).length, // #256
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
          const allData = allRankings.map((ranking) => {
            // #256: bare rows carry `score` as well (RankingEntry); no rows means no scores.
            const rows = snapshotRows(ranking.data);
            return {
              period: ranking.period,
              rankings: rows.length,
              has_scores: rows.length > 0 && rows.every((r) => r["score"] !== undefined),
              algorithm_version: ranking.algorithm_version,
            };
          });

          return NextResponse.json({ periods: allData });
        }

        const data = await rankingsRepo.getByPeriod(period);
        if (!data) {
          return NextResponse.json(
            { error: `No data found for period ${period}` },
            { status: 404 }
          );
        }

        // #256: read rows from either stored shape.
        const rows = snapshotRows(data.data);
        return NextResponse.json({
          period,
          tool_count: rows.length,
          algorithm_version: data.algorithm_version,
          generated_at: data.data?.generated_at || data.created_at.toISOString(),
          sample_rankings: rows.slice(0, 5),
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
          rankings: snapshotRows(ranking.data), // #256
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
        // #93: scored by the cron's engine in dry-run mode; writes nothing.
        const { period, preview_date, compare_with } = body;

        if (!period) {
          return NextResponse.json({ error: "Period parameter is required" }, { status: 400 });
        }

        const rankingsRepo = new RankingsRepository();

        // Get comparison period
        let comparisonPeriod = compare_with;
        let currentRankings: unknown = [];

        if (compare_with === "auto" || !compare_with) {
          const availableRankings = await rankingsRepo.findAll();
          for (const ranking of availableRankings) {
            if (ranking.period < period) {
              comparisonPeriod = ranking.period;
              // #93: read both stored shapes (cron rows are a bare array).
              currentRankings = snapshotRows(ranking.data);
              break;
            }
          }
        } else if (comparisonPeriod && comparisonPeriod !== "none") {
          const periodData = await rankingsRepo.getByPeriod(comparisonPeriod);
          if (periodData) {
            currentRankings = snapshotRows(periodData.data);
          }
        }

        const entries = await previewRankings({
          period,
          ...(preview_date ? { previewDate: new Date(preview_date) } : {}),
        });

        return NextResponse.json({
          success: true,
          preview: {
            period,
            // #93: the engine that scored the preview, not a request echo.
            algorithm_version: RANKING_ALGORITHM_VERSION,
            total_tools: entries.length,
            rankings_comparison: buildPreviewComparison(entries, currentRankings),
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

        // #93: admin build never publishes. dry_run writes nothing; otherwise a
        // non-current draft row is written. Publishing stays with set-current.
        let result: Awaited<ReturnType<typeof regenerateRankings>>;
        try {
          result = await regenerateRankings({ period, mode: dry_run ? "dry-run" : "draft" });
        } catch (error) {
          if (error instanceof RankingPeriodIsCurrentError || error instanceof RankingGenerationInProgressError) {
            return NextResponse.json({ error: error.message }, { status: 409 });
          }
          throw error;
        }
        const rankings = result.entries;

        if (dry_run) {
          return NextResponse.json({
            success: true,
            dry_run: true,
            period,
            rankings: rankings.slice(0, 10),
            total: rankings.length,
          });
        }

        const rankingData = {
          period,
          algorithm_version: result.algorithmVersion,
          generated_at: result.publishedAt,
          rankings,
        };

        // Also update public rankings.json if this is the current period
        const rankingsRepo = new RankingsRepository();
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

        // #354: purge once the write commits; a throwing setAsCurrent never reaches here.
        const purge = await invalidateRankingsCache();
        if (!purge.success) {
          loggers.api.error("Set-current committed but the rankings cache purge failed", {
            period,
            errors: purge.errors,
          });
        }

        // #256: write `{ rankings: [...] }`, never a bare array spread into numeric keys.
        const publicPath = join(process.cwd(), "public", "data", "rankings.json");
        writeFileSync(publicPath, JSON.stringify(currentSnapshotDocument(data), null, 2));

        return NextResponse.json({
          success: true,
          message: `Set ${period} as current ranking period`,
          // #354: a failed purge is reported, never an error for a committed write.
          cache_purge: { success: purge.success, errors: purge.errors },
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
        let algorithmVersion = "v6.0";
        if (copy_from) {
          // Copy from existing period
          const sourceData = await rankingsRepo.getByPeriod(copy_from);
          if (!sourceData) {
            return NextResponse.json(
              { error: `Source period ${copy_from} not found` },
              { status: 404 }
            );
          }
          // #256: copy the rows of either stored shape and keep the source's engine version.
          algorithmVersion = sourceData.algorithm_version || algorithmVersion;
          rankingData = {
            ...snapshotDocument(sourceData.data, { algorithm_version: sourceData.algorithm_version }),
            period,
            generated_at: new Date().toISOString(),
          };
        } else {
          // Create empty period
          rankingData = {
            period,
            algorithm_version: "v6.0",
            generated_at: new Date().toISOString(),
            rankings: [],
          };
        }

        await rankingsRepo.create({
          period,
          algorithm_version: algorithmVersion,
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
              // #256: refuse data with no readable rows rather than publish [].
              if (isUnreadableSnapshot(latestRanking.data)) return unreadableSnapshot(latestRanking.period);
              await rankingsRepo.setAsCurrent(latestRanking.id);

              // #256: write `{ rankings: [...] }`, never a bare array spread into numeric keys.
              const document = currentSnapshotDocument(latestRanking);
              const publicPath = join(process.cwd(), "public", "data", "rankings.json");
              writeFileSync(publicPath, JSON.stringify(document, null, 2));
              writeRankingsStaticCache(document);

              return NextResponse.json({
                success: true,
                message: `Synced rankings from period ${latestRanking.period}`,
                period: latestRanking.period,
                rankings_count: (document["rankings"] as unknown[]).length,
              });
            }
          }
          return NextResponse.json({ error: "No rankings data found" }, { status: 404 });
        }

        // #256: refuse data with no readable rows rather than publish [].
        if (isUnreadableSnapshot(currentData.data)) return unreadableSnapshot(currentData.period);

        // #256: write `{ rankings: [...] }`, never a bare array spread into numeric keys.
        const document = currentSnapshotDocument(currentData);
        const publicPath = join(process.cwd(), "public", "data", "rankings.json");
        writeFileSync(publicPath, JSON.stringify(document, null, 2));
        writeRankingsStaticCache(document);

        return NextResponse.json({
          success: true,
          message: `Synced current rankings from period ${currentData.period}`,
          period: currentData.period,
          rankings_count: (document["rankings"] as unknown[]).length,
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
