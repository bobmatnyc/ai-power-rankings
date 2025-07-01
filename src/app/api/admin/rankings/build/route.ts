import { NextRequest, NextResponse } from "next/server";
import { getRankingsRepo, getToolsRepo } from "@/lib/json-db";
import { loggers } from "@/lib/logger";
import type { RankingEntry } from "@/lib/json-db/schemas";
import { RankingEngineV6, ToolMetricsV6, ToolScoreV6 } from "@/lib/ranking-algorithm-v6";
import { RankingChangeAnalyzer } from "@/lib/ranking-change-analyzer";
import fs from "fs-extra";
import path from "path";

interface InnovationScore {
  tool_id: string;
  score: number;
  updated_at: string;
}

function calculateTier(position: number): "S" | "A" | "B" | "C" | "D" {
  if (position <= 5) {
    return "S";
  }
  if (position <= 15) {
    return "A";
  }
  if (position <= 25) {
    return "B";
  }
  if (position <= 35) {
    return "C";
  }
  return "D";
}

function transformToToolMetrics(tool: any, innovationScore?: number): ToolMetricsV6 {
  // Extract metrics from tool.info structure (JSON format)
  const info = tool.info;
  const technical = info?.technical || {};
  const businessMetrics = info?.metrics || {};
  const business = info?.business || {};

  return {
    tool_id: tool.id,
    status: tool.status,

    // Agentic capabilities
    agentic_capability: tool.agentic_capability || 0,
    swe_bench_score: businessMetrics.swe_bench_score || 0,
    multi_file_capability: technical.multi_file_support ? 7 : 3,
    planning_depth: 5, // Default value
    context_utilization: 5, // Default value

    // Technical metrics
    context_window: technical.context_window || 100000,
    language_support: technical.supported_languages?.length || 10,
    github_stars: businessMetrics.github_stars || 0,

    // Innovation metrics
    innovation_score: innovationScore || 0,
    innovations: [],

    // Market metrics
    estimated_users: businessMetrics.estimated_users || 0,
    monthly_arr: businessMetrics.monthly_arr || 0,
    valuation: businessMetrics.valuation || 0,
    funding: businessMetrics.funding_total || 0,
    business_model: business.business_model || "freemium",

    // Risk and sentiment (default values)
    business_sentiment: 5,
    risk_factors: [],

    // Development metrics
    release_frequency: 2,
    github_contributors: businessMetrics.github_contributors || 10,

    // Platform metrics
    llm_provider_count: 1,
    multi_model_support: technical.multi_model_support || false,
    community_size: businessMetrics.estimated_users || 0,
  };
}

// POST - Build new rankings
export async function POST(request: NextRequest) {
  try {
    // TODO: Add authentication check here

    const body = await request.json();
    const { period, preview_date } = body;

    if (!period) {
      return NextResponse.json(
        { error: "Period is required (YYYY-MM-DD or YYYY-MM format)" },
        { status: 400 }
      );
    }

    const toolsRepo = getToolsRepo();
    const rankingsRepo = getRankingsRepo();

    // Get all active tools
    const allTools = await toolsRepo.getAll();
    let activeTools = allTools.filter((tool) => tool.status === "active");

    // If preview_date is provided, filter tools that didn't exist yet
    if (preview_date) {
      const cutoffDate = new Date(preview_date);
      const beforeFilter = activeTools.length;
      activeTools = activeTools.filter((tool) => {
        // Use launch_date if available, otherwise fall back to created_at
        const toolDate = tool.launch_date ? new Date(tool.launch_date) : new Date(tool.created_at);
        return toolDate <= cutoffDate;
      });
      const afterFilter = activeTools.length;

      if (beforeFilter !== afterFilter) {
        loggers.api.info(
          `Filtered tools from ${beforeFilter} to ${afterFilter} based on launch/creation date (cutoff: ${preview_date})`
        );
      }
    }

    // Get innovation scores
    const innovationScoresPath = path.join(process.cwd(), "data", "json", "innovation-scores.json");
    let innovationScores: InnovationScore[] = [];
    try {
      if (await fs.pathExists(innovationScoresPath)) {
        innovationScores = await fs.readJson(innovationScoresPath);
      }
    } catch (error) {
      loggers.api.warn("Failed to load innovation scores", { error });
    }
    const innovationMap = new Map(innovationScores.map((s: InnovationScore) => [s.tool_id, s]));

    // Initialize ranking engine and change analyzer
    const rankingEngine = new RankingEngineV6();
    const changeAnalyzer = new RankingChangeAnalyzer();
    const toolScores: ToolScoreV6[] = [];

    // Calculate scores for each tool using the v6 algorithm
    for (const tool of activeTools) {
      try {
        // Get innovation score for this tool
        const innovationData = innovationMap.get(tool.id);
        const innovationScore = innovationData?.score || 0;

        // Transform tool data to metrics format
        const toolMetrics = transformToToolMetrics(tool, innovationScore);

        // Calculate score using v6 algorithm
        const score = rankingEngine.calculateToolScore(
          toolMetrics,
          preview_date ? new Date(preview_date) : new Date(period)
        );

        toolScores.push(score);
      } catch (error) {
        loggers.api.error(`Error calculating score for tool ${tool.name}:`, error);
      }
    }

    // Sort by overall score descending
    toolScores.sort((a, b) => b.overallScore - a.overallScore);

    // Get previous rankings - find the period before this one
    const allPeriods = await rankingsRepo.getAvailablePeriods();
    const currentPeriodIndex = allPeriods.indexOf(period);
    let previousRankingsMap = new Map<string, number>();
    let previousPeriod: any = null;

    if (currentPeriodIndex >= 0 && currentPeriodIndex < allPeriods.length - 1) {
      // Get the previous period (remember periods are sorted descending)
      const previousPeriodKey = allPeriods[currentPeriodIndex + 1];
      if (previousPeriodKey) {
        previousPeriod = await rankingsRepo.getRankingsForPeriod(previousPeriodKey);

        if (previousPeriod) {
          previousRankingsMap = new Map(
            previousPeriod.rankings.map((r: any) => [r.tool_id, r.position])
          );
        }
      }
    }

    // Create ranking entries
    const rankings: RankingEntry[] = [];
    const changeAnalyses = [];

    for (let i = 0; i < toolScores.length; i++) {
      const toolScore = toolScores[i];
      const tool = activeTools.find((t) => t.id === toolScore?.toolId);

      if (!tool || !toolScore) {
        continue;
      }

      const position = i + 1;
      const previousPosition = previousRankingsMap.get(tool.id);
      const previousRanking = previousPosition
        ? previousPeriod?.rankings.find((r: any) => r.tool_id === tool.id)
        : null;

      let movement = undefined;
      if (previousPosition) {
        const change = previousPosition - position;
        movement = {
          previous_position: previousPosition,
          change: Math.abs(change),
          direction: (change > 0 ? "up" : change < 0 ? "down" : "same") as "up" | "down" | "same",
        };
      } else {
        movement = {
          change: 0,
          direction: "new" as const,
        };
      }

      // Generate change analysis
      const changeAnalysis = changeAnalyzer.analyzeRankingChange(
        {
          tool_id: tool.id,
          tool_name: tool.name,
          position,
          score: toolScore.overallScore,
          new_position: position,
          new_score: toolScore.overallScore,
        },
        previousRanking
          ? {
              position: previousPosition!,
              score: previousRanking.score,
              current_position: previousPosition!,
              current_score: previousRanking.score,
            }
          : undefined,
        toolScore.factorScores,
        previousRanking?.factor_scores
          ? {
              agenticCapability: previousRanking.factor_scores.agentic_capability || 0,
              innovation: previousRanking.factor_scores.innovation || 0,
              technicalPerformance: previousRanking.factor_scores.technical_performance || 0,
              developerAdoption: previousRanking.factor_scores.developer_adoption || 0,
              marketTraction: previousRanking.factor_scores.market_traction || 0,
              businessSentiment: previousRanking.factor_scores.business_sentiment || 0,
              developmentVelocity: previousRanking.factor_scores.development_velocity || 0,
              platformResilience: previousRanking.factor_scores.platform_resilience || 0,
            }
          : undefined
      );

      changeAnalyses.push(changeAnalysis);

      rankings.push({
        tool_id: tool.id,
        tool_name: tool.name,
        position,
        score: toolScore.overallScore,
        tier: calculateTier(position),
        factor_scores: {
          agentic_capability: toolScore.factorScores.agenticCapability || 0,
          innovation: toolScore.factorScores.innovation || 0,
          technical_performance: toolScore.factorScores.technicalPerformance || 0,
          developer_adoption: toolScore.factorScores.developerAdoption || 0,
          market_traction: toolScore.factorScores.marketTraction || 0,
          business_sentiment: toolScore.factorScores.businessSentiment || 0,
          development_velocity: toolScore.factorScores.developmentVelocity || 0,
          platform_resilience: toolScore.factorScores.platformResilience || 0,
        },
        movement,
        change_analysis:
          (changeAnalysis.rankChange && Math.abs(changeAnalysis.rankChange) >= 3) ||
          (changeAnalysis.primaryReason && changeAnalysis.primaryReason !== "No significant change")
            ? {
                primary_reason: changeAnalysis.primaryReason,
                narrative_explanation: changeAnalysis.narrativeExplanation,
              }
            : undefined,
      });
    }

    // Save the rankings
    await rankingsRepo.saveRankingsForPeriod({
      period,
      algorithm_version: "v6.0",
      is_current: false, // Don't automatically make it current
      created_at: new Date().toISOString(),
      preview_date,
      rankings,
    });

    // Generate change report
    const changeReport = changeAnalyzer.generateChangeReport(changeAnalyses);

    return NextResponse.json({
      success: true,
      period,
      rankings_count: rankings.length,
      algorithm_version: "v6.0",
      stats: {
        average_score: rankings.reduce((sum, r) => sum + r.score, 0) / rankings.length,
        highest_score: Math.max(...rankings.map((r) => r.score)),
        lowest_score: Math.min(...rankings.map((r) => r.score)),
        new_entries: rankings.filter((r) => r.movement?.direction === "new").length,
        tools_moved_up: rankings.filter((r) => r.movement?.direction === "up").length,
        tools_moved_down: rankings.filter((r) => r.movement?.direction === "down").length,
      },
      change_summary: changeReport,
      message: `Rankings built successfully for ${period} using algorithm v6.0`,
    });
  } catch (error) {
    loggers.api.error("Build rankings error", { error });

    return NextResponse.json(
      {
        error: "Failed to build rankings",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
