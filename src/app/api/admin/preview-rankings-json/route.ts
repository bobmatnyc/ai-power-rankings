import { NextRequest, NextResponse } from "next/server";
import { loggers } from "@/lib/logger";
import { getToolsRepo, getRankingsRepo, getNewsRepo } from "@/lib/json-db";
import { RankingEngineV6, ToolMetricsV6 } from "@/lib/ranking-algorithm-v6";

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

interface ExtractedMetrics {
  swe_bench_score?: number;
  funding?: number;
  valuation?: number;
  monthly_arr?: number;
  estimated_users?: number;
}

function extractMetricsFromNews(
  toolId: string,
  newsArticles: any[],
  previewDate?: string
): ExtractedMetrics {
  const metrics: ExtractedMetrics = {};

  // Filter articles that mention this tool
  let toolArticles = newsArticles.filter((article) => article.tool_mentions?.includes(toolId));

  // If previewDate is provided, only include articles published before that date
  if (previewDate) {
    const cutoffDate = new Date(previewDate);
    const beforeFilter = toolArticles.length;
    toolArticles = toolArticles.filter((article) => {
      const articleDate = new Date(article.published_date);
      return articleDate <= cutoffDate;
    });
    const afterFilter = toolArticles.length;

    if (beforeFilter !== afterFilter) {
      loggers.api.info(
        `Tool ${toolId}: Filtered from ${beforeFilter} to ${afterFilter} articles (cutoff: ${previewDate})`
      );
    }
  }

  for (const article of toolArticles) {
    const content = article.content?.toLowerCase() || "";
    const title = article.title?.toLowerCase() || "";
    const combined = `${title} ${content}`;

    // Extract SWE-bench scores
    const sweBenchMatch = combined.match(/(\d+\.?\d*)\s*%?\s*(?:on\s+)?swe[- ]bench/i);
    if (sweBenchMatch && sweBenchMatch[1] && !metrics.swe_bench_score) {
      metrics.swe_bench_score = parseFloat(sweBenchMatch[1]);
    }

    // Extract valuation
    const valuationMatch = combined.match(/(\d+\.?\d*)\s*billion\s*(?:dollar\s*)?valuation/i);
    if (valuationMatch && valuationMatch[1] && !metrics.valuation) {
      metrics.valuation = parseFloat(valuationMatch[1]) * 1_000_000_000;
    }

    // Extract funding
    const fundingMatch = combined.match(/raised?\s*\$?(\d+\.?\d*)\s*(million|billion)/i);
    if (fundingMatch && fundingMatch[1] && fundingMatch[2] && !metrics.funding) {
      const amount = parseFloat(fundingMatch[1]);
      const multiplier = fundingMatch[2].toLowerCase() === "billion" ? 1_000_000_000 : 1_000_000;
      metrics.funding = amount * multiplier;
    }

    // Extract ARR
    const arrMatch = combined.match(/\$?(\d+\.?\d*)\s*[mb]\s*arr/i);
    if (arrMatch && arrMatch[1] && !metrics.monthly_arr) {
      const amount = parseFloat(arrMatch[1]);
      const multiplier = combined.match(/b\s*arr/i) ? 1_000_000_000 : 1_000_000;
      // Convert annual to monthly
      metrics.monthly_arr = (amount * multiplier) / 12;
    }

    // Extract users
    const usersMatch = combined.match(/(\d+\.?\d*)\s*[km]?\s*users/i);
    if (usersMatch && usersMatch[1] && !metrics.estimated_users) {
      const amount = parseFloat(usersMatch[1]);
      let multiplier = 1;
      if (combined.match(/\d+\.?\d*\s*k\s*users/i)) {
        multiplier = 1_000;
      }
      if (combined.match(/\d+\.?\d*\s*m\s*users/i)) {
        multiplier = 1_000_000;
      }
      metrics.estimated_users = amount * multiplier;
    }
  }

  return metrics;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { period, algorithm_version = "v6.0", compare_with, preview_date } = body;

    loggers.api.info("Preview rankings JSON request received", { body });

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

    for (const tool of tools) {
      // Extract real metrics from news
      const extractedMetrics = extractMetricsFromNews(tool.id, newsArticles, preview_date);

      // Log extracted metrics for debugging
      if (Object.keys(extractedMetrics).length > 0) {
        loggers.api.info(`Extracted metrics for ${tool.name}: ${JSON.stringify(extractedMetrics)}`);
      }

      // Convert tool data to metrics format expected by algorithm
      // Use category and name to assign more realistic default values
      const isAutonomous = tool.category === "autonomous-agent";
      const isOpenSource = tool.category === "open-source-framework";
      const isEnterprise = tool.info.business?.pricing_model === "enterprise";
      const isPremium = ["Devin", "Claude Code", "Google Jules", "Cursor"].includes(tool.name);

      const metrics: ToolMetricsV6 = {
        tool_id: tool.id,
        status: tool.status,
        // Agentic metrics - use extracted SWE-bench score if available
        agentic_capability: isAutonomous ? 8.5 : tool.category === "ide-assistant" ? 6 : 5,
        swe_bench_score:
          extractedMetrics.swe_bench_score ||
          tool.info.metrics?.swe_bench_score ||
          (isPremium ? 45 : isAutonomous ? 35 : 20),
        multi_file_capability: isAutonomous ? 9 : tool.info.technical?.multi_file_support ? 7 : 4,
        planning_depth: isAutonomous ? 8.5 : 6,
        context_utilization: isPremium ? 8 : 6.5,
        // Technical metrics
        context_window: tool.info.technical?.context_window || (isPremium ? 200000 : 100000),
        language_support: tool.info.technical?.supported_languages || (isEnterprise ? 20 : 15),
        github_stars: tool.info.metrics?.github_stars || (isOpenSource ? 25000 : 5000),
        // Innovation metrics
        innovation_score: isPremium ? 8.5 : 6.5,
        innovations: [], // Would need external data
        // Market metrics - use extracted values from news
        estimated_users:
          extractedMetrics.estimated_users ||
          tool.info.metrics?.estimated_users ||
          (isPremium ? 500000 : isOpenSource ? 100000 : 50000),
        monthly_arr:
          extractedMetrics.monthly_arr ||
          tool.info.metrics?.monthly_arr ||
          (isEnterprise ? 10000000 : isPremium ? 5000000 : 1000000),
        valuation:
          extractedMetrics.valuation ||
          tool.info.metrics?.valuation ||
          (isPremium ? 1000000000 : 100000000),
        funding:
          extractedMetrics.funding ||
          tool.info.metrics?.funding_total ||
          (isPremium ? 100000000 : 10000000),
        business_model: tool.info.business?.business_model || "saas",
        // Risk and sentiment
        business_sentiment: isPremium ? 0.8 : 0.7,
        risk_factors: [], // Would need external data
        // Development metrics
        release_frequency: isOpenSource ? 7 : 14, // Open source releases more frequently
        github_contributors: tool.info.metrics?.github_contributors || (isOpenSource ? 200 : 50),
        // Platform metrics
        llm_provider_count: isPremium ? 5 : 3,
        multi_model_support: isPremium || isOpenSource,
        community_size: tool.info.metrics?.estimated_users || (isOpenSource ? 50000 : 10000),
      };

      // Calculate score using the actual algorithm
      const scoreResult = rankingEngine.calculateToolScore(metrics);
      scoredTools.push({
        tool,
        score: scoreResult.overallScore * 10, // Convert from 0-10 to 0-100 scale
      });
    }

    // Sort by score descending
    scoredTools.sort((a, b) => b.score - a.score);

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
