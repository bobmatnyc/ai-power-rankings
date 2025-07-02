/**
 * Rankings Build API Endpoint
 *
 * This endpoint generates new rankings for a specified period using the RankingEngineV6 algorithm.
 *
 * ## Overview
 * The ranking generation process:
 * 1. Loads all active tools from the JSON database
 * 2. Loads innovation scores from innovation-scores.json
 * 3. Transforms tool data into metrics format for the algorithm
 * 4. Calculates scores using RankingEngineV6 (returns 0-10 scale)
 * 5. Converts scores to 0-100 scale for consistency
 * 6. Compares with previous period for movement tracking
 * 7. Saves rankings to JSON file
 *
 * ## Important Notes
 * - The algorithm returns scores on a 0-10 scale, which are multiplied by 10 for storage
 * - Agentic capability scores are derived from tool categories (not stored in tools.json)
 * - Innovation scores come from a separate innovation-scores.json file
 * - Other metrics use reasonable defaults when not available
 *
 * ## Request Body
 * - period: string (YYYY-MM-DD format) - The ranking period to generate
 * - preview_date?: string - Optional date for filtering tools by launch date
 *
 * ## Response
 * - success: boolean
 * - period: string
 * - rankings_count: number
 * - algorithm_version: "v6.0"
 * - stats: object with scoring statistics
 * - change_summary: object with movement analysis
 */

import { NextRequest, NextResponse } from "next/server";
import { getRankingsRepo, getToolsRepo, getNewsRepo } from "@/lib/json-db";
import { loggers } from "@/lib/logger";
import type { RankingEntry } from "@/lib/json-db/schemas";
import { RankingEngineV6, ToolMetricsV6, ToolScoreV6 } from "@/lib/ranking-algorithm-v6";
import { RankingChangeAnalyzer } from "@/lib/ranking-change-analyzer";
import {
  extractEnhancedNewsMetrics,
  applyEnhancedNewsMetrics,
  applyNewsImpactToScores,
} from "@/lib/ranking-news-enhancer";
import fs from "fs-extra";
import path from "path";

interface InnovationScore {
  tool_id: string;
  score: number;
  updated_at: string;
}

// extractMetricsFromNews function removed - now handled by enhanced news extraction in ranking-news-enhancer.ts

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

/**
 * Get default agentic capability score based on tool category and name
 *
 * Since agentic_capability is not stored in tools.json but is critical for rankings,
 * we use category-based defaults with special handling for premium tools.
 * These scores reflect the typical autonomy level of tools in each category.
 *
 * @param category - The tool category (e.g., "autonomous-agent", "ide-assistant")
 * @param toolName - The name of the tool for special cases
 * @returns Agentic capability score (0-10 scale)
 */
function getCategoryBasedAgenticScore(category: string, toolName: string): number {
  // Special handling for premium autonomous agents
  const premiumAgents = ["Devin", "Claude Code", "Google Jules"];
  if (premiumAgents.includes(toolName)) {
    return 8.5;
  }

  const categoryScores: Record<string, number> = {
    "autonomous-agent": 8, // Default for other autonomous agents
    "ide-assistant": 6, // Cursor, GitHub Copilot, etc. - Medium autonomy
    "code-assistant": 5, // Cline, Continue, etc. - Moderate autonomy
    "app-builder": 4, // Bolt, Lovable, etc. - Lower autonomy
    "research-tool": 3, // Perplexity, etc. - Minimal coding autonomy
    "general-assistant": 2, // ChatGPT, Claude.ai, etc. - Basic assistance
  };

  return categoryScores[category] || 5; // Default to 5 if category not found
}

/**
 * Transform tool data from JSON storage format to metrics format for ranking algorithm
 *
 * This function maps data from tools.json structure to the ToolMetricsV6 interface
 * expected by RankingEngineV6. It provides reasonable defaults for missing data,
 * with special handling for premium tools to match preview behavior.
 *
 * @param tool - Tool object from tools.json
 * @param innovationScore - Innovation score from innovation-scores.json (optional)
 * @returns ToolMetricsV6 object ready for scoring
 */
function transformToToolMetrics(tool: any, innovationScore?: number): ToolMetricsV6 {
  // Extract metrics from tool.info structure (JSON format)
  const info = tool.info;
  const technical = info?.technical || {};
  const businessMetrics = info?.metrics || {};
  const business = info?.business || {};

  // Determine tool characteristics for better defaults
  const isAutonomous = tool.category === "autonomous-agent";
  const isOpenSource = tool.category === "open-source-framework";
  const isEnterprise = business.pricing_model === "enterprise";
  const isPremium = ["Devin", "Claude Code", "Google Jules", "Cursor"].includes(tool.name);

  return {
    tool_id: tool.id,
    status: tool.status,

    // Agentic capabilities - using category and name-based defaults
    agentic_capability: getCategoryBasedAgenticScore(tool.category, tool.name),
    swe_bench_score: 
      businessMetrics.swe_bench?.verified || 
      businessMetrics.swe_bench?.full || 
      businessMetrics.swe_bench?.lite || 
      businessMetrics.swe_bench_score || 
      (isPremium ? 45 : isAutonomous ? 35 : 20),
    multi_file_capability: isAutonomous ? 9 : technical.multi_file_support ? 7 : 4,
    planning_depth: isAutonomous ? 8.5 : 6,
    context_utilization: isPremium ? 8 : 6.5,

    // Technical metrics
    context_window: technical.context_window || (isPremium ? 200000 : 100000),
    language_support: technical.supported_languages?.length || (isEnterprise ? 20 : 15),
    github_stars: businessMetrics.github_stars || (isOpenSource ? 25000 : 5000),

    // Innovation metrics
    innovation_score: innovationScore || (isPremium ? 8.5 : 6.5),
    innovations: [],

    // Market metrics - with better defaults based on tool type
    estimated_users:
      businessMetrics.estimated_users || (isPremium ? 500000 : isOpenSource ? 100000 : 50000),
    monthly_arr:
      businessMetrics.monthly_arr || (isEnterprise ? 10000000 : isPremium ? 5000000 : 1000000),
    valuation: businessMetrics.valuation || (isPremium ? 1000000000 : 100000000),
    funding: businessMetrics.funding_total || (isPremium ? 100000000 : 10000000),
    business_model: business.business_model || "saas",

    // Risk and sentiment (default values)
    business_sentiment: isPremium ? 0.8 : 0.7,
    risk_factors: [],

    // Development metrics
    release_frequency: isOpenSource ? 7 : 14,
    github_contributors: businessMetrics.github_contributors || (isOpenSource ? 200 : 50),

    // Platform metrics
    llm_provider_count: isPremium ? 5 : 3,
    multi_model_support: technical.multi_model_support || isPremium || isOpenSource,
    community_size: businessMetrics.estimated_users || (isOpenSource ? 50000 : 10000),
  };
}

// POST - Build new rankings
export async function POST(request: NextRequest) {
  try {
    // TODO: Add authentication check here

    const body = await request.json();
    const { period, preview_date, rankings: providedRankings } = body;

    if (!period) {
      return NextResponse.json(
        { error: "Period is required (YYYY-MM-DD or YYYY-MM format)" },
        { status: 400 }
      );
    }

    // If rankings are provided (from preview), use them directly instead of regenerating
    if (providedRankings && Array.isArray(providedRankings)) {
      loggers.api.info(`Using provided rankings data for period ${period}`, {
        rankingsCount: providedRankings.length,
        sampleRanking: providedRankings[0], // Debug: log first ranking structure
      });

      const rankingsRepo = getRankingsRepo();

      // Transform provided rankings to the expected format
      let rankings: RankingEntry[];
      try {
        rankings = providedRankings.map((ranking, index) => ({
          tool_id: ranking.tool_id,
          tool_name: ranking.tool_name,
          position: ranking.position || index + 1,
          score: ranking.score,
          tier: calculateTier(ranking.position || index + 1),
          factor_scores: {
            agentic_capability: ranking.factor_scores?.agentic_capability || 0,
            innovation: ranking.factor_scores?.innovation || 0,
            technical_performance: ranking.factor_scores?.technical_performance || 0,
            developer_adoption: ranking.factor_scores?.developer_adoption || 0,
            market_traction: ranking.factor_scores?.market_traction || 0,
            business_sentiment: ranking.factor_scores?.business_sentiment || 0,
            development_velocity: ranking.factor_scores?.development_velocity || 0,
            platform_resilience: ranking.factor_scores?.platform_resilience || 0,
          },
          movement: ranking.movement
            ? {
                change: Math.abs(ranking.movement.position_change || 0),
                direction: ranking.movement.direction as "up" | "down" | "same" | "new",
                ...(ranking.movement.direction !== "new" && ranking.movement.current_position
                  ? {
                      previous_position: ranking.movement.current_position,
                    }
                  : {}),
              }
            : {
                change: 0,
                direction: "new" as const,
              },
          change_analysis: ranking.change_analysis,
        }));
      } catch (transformError) {
        console.error("TRANSFORM ERROR:", transformError);
        loggers.api.error(
          "Error transforming rankings data - detailed",
          JSON.stringify({
            message:
              transformError instanceof Error ? transformError.message : String(transformError),
            stack: transformError instanceof Error ? transformError.stack : undefined,
            sampleRanking: providedRankings[0],
          })
        );
        throw transformError;
      }

      // Save the rankings
      try {
        await rankingsRepo.saveRankingsForPeriod({
          period,
          algorithm_version: "v6.0",
          is_current: false, // Don't automatically make it current
          created_at: new Date().toISOString(),
          preview_date,
          rankings,
        });
        loggers.api.info("Rankings saved successfully", { period, count: rankings.length });
      } catch (saveError) {
        console.error("SAVE ERROR:", saveError);
        loggers.api.error(
          "Error saving rankings - detailed error",
          JSON.stringify({
            message: saveError instanceof Error ? saveError.message : String(saveError),
            stack: saveError instanceof Error ? saveError.stack : undefined,
            period,
          })
        );
        throw saveError;
      }

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
        message: `Rankings saved successfully for ${period} using provided preview data`,
      });
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

    // Get news articles for metrics extraction
    const newsRepo = getNewsRepo();
    const newsArticles = await newsRepo.getAll();
    loggers.api.info(`Found ${newsArticles.length} news articles for metrics extraction`);

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

        // Extract enhanced metrics from news (quantitative + qualitative with AI)
        const enableAI = process.env["ENABLE_AI_NEWS_ANALYSIS"] !== "false"; // Default to true
        const enhancedMetrics = await extractEnhancedNewsMetrics(
          tool.id,
          tool.name,
          newsArticles,
          preview_date,
          enableAI
        );

        // Log extracted metrics for premium tools
        if (
          ["Devin", "Claude Code", "Google Jules", "Cursor"].includes(tool.name) &&
          (Object.keys(enhancedMetrics).length > 0 || enhancedMetrics.articlesProcessed > 0)
        ) {
          loggers.api.info(`Enhanced metrics for ${tool.name}:`, {
            quantitative: {
              swe_bench: enhancedMetrics.swe_bench_score,
              funding: enhancedMetrics.funding,
              users: enhancedMetrics.estimated_users,
            },
            qualitative: {
              innovation_boost: enhancedMetrics.innovationBoost,
              sentiment_adjust: enhancedMetrics.businessSentimentAdjust,
              velocity_boost: enhancedMetrics.developmentVelocityBoost,
            },
            articles_processed: enhancedMetrics.articlesProcessed,
            significant_events: enhancedMetrics.significantEvents,
          });
        }

        // Transform tool data to metrics format
        let toolMetrics = transformToToolMetrics(tool, innovationScore);

        // Apply enhanced news metrics (both quantitative and qualitative)
        toolMetrics = applyEnhancedNewsMetrics(toolMetrics, enhancedMetrics);

        // Calculate score using v6 algorithm
        const score = rankingEngine.calculateToolScore(
          toolMetrics,
          preview_date ? new Date(preview_date) : new Date(period)
        );

        // Apply additional news impact to factor scores
        const adjustedFactorScores = applyNewsImpactToScores(score.factorScores, enhancedMetrics);

        // Update the score's factor scores with the adjustments
        score.factorScores = {
          ...score.factorScores,
          technicalPerformance:
            adjustedFactorScores["technicalPerformance"] || score.factorScores.technicalPerformance,
          marketTraction:
            adjustedFactorScores["marketTraction"] || score.factorScores.marketTraction,
        };

        // Recalculate overall score after news adjustments
        const weights = RankingEngineV6.getAlgorithmInfo().weights;
        score.overallScore = Object.entries(weights).reduce((total, [factor, weight]) => {
          const factorScore = score.factorScores[factor as keyof typeof score.factorScores] || 0;
          return total + factorScore * weight;
        }, 0);
        score.overallScore = Math.max(
          0,
          Math.min(10, Math.round(score.overallScore * 1000) / 1000)
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
        score: toolScore.overallScore * 10, // Convert from 0-10 to 0-100 scale
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
    loggers.api.error("Build rankings error", {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        error: "Failed to build rankings",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
