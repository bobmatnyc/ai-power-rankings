/**
 * Rankings Build API Endpoint
 *
 * This endpoint generates new rankings for a specified period using the RankingEngineV6 algorithm.
 *
 * ## Overview
 * The ranking generation process:
 * 1. Loads all active tools from the database
 * 2. Loads innovation scores from innovation-scores.json
 * 3. Transforms tool data into metrics format for the algorithm
 * 4. Calculates scores using RankingEngineV6 (returns 0-10 scale)
 * 5. Converts scores to 0-100 scale for consistency
 * 6. Compares with previous period for movement tracking
 * 7. Saves rankings to database
 *
 * ## Important Notes
 * - The algorithm returns scores on a 0-10 scale, which are multiplied by 10 for storage
 * - Agentic capability scores are derived from tool categories
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

import path from "node:path";
import fs from "fs-extra";
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { RankingsRepository } from "@/lib/db/repositories/rankings.repository";
import { ToolsRepository } from "@/lib/db/repositories/tools.repository";
import { NewsRepository } from "@/lib/db/repositories/news";
import { loggers } from "@/lib/logger";
import { RankingEngineV6, type ToolMetricsV6, type ToolScoreV6 } from "@/lib/ranking-algorithm-v6";
import { RankingChangeAnalyzer } from "@/lib/ranking-change-analyzer";
import {
  applyEnhancedNewsMetrics,
  applyNewsImpactToScores,
  extractEnhancedNewsMetrics,
} from "@/lib/ranking-news-enhancer";

interface InnovationScore {
  tool_id: string;
  score: number;
  updated_at: string;
}

function calculateTier(position: number): "S" | "A" | "B" | "C" | "D" {
  if (position <= 5) return "S";
  if (position <= 15) return "A";
  if (position <= 25) return "B";
  if (position <= 35) return "C";
  return "D";
}

/**
 * Get default agentic capability score based on tool category and name
 */
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

/**
 * Transform tool data to metrics format for ranking algorithm
 */
function transformToToolMetrics(tool: any, innovationScore?: number): ToolMetricsV6 {
  const info = tool.info || {};
  const technical = info.technical || {};
  const businessMetrics = info.metrics || {};
  const business = info.business || {};

  const isAutonomous = tool.category === "autonomous-agent";
  const isOpenSource = tool.category === "open-source-framework";
  const isEnterprise = business.pricing_model === "enterprise";
  const isPremium = ["Devin", "Claude Code", "Google Jules", "Cursor"].includes(tool.name);

  return {
    tool_id: tool.id,
    status: tool.status,
    agentic_capability: getCategoryBasedAgenticScore(tool.category, tool.name),
    swe_bench_score:
      businessMetrics.swe_bench_score || (isPremium ? 45 : isAutonomous ? 35 : 20),
    multi_file_capability: isAutonomous ? 9 : technical.multi_file_support ? 7 : 4,
    planning_depth: isAutonomous ? 8.5 : 6,
    context_utilization: isPremium ? 8 : 6.5,
    context_window: technical.context_window || (isPremium ? 200000 : 100000),
    language_support: technical.supported_languages || (isEnterprise ? 20 : 15),
    github_stars: businessMetrics.github_stars || (isOpenSource ? 25000 : 5000),
    innovation_score: innovationScore || (isPremium ? 8.5 : 6.5),
    innovations: [],
    estimated_users:
      businessMetrics.estimated_users || (isPremium ? 500000 : isOpenSource ? 100000 : 50000),
    monthly_arr:
      businessMetrics.monthly_arr || (isEnterprise ? 10000000 : isPremium ? 5000000 : 1000000),
    valuation: businessMetrics.valuation || (isPremium ? 1000000000 : 100000000),
    funding: businessMetrics.funding_total || (isPremium ? 100000000 : 10000000),
    business_model: business.business_model || "saas",
    business_sentiment: isPremium ? 0.8 : 0.7,
    risk_factors: [],
    release_frequency: isOpenSource ? 7 : 14,
    github_contributors: businessMetrics.github_contributors || (isOpenSource ? 200 : 50),
    llm_provider_count: isPremium ? 5 : 3,
    multi_model_support: isPremium || isOpenSource,
    community_size: businessMetrics.estimated_users || (isOpenSource ? 50000 : 10000),
  };
}

// POST - Build new rankings
export async function POST(request: NextRequest) {
  // Check admin authentication
  const authResult = await requireAdmin();
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const body = await request.json();
    const { period, preview_date, rankings: providedRankings } = body;

    if (!period) {
      return NextResponse.json(
        { error: "Period is required (YYYY-MM-DD or YYYY-MM format)" },
        { status: 400 }
      );
    }

    const rankingsRepo = new RankingsRepository();
    const toolsRepo = new ToolsRepository();
    const newsRepo = new NewsRepository();

    // If rankings are provided (from preview), use them directly
    if (providedRankings && Array.isArray(providedRankings)) {
      loggers.api.info(`Using provided rankings data for period ${period}`, {
        rankingsCount: providedRankings.length,
      });

      // Transform provided rankings to the expected format
      const rankings = providedRankings.map((ranking, index) => ({
        tool_id: ranking.tool_id,
        tool_name: ranking.tool_name,
        position: ranking.position || index + 1,
        score: ranking.score,
        tier: calculateTier(ranking.position || index + 1),
        factor_scores: ranking.factor_scores || {},
        movement: ranking.movement || { change: 0, direction: "new" as const },
        change_analysis: ranking.change_analysis,
      }));

      // Save to database
      const existingRanking = await rankingsRepo.getByPeriod(period);
      if (existingRanking) {
        await rankingsRepo.update(existingRanking.id, {
          data: {
            rankings,
            generated_at: new Date().toISOString(),
            algorithm_version: "v6.0",
          },
        });
      } else {
        await rankingsRepo.create({
          period,
          algorithm_version: "v6.0",
          is_current: false,
          data: {
            rankings,
            generated_at: new Date().toISOString(),
          },
        });
      }

      return NextResponse.json({
        success: true,
        period,
        rankings_count: rankings.length,
        algorithm_version: "v6.0",
        message: "Rankings saved successfully from preview data",
      });
    }

    // Generate new rankings
    loggers.api.info(`Generating new rankings for period ${period}`);

    // Get all active tools
    let tools = await toolsRepo.findByStatus("active");

    // Filter by preview date if provided
    if (preview_date) {
      const cutoffDate = new Date(preview_date);
      tools = tools.filter((tool) => {
        const toolDate = new Date(tool.launch_date || tool.created_at);
        return toolDate <= cutoffDate;
      });
    }

    loggers.api.info(`Found ${tools.length} active tools for ranking`);

    // Load innovation scores
    const innovationScoresPath = path.join(process.cwd(), "data", "json", "innovation-scores.json");
    let innovationScores: InnovationScore[] = [];
    try {
      if (await fs.pathExists(innovationScoresPath)) {
        innovationScores = await fs.readJson(innovationScoresPath);
      }
    } catch (error) {
      loggers.api.warn("Failed to load innovation scores", { error });
    }
    const innovationMap = new Map(innovationScores.map((s) => [s.tool_id, s.score]));

    // Get news articles for enhanced metrics
    const newsArticles = await newsRepo.getAll();
    const formattedArticles = newsArticles.map(article => ({
      id: article.id,
      title: article.title,
      content: article.content || '',
      summary: article.summary || '',
      published_date: article.publishedAt.toISOString(),
      tool_mentions: article.toolMentions as string[] || [],
      tags: article.data?.tags || [],
      category: article.data?.category || '',
      importance_score: article.data?.importance_score || 0,
      metadata: article.data || {},
    }));

    // Calculate scores for all tools
    const rankingEngine = new RankingEngineV6();
    const toolScores: Array<{ tool: any; score: ToolScoreV6; overallScore: number }> = [];

    for (const tool of tools) {
      // Get innovation score
      const innovationScore = innovationMap.get(tool.id);

      // Extract enhanced metrics from news
      const enhancedMetrics = await extractEnhancedNewsMetrics(
        tool.id,
        tool.name,
        formattedArticles,
        preview_date,
        process.env["ENABLE_AI_NEWS_ANALYSIS"] !== "false"
      );

      // Transform to metrics format
      let metrics = transformToToolMetrics(tool, innovationScore);

      // Apply enhanced news metrics
      metrics = applyEnhancedNewsMetrics(metrics, enhancedMetrics);

      // Calculate score
      const scoreResult = rankingEngine.calculateToolScore(
        metrics,
        preview_date ? new Date(preview_date) : new Date(period)
      );

      // Apply news impact to scores
      const adjustedFactorScores = applyNewsImpactToScores(
        scoreResult.factorScores,
        enhancedMetrics
      );

      // Update factor scores
      Object.keys(adjustedFactorScores).forEach((key) => {
        if (key in scoreResult.factorScores) {
          const adjustedValue = adjustedFactorScores[key];
          if (adjustedValue !== undefined) {
            (scoreResult.factorScores as Record<string, number>)[key] = adjustedValue;
          }
        }
      });

      // Recalculate overall score
      const weights = RankingEngineV6.getAlgorithmInfo().weights;
      scoreResult.overallScore = Object.entries(weights).reduce((total, [factor, weight]) => {
        const factorScore =
          scoreResult.factorScores[factor as keyof typeof scoreResult.factorScores] || 0;
        return total + factorScore * weight;
      }, 0);
      scoreResult.overallScore = Math.max(
        0,
        Math.min(10, Math.round(scoreResult.overallScore * 1000) / 1000)
      );

      toolScores.push({
        tool,
        score: scoreResult,
        overallScore: scoreResult.overallScore * 10, // Convert to 0-100 scale
      });
    }

    // Sort by overall score
    toolScores.sort((a, b) => b.overallScore - a.overallScore);

    // Get previous period for comparison
    const allRankings = await rankingsRepo.findAll();
    const previousPeriod = allRankings.find(r => r.period < period);
    const previousRankings = previousPeriod?.data?.rankings || [];
    const previousMap = new Map(
      previousRankings.map((r: any) => [r.tool_id, r])
    );

    // Create final rankings with movement tracking
    const rankings = toolScores.map((item, index) => {
      const position = index + 1;
      const previousRanking = previousMap.get(item.tool.id);
      const previousPosition = previousRanking?.position;

      let movement: any = {
        change: 0,
        direction: "new" as const,
      };

      if (previousPosition) {
        const change = previousPosition - position;
        movement = {
          change: Math.abs(change),
          direction: change > 0 ? "up" : change < 0 ? "down" : "same",
          previous_position: previousPosition,
        };
      }

      return {
        tool_id: item.tool.id,
        tool_name: item.tool.name,
        position,
        score: Math.round(item.overallScore * 100) / 100,
        tier: calculateTier(position),
        factor_scores: item.score.factorScores,
        movement,
      };
    });

    // Save to database
    const existingRanking = await rankingsRepo.getByPeriod(period);
    if (existingRanking) {
      await rankingsRepo.update(existingRanking.id, {
        algorithm_version: "v6.0",
        data: {
          rankings,
          generated_at: new Date().toISOString(),
          tools_count: tools.length,
          algorithm_info: RankingEngineV6.getAlgorithmInfo(),
        },
      });
    } else {
      await rankingsRepo.create({
        period,
        algorithm_version: "v6.0",
        is_current: false,
        data: {
          rankings,
          generated_at: new Date().toISOString(),
          tools_count: tools.length,
          algorithm_info: RankingEngineV6.getAlgorithmInfo(),
        },
      });
    }

    // Calculate statistics
    const scores = rankings.map(r => r.score);
    const stats = {
      average_score: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100,
      median_score: scores[Math.floor(scores.length / 2)] || 0,
      highest_score: Math.max(...scores),
      lowest_score: Math.min(...scores),
      std_deviation: Math.round(
        Math.sqrt(
          scores.reduce((sq, n) => {
            const diff = n - (scores.reduce((a, b) => a + b, 0) / scores.length);
            return sq + diff * diff;
          }, 0) / scores.length
        ) * 100
      ) / 100,
    };

    // Calculate change summary
    const changeSummary = {
      new_entries: rankings.filter(r => r.movement.direction === "new").length,
      moved_up: rankings.filter(r => r.movement.direction === "up").length,
      moved_down: rankings.filter(r => r.movement.direction === "down").length,
      unchanged: rankings.filter(r => r.movement.direction === "same").length,
      largest_gain: Math.max(...rankings.map(r => r.movement.direction === "up" ? r.movement.change : 0)),
      largest_drop: Math.max(...rankings.map(r => r.movement.direction === "down" ? r.movement.change : 0)),
    };

    loggers.api.info(`Rankings generated successfully for period ${period}`, {
      rankings_count: rankings.length,
      stats,
      changeSummary,
    });

    return NextResponse.json({
      success: true,
      period,
      rankings_count: rankings.length,
      algorithm_version: "v6.0",
      stats,
      change_summary: changeSummary,
      message: "Rankings generated and saved successfully",
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