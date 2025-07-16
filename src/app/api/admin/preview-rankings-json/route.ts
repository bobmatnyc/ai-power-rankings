import path from "node:path";
import fs from "fs-extra";
import { type NextRequest, NextResponse } from "next/server";
import { getNewsRepo, getRankingsRepo, getToolsRepo } from "@/lib/json-db";
import { loggers } from "@/lib/logger";
import { RankingEngineV6, type ToolMetricsV6 } from "@/lib/ranking-algorithm-v6";
import {
  applyEnhancedNewsMetrics,
  applyNewsImpactToScores,
  extractEnhancedNewsMetrics,
} from "@/lib/ranking-news-enhancer";

// Helper function to update progress
async function updateProgress(message: string, tool?: string, step?: string) {
  try {
    await fetch(
      `${process.env["NEXT_PUBLIC_BASE_URL"] || "http://localhost:3000"}/api/admin/ranking-progress`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, tool, step }),
      }
    );
  } catch (_error) {
    // Ignore progress update errors
  }
}

interface RankingComparison {
  tool_id: string;
  tool_name: string;
  current_position?: number;
  new_position: number;
  current_score?: number;
  new_score: number;
  position_change: number;
  score_change: number;
  movement: "up" | "down" | "same" | "new" | "dropped";
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { period, algorithm_version = "v6.0", compare_with, preview_date } = body;

    loggers.api.info("Preview rankings JSON request received", { body });

    // Initialize progress
    await updateProgress("Initializing ranking generation...", "", "setup");

    if (!period) {
      return NextResponse.json({ error: "Period parameter is required" }, { status: 400 });
    }

    // For now, return a simplified preview using existing data
    const toolsRepo = getToolsRepo();
    const rankingsRepo = getRankingsRepo();

    // Get comparison period
    let comparisonPeriod = compare_with;
    let currentRankings: any[] = [];

    if (compare_with === "auto" || !compare_with) {
      const availablePeriods = await rankingsRepo.getPeriods();
      for (const p of availablePeriods) {
        if (p < period) {
          comparisonPeriod = p;
          break;
        }
      }
    }

    // Get current rankings if available
    if (comparisonPeriod && comparisonPeriod !== "none") {
      const periodData = await rankingsRepo.getRankingsForPeriod(comparisonPeriod);
      if (periodData) {
        currentRankings = periodData.rankings;
      }
    }

    // Get all active tools
    let tools = await toolsRepo.getByStatus("active");

    // If preview_date is provided, filter tools that didn't exist yet
    if (preview_date) {
      const cutoffDate = new Date(preview_date);
      const beforeFilter = tools.length;
      loggers.api.info(
        `Filtering tools for preview date: ${preview_date} (cutoff: ${cutoffDate.toISOString()})`
      );

      // Log a few tool dates for debugging
      const sampleTools = tools.slice(0, 5).map((t) => ({
        name: t.name,
        launch_date: t.launch_date,
        created_at: t.created_at,
        effective_date: t.launch_date || t.created_at,
        date: new Date(t.launch_date || t.created_at).toISOString(),
      }));
      loggers.api.info("Sample tool dates:", { sampleTools });

      tools = tools.filter((tool) => {
        // Use launch_date if available, otherwise fall back to created_at
        const toolDateStr = tool.launch_date || tool.created_at;
        const toolDate = new Date(toolDateStr);
        const shouldInclude = toolDate <= cutoffDate;

        // Log specific tools for debugging
        if (tool.name === "Google Jules" || tool.name === "Claude Code") {
          loggers.api.info(
            `Tool ${tool.name}: ${tool.launch_date ? "launch" : "created"} ${toolDateStr}, cutoff ${preview_date}, include: ${shouldInclude}`
          );
        }

        return shouldInclude;
      });
      const afterFilter = tools.length;

      loggers.api.info(
        `Filtered tools from ${beforeFilter} to ${afterFilter} based on launch/creation date`
      );
    }

    // Get news articles for metrics extraction
    const newsRepo = getNewsRepo();
    const newsArticles = await newsRepo.getAll();

    loggers.api.info(`Found ${newsArticles.length} news articles for metrics extraction`);

    // Log preview date if provided
    if (preview_date) {
      loggers.api.info(`Filtering news articles to those published before ${preview_date}`);

      // Count articles before the preview date
      const cutoffDate = new Date(preview_date);
      const filteredCount = newsArticles.filter((article) => {
        const articleDate = new Date(article.published_date);
        return articleDate <= cutoffDate;
      }).length;

      loggers.api.info(`${filteredCount} articles are before the preview date`);
    }

    // Initialize ranking engine
    const rankingEngine = new RankingEngineV6();

    // Calculate real scores for all tools
    const scoredTools: Array<{ tool: any; score: number }> = [];

    // Get innovation scores
    const innovationScoresPath = path.join(process.cwd(), "data", "json", "innovation-scores.json");
    let innovationScores: any[] = [];
    try {
      if (await fs.pathExists(innovationScoresPath)) {
        innovationScores = await fs.readJson(innovationScoresPath);
      }
    } catch (error) {
      loggers.api.warn("Failed to load innovation scores", { error });
    }
    const innovationMap = new Map(innovationScores.map((s: any) => [s.tool_id, s]));

    for (let i = 0; i < tools.length; i++) {
      const tool = tools[i];

      if (!tool) {
        console.warn(`Tool at index ${i} is undefined, skipping`);
        continue;
      }

      // Update progress
      await updateProgress(
        `Processing ${tool.name} (${i + 1}/${tools.length})`,
        tool.name,
        "extracting metrics"
      );

      // Get innovation score for this tool
      const innovationData = innovationMap.get(tool.id);
      const innovationScore = innovationData?.score || 0;

      // Extract enhanced metrics from news (quantitative + qualitative with AI)
      const enableAI = process.env.ENABLE_AI_NEWS_ANALYSIS !== "false"; // Default to true
      const enhancedMetrics = await extractEnhancedNewsMetrics(
        tool.id,
        tool.name,
        newsArticles,
        preview_date,
        enableAI
      );

      // Log extracted metrics for debugging
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

      // Convert tool data to metrics format expected by algorithm
      const isAutonomous = tool.category === "autonomous-agent";
      const isOpenSource = tool.category === "open-source-framework";
      const isEnterprise = tool.info.business?.pricing_model === "enterprise";
      const isPremium = ["Devin", "Claude Code", "Google Jules", "Cursor"].includes(tool.name);

      let metrics: ToolMetricsV6 = {
        tool_id: tool.id,
        status: tool.status,
        // Agentic metrics
        agentic_capability: isAutonomous ? 8.5 : tool.category === "ide-assistant" ? 6 : 5,
        swe_bench_score:
          tool.info.metrics?.swe_bench_score || (isPremium ? 45 : isAutonomous ? 35 : 20),
        multi_file_capability: isAutonomous ? 9 : tool.info.technical?.multi_file_support ? 7 : 4,
        planning_depth: isAutonomous ? 8.5 : 6,
        context_utilization: isPremium ? 8 : 6.5,
        // Technical metrics
        context_window: tool.info.technical?.context_window || (isPremium ? 200000 : 100000),
        language_support: tool.info.technical?.supported_languages || (isEnterprise ? 20 : 15),
        github_stars: tool.info.metrics?.github_stars || (isOpenSource ? 25000 : 5000),
        // Innovation metrics
        innovation_score: innovationScore || (isPremium ? 8.5 : 6.5),
        innovations: [],
        // Market metrics
        estimated_users:
          tool.info.metrics?.estimated_users ||
          (isPremium ? 500000 : isOpenSource ? 100000 : 50000),
        monthly_arr:
          tool.info.metrics?.monthly_arr ||
          (isEnterprise ? 10000000 : isPremium ? 5000000 : 1000000),
        valuation: tool.info.metrics?.valuation || (isPremium ? 1000000000 : 100000000),
        funding: tool.info.metrics?.funding_total || (isPremium ? 100000000 : 10000000),
        business_model: tool.info.business?.business_model || "saas",
        // Risk and sentiment
        business_sentiment: isPremium ? 0.8 : 0.7,
        risk_factors: [],
        // Development metrics
        release_frequency: isOpenSource ? 7 : 14,
        github_contributors: tool.info.metrics?.github_contributors || (isOpenSource ? 200 : 50),
        // Platform metrics
        llm_provider_count: isPremium ? 5 : 3,
        multi_model_support: isPremium || isOpenSource,
        community_size: tool.info.metrics?.estimated_users || (isOpenSource ? 50000 : 10000),
      };

      // Apply enhanced news metrics (both quantitative and qualitative)
      metrics = applyEnhancedNewsMetrics(metrics, enhancedMetrics);

      // Update progress
      await updateProgress(
        `Calculating scores for ${tool.name} (${i + 1}/${tools.length})`,
        tool.name,
        "calculating score"
      );

      // Calculate score using the actual algorithm
      const scoreResult = rankingEngine.calculateToolScore(metrics);

      // Apply additional news impact to factor scores
      const adjustedFactorScores = applyNewsImpactToScores(
        scoreResult.factorScores,
        enhancedMetrics
      );

      // Update factorScores with adjusted values
      Object.keys(adjustedFactorScores).forEach((key) => {
        if (key in scoreResult.factorScores) {
          (scoreResult.factorScores as any)[key] = adjustedFactorScores[key];
        }
      });

      // Recalculate overall score after news adjustments
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

      scoredTools.push({
        tool,
        score: scoreResult.overallScore * 10, // Convert from 0-10 to 0-100 scale
      });
    }

    // Sort by score descending
    scoredTools.sort((a, b) => b.score - a.score);

    // Update progress
    await updateProgress("Generating ranking comparisons...", "", "final calculations");

    // Generate comparisons with real rankings
    const comparisons: RankingComparison[] = [];
    const currentRankingsMap = new Map(currentRankings.map((r) => [r.tool_id, r]));

    scoredTools.forEach((item, index) => {
      const { tool, score } = item;
      const currentRanking = currentRankingsMap.get(tool.id);
      const newPosition = index + 1;
      const currentPosition = currentRanking?.position;
      const newScore = score;
      const currentScore = currentRanking?.score;

      let positionChange = 0;
      let movement: RankingComparison["movement"] = "new";

      if (currentPosition) {
        positionChange = currentPosition - newPosition;
        if (positionChange > 0) {
          movement = "up";
        } else if (positionChange < 0) {
          movement = "down";
        } else {
          movement = "same";
        }
      }

      const scoreChange = currentScore ? newScore - currentScore : newScore;

      comparisons.push({
        tool_id: tool.id,
        tool_name: tool.name,
        current_position: currentPosition,
        new_position: newPosition,
        current_score: currentScore,
        new_score: newScore,
        position_change: positionChange,
        score_change: scoreChange,
        movement,
      });
    });

    // Generate summary
    const summary = {
      tools_moved_up: comparisons.filter((c) => c.movement === "up").length,
      tools_moved_down: comparisons.filter((c) => c.movement === "down").length,
      tools_stayed_same: comparisons.filter((c) => c.movement === "same").length,
      average_score_change:
        comparisons.reduce((sum, c) => sum + c.score_change, 0) / comparisons.length,
      highest_score: Math.max(...comparisons.map((c) => c.new_score)),
      lowest_score: Math.min(...comparisons.map((c) => c.new_score)),
    };

    const result = {
      period,
      algorithm_version,
      total_tools: tools.length,
      new_entries: comparisons.filter((c) => c.movement === "new").length,
      dropped_entries: 0,
      rankings_comparison: comparisons,
      top_10_changes: comparisons.slice(0, 10),
      biggest_movers: {
        up: comparisons
          .filter((c) => c.movement === "up")
          .sort((a, b) => b.position_change - a.position_change)
          .slice(0, 5),
        down: comparisons
          .filter((c) => c.movement === "down")
          .sort((a, b) => a.position_change - b.position_change)
          .slice(0, 5),
      },
      summary,
      comparison_period: comparisonPeriod,
      is_initial_ranking: !comparisonPeriod || currentRankings.length === 0,
    };

    loggers.api.info("Preview rankings generated", {
      period,
      total_tools: result.total_tools,
    });

    return NextResponse.json({
      success: true,
      preview: result,
    });
  } catch (error) {
    loggers.api.error("Failed to generate preview rankings", { error });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
