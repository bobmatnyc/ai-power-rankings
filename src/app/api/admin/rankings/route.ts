/**
 * Consolidated Admin Rankings Management API
 *
 * Endpoints:
 * - GET: List periods, check data, get progress
 * - POST: Preview, build, set current, create period
 * - DELETE: Delete ranking period
 * - PUT: Update or sync rankings
 */

// import { RankingChangeAnalyzer } from "@/lib/ranking-change-analyzer";
// import {
//   extractEnhancedNewsMetrics,
//   applyEnhancedNewsMetrics,
//   applyNewsImpactToScores
// } from "@/lib/ranking-news-enhancer";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { type NextRequest, NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/admin-auth";
import { getRankingsRepo, getToolsRepo } from "@/lib/json-db";
import type { RankingEntry, RankingPeriod, Tool } from "@/lib/json-db/schemas";
import { loggers } from "@/lib/logger";
import { RankingEngineV6, type ToolMetricsV6, type ToolScoreV6 } from "@/lib/ranking-algorithm-v6";

// Helper function for category-based agentic scores
function getCategoryBasedAgenticScore(category: string, toolName: string): number {
  const premiumAgents = ["Devin", "Claude Code", "Google Jules"];
  if (premiumAgents.includes(toolName)) {
    return 8.5;
  }

  const categoryScores: Record<string, number> = {
    "autonomous-agent": 8,
    "ide-assistant": 6,
    "code-assistant": 5,
    "app-builder": 4,
    "research-tool": 3,
    "general-assistant": 2,
  };

  return categoryScores[category] || 5;
}

// Helper function to transform tool to metrics
function transformToToolMetrics(tool: Tool, innovationScore: number = 0): ToolMetricsV6 {
  const info = tool["info"];
  const technical = info?.technical || {};
  const businessMetrics = info?.metrics || {};
  const business = info?.business || {};

  return {
    tool_id: tool["id"],
    status: tool["status"],
    agentic_capability: getCategoryBasedAgenticScore(tool["category"], tool["name"]),
    swe_bench_score: businessMetrics["swe_bench_score"] || 0,
    multi_file_capability: technical["multi_file_support"] ? 75 : 25,
    planning_depth: 5, // Default value as field doesn't exist in schema
    context_utilization: 5, // Default value as field doesn't exist in schema
    context_window: technical["context_window"] || 100000,
    language_support: technical["supported_languages"] || 10,
    github_stars: businessMetrics["github_stars"] || 0,
    innovation_score: innovationScore,
    innovations: [],
    estimated_users: businessMetrics["estimated_users"] || 0,
    monthly_arr: businessMetrics["monthly_arr"] || 0,
    valuation: businessMetrics["valuation"] || 0,
    funding: businessMetrics["funding_total"] || 0,
    business_model: business["business_model"] || "freemium",
    business_sentiment: 5,
    risk_factors: [],
    release_frequency: 5,
    github_contributors: businessMetrics["github_contributors"] || 0,
    llm_provider_count: 1,
    multi_model_support: false, // Default value as field doesn't exist in schema
    community_size: businessMetrics["estimated_users"] || 0, // Using estimated_users as proxy for community_size
  };
}

/**
 * GET /api/admin/rankings
 *
 * Query params:
 * - action: 'periods' | 'check-data' | 'progress' | 'all'
 * - period: specific period for check-data
 */
export async function GET(request: NextRequest) {
  return withAdminAuth<any>(async () => {
    try {
      const { searchParams } = new URL(request.url);
      const action = searchParams.get("action") || "periods";
      const rankingsRepo = getRankingsRepo();

      switch (action) {
        case "periods": {
          // List all ranking periods (replaces ranking-periods)
          const periods = await rankingsRepo.getPeriods();
          const periodData = [];

          for (const period of periods) {
            const data = await rankingsRepo.getRankingsForPeriod(period);
            if (data) {
              periodData.push({
                period,
                tool_count: data.rankings.length,
                algorithm_version: data.algorithm_version,
                generated_at: (data as RankingPeriod & { generated_at?: string }).generated_at,
                is_current: data.is_current || false,
              });
            }
          }

          return NextResponse.json({
            periods: periodData,
            total: periodData.length,
          });
        }

        case "check-data": {
          // Check rankings data integrity (replaces check-rankings-data)
          const period = searchParams.get("period");

          if (!period) {
            const periods = await rankingsRepo.getPeriods();
            const allData = [];

            for (const p of periods) {
              const data = await rankingsRepo.getRankingsForPeriod(p);
              if (data) {
                allData.push({
                  period: p,
                  rankings: data.rankings.length,
                  has_scores: data.rankings.every((r) => r.score !== undefined),
                  algorithm_version: data.algorithm_version,
                });
              }
            }

            return NextResponse.json({ periods: allData });
          }

          const data = await rankingsRepo.getRankingsForPeriod(period);
          if (!data) {
            return NextResponse.json(
              { error: `No data found for period ${period}` },
              { status: 404 }
            );
          }

          return NextResponse.json({
            period,
            tool_count: data.rankings.length,
            algorithm_version: data.algorithm_version,
            generated_at: (data as RankingPeriod & { generated_at?: string }).generated_at,
            sample_rankings: data.rankings.slice(0, 5),
          });
        }

        case "progress": {
          // Get ranking generation progress (replaces ranking-progress)
          // This would typically track async job progress
          // For now, return a placeholder
          return NextResponse.json({
            status: "idle",
            progress: 0,
            message: "No ranking generation in progress",
          });
        }

        case "all": {
          // Get all rankings data (replaces rankings/all)
          const periods = await rankingsRepo.getPeriods();
          const allRankings = [];

          for (const period of periods) {
            const data = await rankingsRepo.getRankingsForPeriod(period);
            if (data) {
              allRankings.push({
                period,
                rankings: data.rankings,
                metadata: {
                  algorithm_version: data.algorithm_version,
                  generated_at: (data as RankingPeriod & { generated_at?: string }).generated_at,
                  is_current: data.is_current || false,
                },
              });
            }
          }

          return NextResponse.json({
            periods: allRankings,
            total_periods: allRankings.length,
          });
        }

        default:
          return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
      }
    } catch (error) {
      loggers.api.error("Error in admin/rankings GET", { error });
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  });
}

/**
 * POST /api/admin/rankings
 *
 * Actions:
 * - preview: Preview rankings for a period
 * - build: Build rankings and save to JSON
 * - set-current: Set current ranking period
 * - create-period: Create new ranking period
 * - sync-current: Sync current rankings
 */
export async function POST(request: NextRequest) {
  return withAdminAuth<any>(async () => {
    try {
      const body = await request.json();
      const { action } = body;

      switch (action) {
        case "preview": {
          // Preview rankings (condensed from preview-rankings/route.ts)
          const { period, algorithm_version = "v6.0", preview_date, compare_with } = body;

          if (!period) {
            return NextResponse.json({ error: "Period parameter is required" }, { status: 400 });
          }

          const toolsRepo = getToolsRepo();
          const rankingsRepo = getRankingsRepo();
          // const newsRepo = getNewsRepo();

          // Get comparison period
          let comparisonPeriod = compare_with;
          let currentRankings: RankingEntry[] = [];

          if (compare_with === "auto" || !compare_with) {
            const availablePeriods = await rankingsRepo.getPeriods();
            for (const p of availablePeriods) {
              if (p < period) {
                comparisonPeriod = p;
                break;
              }
            }
          }

          if (comparisonPeriod && comparisonPeriod !== "none") {
            const periodData = await rankingsRepo.getRankingsForPeriod(comparisonPeriod);
            if (periodData) {
              currentRankings = periodData.rankings;
            }
          }

          // Fetch tools and news
          let tools = await toolsRepo.getByStatus("active");
          // const newsArticles = await newsRepo.getAll();

          // Filter by preview date if provided
          if (preview_date) {
            const cutoffDate = new Date(preview_date);
            tools = tools.filter((tool) => {
              const toolDate = tool["launch_date"]
                ? new Date(tool["launch_date"])
                : new Date(tool["created_at"]);
              return toolDate <= cutoffDate;
            });
          }

          // Load innovation scores
          const innovationScores: { tool_id: string; score?: number; innovation_score?: number }[] =
            [];
          try {
            const fs = await import("fs-extra");
            const path = await import("node:path");
            const innovationPath = path.join(
              process.cwd(),
              "data",
              "json",
              "innovation-scores.json"
            );
            if (await fs.pathExists(innovationPath)) {
              const innovationData = await fs.readJSON(innovationPath);
              innovationScores.push(...innovationData);
            }
          } catch (error) {
            loggers.api.warn("Failed to load innovation scores", { error });
          }
          const innovationMap = new Map(innovationScores.map((s) => [s.tool_id, s]));

          // Calculate scores
          const rankingEngine = new RankingEngineV6();
          const newScores: ToolScoreV6[] = [];

          for (const tool of tools) {
            try {
              const innovationData = innovationMap.get(tool["id"]);
              const innovationScore = innovationData?.["score"] || 0;

              // const enableAI = process.env["ENABLE_AI_NEWS_ANALYSIS"] !== "false";
              // const enhancedMetrics = await extractEnhancedNewsMetrics(
              //   tool["id"],
              //   tool["name"],
              //   newsArticles,
              //   preview_date,
              //   enableAI
              // );
              // const enhancedMetrics = {} as any;

              const toolMetrics = transformToToolMetrics(tool, innovationScore);
              // toolMetrics = applyEnhancedNewsMetrics(toolMetrics, enhancedMetrics);

              const score = rankingEngine.calculateToolScore(
                toolMetrics,
                preview_date ? new Date(preview_date) : new Date(period)
              );

              // const adjustedFactorScores = applyNewsImpactToScores(
              //   score["factorScores"],
              //   enhancedMetrics
              // );
              const adjustedFactorScores = {} as Record<string, number>;

              score["factorScores"] = {
                ...score["factorScores"],
                ...adjustedFactorScores,
              };

              // Recalculate overall score
              const weights = RankingEngineV6.getAlgorithmInfo().weights;
              score["overallScore"] = Object.entries(weights).reduce((total, [factor, weight]) => {
                const factorScore =
                  score["factorScores"][factor as keyof (typeof score)["factorScores"]] || 0;
                return total + factorScore * weight;
              }, 0);
              score["overallScore"] = Math.max(
                0,
                Math.min(10, Math.round(score["overallScore"] * 1000) / 1000)
              );

              newScores.push(score);
            } catch (error) {
              loggers.api.error(`Error calculating score for tool ${tool["name"]}:`, error);
            }
          }

          // Sort and create comparisons
          newScores.sort((a, b) => b.overallScore - a.overallScore);

          // Generate comparison data (simplified)
          const comparisons = [];
          const currentRankingsMap = new Map(currentRankings.map((r) => [r.tool_id, r]));

          for (let i = 0; i < newScores.length; i++) {
            const newScore = newScores[i];
            const tool = tools.find((t) => t["id"] === newScore?.["toolId"]);
            if (!tool) continue;

            const currentRanking = currentRankingsMap.get(tool["id"]);
            const newPosition = i + 1;
            const currentPosition = currentRanking?.position;

            comparisons.push({
              tool_id: String(tool["id"]),
              tool_name: tool["name"],
              current_position: currentPosition,
              new_position: newPosition,
              current_score: currentRanking?.score,
              new_score: newScore?.["overallScore"] || 0,
              position_change: currentPosition ? currentPosition - newPosition : 0,
              score_change: currentRanking
                ? (newScore?.["overallScore"] || 0) - currentRanking["score"]
                : newScore?.["overallScore"] || 0,
              movement: !currentPosition
                ? "new"
                : currentPosition > newPosition
                  ? "up"
                  : currentPosition < newPosition
                    ? "down"
                    : "same",
            });
          }

          return NextResponse.json({
            success: true,
            preview: {
              period,
              algorithm_version,
              total_tools: newScores.length,
              rankings_comparison: comparisons,
              comparison_period: comparisonPeriod,
            },
          });
        }

        case "build": {
          // Build and save rankings (replaces build-rankings-json)
          const { period, dry_run = false } = body;

          if (!period) {
            return NextResponse.json({ error: "Period is required" }, { status: 400 });
          }

          // Similar logic to preview, but saves to file
          const toolsRepo = getToolsRepo();
          // const newsRepo = getNewsRepo();
          const rankingsRepo = getRankingsRepo();

          const tools = await toolsRepo.getByStatus("active");
          // const newsArticles = await newsRepo.getAll();

          // Calculate rankings (same as preview)
          const rankingEngine = new RankingEngineV6();
          const scores: ToolScoreV6[] = [];

          // Load innovation scores
          const innovationScores: { tool_id: string; score?: number; innovation_score?: number }[] =
            [];
          try {
            const fs = await import("fs-extra");
            const path = await import("node:path");
            const innovationPath = path.join(
              process.cwd(),
              "data",
              "json",
              "innovation-scores.json"
            );
            if (await fs.pathExists(innovationPath)) {
              const innovationData = await fs.readJSON(innovationPath);
              innovationScores.push(...innovationData);
            }
          } catch (error) {
            loggers.api.warn("Failed to load innovation scores", { error });
          }
          const innovationMap = new Map(innovationScores.map((s) => [s.tool_id, s]));

          for (const tool of tools) {
            try {
              const innovationData = innovationMap.get(tool["id"]);
              const innovationScore = innovationData?.["score"] || 0;

              // const enableAI = process.env["ENABLE_AI_NEWS_ANALYSIS"] !== "false";
              // const enhancedMetrics = await extractEnhancedNewsMetrics(
              //   tool["id"],
              //   tool["name"],
              //   newsArticles,
              //   period,
              //   enableAI
              // );

              const toolMetrics = transformToToolMetrics(tool, innovationScore);
              // toolMetrics = applyEnhancedNewsMetrics(toolMetrics, enhancedMetrics);

              const score = rankingEngine.calculateToolScore(toolMetrics, new Date(period));

              scores.push(score);
            } catch (error) {
              loggers.api.error(`Error calculating score for ${tool.name}:`, error);
            }
          }

          // Sort and format rankings
          scores.sort((a, b) => b.overallScore - a.overallScore);

          const rankings = scores.map((score, index) => {
            const tool = tools.find((t) => t.id === score.toolId);
            return {
              position: index + 1,
              tool_id: score.toolId,
              tool_name: tool?.name || "Unknown",
              tool_slug: tool?.slug || "",
              score: score.overallScore,
              factor_scores: {
                agentic_capability: score.factorScores.agenticCapability,
                innovation: score.factorScores.innovation,
                technical_performance: score.factorScores.technicalPerformance,
                developer_adoption: score.factorScores.developerAdoption,
                market_traction: score.factorScores.marketTraction,
                business_sentiment: score.factorScores.businessSentiment,
                development_velocity: score.factorScores.developmentVelocity,
                platform_resilience: score.factorScores.platformResilience,
              },
            };
          });

          if (dry_run) {
            return NextResponse.json({
              success: true,
              dry_run: true,
              period,
              rankings: rankings.slice(0, 10), // Preview top 10
              total: rankings.length,
            });
          }

          // Save rankings
          const rankingData = {
            period,
            algorithm_version: "v6.0",
            generated_at: new Date().toISOString(),
            rankings,
          };

          await rankingsRepo.saveRankingsForPeriod(rankingData as RankingPeriod);

          // Also update public rankings.json if this is the current period
          const publicPath = join(process.cwd(), "public", "data", "rankings.json");
          writeFileSync(publicPath, JSON.stringify(rankingData, null, 2));

          return NextResponse.json({
            success: true,
            period,
            rankings_count: rankings.length,
            message: "Rankings built and saved successfully",
          });
        }

        case "set-current": {
          // Set current ranking period (replaces set-live-ranking)
          const { period } = body;

          if (!period) {
            return NextResponse.json({ error: "Period is required" }, { status: 400 });
          }

          const rankingsRepo = getRankingsRepo();
          const data = await rankingsRepo.getRankingsForPeriod(period);

          if (!data) {
            return NextResponse.json(
              { error: `No rankings found for period ${period}` },
              { status: 404 }
            );
          }

          // Update all periods to set is_current flag
          const periods = await rankingsRepo.getPeriods();
          for (const p of periods) {
            const periodData = await rankingsRepo.getRankingsForPeriod(p);
            if (periodData) {
              (periodData as RankingPeriod & { is_current: boolean }).is_current = p === period;
              await rankingsRepo.saveRankingsForPeriod(periodData as RankingPeriod);
            }
          }

          // Update public rankings.json
          const publicPath = join(process.cwd(), "public", "data", "rankings.json");
          writeFileSync(
            publicPath,
            JSON.stringify(
              {
                ...data,
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
          // Create new ranking period (replaces create-ranking-period)
          const { period, copy_from } = body;

          if (!period) {
            return NextResponse.json({ error: "Period is required" }, { status: 400 });
          }

          const rankingsRepo = getRankingsRepo();

          // Check if period already exists
          const existing = await rankingsRepo.getRankingsForPeriod(period);
          if (existing) {
            return NextResponse.json({ error: `Period ${period} already exists` }, { status: 400 });
          }

          let rankingData: RankingPeriod & { is_current?: boolean; generated_at: string };
          if (copy_from) {
            // Copy from existing period
            const sourceData = await rankingsRepo.getRankingsForPeriod(copy_from);
            if (!sourceData) {
              return NextResponse.json(
                { error: `Source period ${copy_from} not found` },
                { status: 404 }
              );
            }
            rankingData = {
              ...sourceData,
              period,
              generated_at: new Date().toISOString(),
              is_current: false,
            };
          } else {
            // Create empty period
            rankingData = {
              period,
              algorithm_version: "v6.0",
              generated_at: new Date().toISOString(),
              rankings: [],
              is_current: false,
            };
          }

          await rankingsRepo.saveRankingsForPeriod(rankingData as RankingPeriod);

          return NextResponse.json({
            success: true,
            message: `Created ranking period ${period}`,
            period,
            copied_from: copy_from || null,
          });
        }

        case "sync-current": {
          // Sync current rankings (replaces sync-current-rankings)
          const rankingsRepo = getRankingsRepo();
          const periods = await rankingsRepo.getPeriods();

          // Find current period
          let currentPeriod = null;
          let currentData = null;

          for (const period of periods) {
            const data = await rankingsRepo.getRankingsForPeriod(period);
            if (data?.is_current) {
              currentPeriod = period;
              currentData = data;
              break;
            }
          }

          if (!currentData || !currentPeriod) {
            // Use most recent period as fallback
            const latestPeriod = periods[0];
            if (latestPeriod) {
              currentData = await rankingsRepo.getRankingsForPeriod(latestPeriod);
              currentPeriod = latestPeriod;
            }
          }

          if (!currentData) {
            return NextResponse.json({ error: "No rankings data found" }, { status: 404 });
          }

          // Update public rankings.json
          const publicPath = join(process.cwd(), "public", "data", "rankings.json");
          writeFileSync(
            publicPath,
            JSON.stringify(
              {
                ...currentData,
                is_current: true,
              },
              null,
              2
            )
          );

          // Update cache
          const cachePath = join(process.cwd(), "src", "data", "cache", "rankings-static.json");
          writeFileSync(
            cachePath,
            JSON.stringify(
              {
                ...currentData,
                is_current: true,
              },
              null,
              2
            )
          );

          return NextResponse.json({
            success: true,
            message: `Synced current rankings from period ${currentPeriod}`,
            period: currentPeriod,
            rankings_count: currentData.rankings.length,
          });
        }

        default:
          return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
      }
    } catch (error) {
      loggers.api.error("Error in admin/rankings POST", { error });
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  });
}

/**
 * DELETE /api/admin/rankings
 *
 * Delete a ranking period
 */
export async function DELETE(request: NextRequest) {
  return withAdminAuth<any>(async () => {
    try {
      const { searchParams } = new URL(request.url);
      const period = searchParams.get("period");

      if (!period) {
        return NextResponse.json({ error: "Period is required" }, { status: 400 });
      }

      const rankingsRepo = getRankingsRepo();
      const data = await rankingsRepo.getRankingsForPeriod(period);

      if (!data) {
        return NextResponse.json({ error: `Period ${period} not found` }, { status: 404 });
      }

      if (data.is_current) {
        return NextResponse.json(
          { error: "Cannot delete current ranking period" },
          { status: 400 }
        );
      }

      // Delete the period data
      const fs = await import("fs-extra");
      const path = await import("node:path");
      const periodPath = path.join(
        process.cwd(),
        "data",
        "json",
        "rankings",
        "by-period",
        `${period}.json`
      );

      await fs.remove(periodPath);

      return NextResponse.json({
        success: true,
        message: `Deleted ranking period ${period}`,
      });
    } catch (error) {
      loggers.api.error("Error in admin/rankings DELETE", { error });
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  });
}
