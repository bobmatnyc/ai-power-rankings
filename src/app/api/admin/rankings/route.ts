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
import { RankingsRepository } from "@/lib/db/repositories/rankings.repository";
import { ToolsRepository } from "@/lib/db/repositories/tools.repository";
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
function transformToToolMetrics(tool: any, innovationScore: number = 0): ToolMetricsV6 {
  const info = tool.info || {};
  const technical = info.technical || {};
  const businessMetrics = info.metrics || {};
  const business = info.business || {};

  return {
    tool_id: tool.id,
    status: tool.status,
    agentic_capability: getCategoryBasedAgenticScore(tool.category, tool.name),
    swe_bench_score: businessMetrics.swe_bench_score || 0,
    multi_file_capability: technical.multi_file_support ? 75 : 25,
    planning_depth: 5,
    context_utilization: 5,
    context_window: technical.context_window || 100000,
    language_support: technical.supported_languages || 10,
    github_stars: businessMetrics.github_stars || 0,
    innovation_score: innovationScore,
    innovations: [],
    estimated_users: businessMetrics.estimated_users || 0,
    monthly_arr: businessMetrics.monthly_arr || 0,
    valuation: businessMetrics.valuation || 0,
    funding: businessMetrics.funding_total || 0,
    business_model: business.business_model || "freemium",
    business_sentiment: 5,
    risk_factors: [],
    release_frequency: 5,
    github_contributors: businessMetrics.github_contributors || 0,
    llm_provider_count: 1,
    multi_model_support: false,
    community_size: businessMetrics.estimated_users || 0,
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
        const periodData = allRankings.map(ranking => ({
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
          const allData = allRankings.map(ranking => ({
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
        const formattedRankings = allRankings.map(ranking => ({
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
        const { period, algorithm_version = "v6.0", preview_date, compare_with } = body;

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
            const toolDate = tool.launch_date
              ? new Date(tool.launch_date)
              : new Date(tool.created_at);
            return toolDate <= cutoffDate;
          });
        }

        // Load innovation scores (if available)
        const innovationScores: { tool_id: string; score?: number }[] = [];
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
            const innovationData = innovationMap.get(tool.id);
            const innovationScore = innovationData?.score || 0;

            const toolMetrics = transformToToolMetrics(tool, innovationScore);
            const score = rankingEngine.calculateToolScore(
              toolMetrics,
              preview_date ? new Date(preview_date) : new Date(period)
            );

            // Recalculate overall score
            const weights = RankingEngineV6.getAlgorithmInfo().weights;
            score.overallScore = Object.entries(weights).reduce((total, [factor, weight]) => {
              const factorScore = score.factorScores[factor as keyof typeof score.factorScores] || 0;
              return total + factorScore * weight;
            }, 0);
            score.overallScore = Math.max(0, Math.min(10, Math.round(score.overallScore * 1000) / 1000));

            newScores.push(score);
          } catch (error) {
            loggers.api.error(`Error calculating score for tool ${tool.name}:`, error);
          }
        }

        // Sort and create comparisons
        newScores.sort((a, b) => b.overallScore - a.overallScore);

        // Generate comparison data
        const comparisons = [];
        const currentRankingsMap = new Map(currentRankings.map((r) => [r.tool_id, r]));

        for (let i = 0; i < newScores.length; i++) {
          const newScore = newScores[i];
          const tool = tools.find((t) => t.id === newScore?.toolId);
          if (!tool) continue;

          const currentRanking = currentRankingsMap.get(tool.id);
          const newPosition = i + 1;
          const currentPosition = currentRanking?.position;

          comparisons.push({
            tool_id: tool.id,
            tool_name: tool.name,
            category: tool.category || "",
            current_rank: newPosition,
            current_score: newScore?.overallScore || 0,
            previous_rank: currentPosition,
            previous_score: currentRanking?.score,
            rank_change: currentPosition ? currentPosition - newPosition : 0,
            score_change: currentRanking
              ? (newScore?.overallScore || 0) - currentRanking.score
              : newScore?.overallScore || 0,
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
        // Build and save rankings
        const { period, dry_run = false } = body;

        if (!period) {
          return NextResponse.json({ error: "Period is required" }, { status: 400 });
        }

        const toolsRepo = new ToolsRepository();
        const rankingsRepo = new RankingsRepository();

        const tools = await toolsRepo.findByStatus("active");

        // Calculate rankings
        const rankingEngine = new RankingEngineV6();
        const scores: ToolScoreV6[] = [];

        // Load innovation scores
        const innovationScores: { tool_id: string; score?: number }[] = [];
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
            const innovationData = innovationMap.get(tool.id);
            const innovationScore = innovationData?.score || 0;

            const toolMetrics = transformToToolMetrics(tool, innovationScore);
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
            rankings: rankings.slice(0, 10),
            total: rankings.length,
          });
        }

        // Save rankings to database
        const rankingData = {
          period,
          algorithm_version: "v6.0",
          generated_at: new Date().toISOString(),
          rankings,
        };

        // Check if period exists
        const existing = await rankingsRepo.getByPeriod(period);
        if (existing) {
          await rankingsRepo.update(existing.id, {
            data: rankingData,
            algorithm_version: "v6.0",
          });
        } else {
          await rankingsRepo.create({
            period,
            algorithm_version: "v6.0",
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
            algorithm_version: "v6.0",
            generated_at: new Date().toISOString(),
            rankings: [],
          };
        }

        await rankingsRepo.create({
          period,
          algorithm_version: rankingData.algorithm_version || "v6.0",
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
            await rankingsRepo.setAsCurrent(latestRanking.id);

            // Update public files
            const publicPath = join(process.cwd(), "public", "data", "rankings.json");
            writeFileSync(
              publicPath,
              JSON.stringify(
                {
                  ...latestRanking.data,
                  is_current: true,
                },
                null,
                2
              )
            );

            const cachePath = join(process.cwd(), "src", "data", "cache", "rankings-static.json");
            writeFileSync(
              cachePath,
              JSON.stringify(
                {
                  ...latestRanking.data,
                  is_current: true,
                },
                null,
                2
              )
            );

            return NextResponse.json({
              success: true,
              message: `Synced rankings from period ${latestRanking.period}`,
              period: latestRanking.period,
              rankings_count: latestRanking.data?.rankings?.length || 0,
            });
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

        const cachePath = join(process.cwd(), "src", "data", "cache", "rankings-static.json");
        writeFileSync(
          cachePath,
          JSON.stringify(
            {
              ...currentData.data,
              is_current: true,
            },
            null,
            2
          )
        );

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
      return NextResponse.json(
        { error: "Cannot delete current ranking period" },
        { status: 400 }
      );
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