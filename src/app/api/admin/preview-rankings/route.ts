import { type NextRequest, NextResponse } from "next/server";
import { getNewsRepo, getRankingsRepo, getToolsRepo } from "@/lib/json-db";
import { loggers } from "@/lib/logger";
import { RankingEngineV6, type ToolMetricsV6, type ToolScoreV6 } from "@/lib/ranking-algorithm-v6";
import { type RankingChangeAnalysis, RankingChangeAnalyzer } from "@/lib/ranking-change-analyzer";
import { applyEnhancedNewsMetrics, extractEnhancedNewsMetrics } from "@/lib/ranking-news-enhancer";

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
  factor_changes: {
    agentic_capability?: number;
    innovation?: number;
    technical_performance?: number;
    developer_adoption?: number;
    market_traction?: number;
    business_sentiment?: number;
    development_velocity?: number;
    platform_resilience?: number;
  };
  change_analysis?: RankingChangeAnalysis;
}

interface PreviewResult {
  period: string;
  algorithm_version: string;
  total_tools: number;
  new_entries: number;
  dropped_entries: number;
  rankings_comparison: RankingComparison[];
  top_10_changes: RankingComparison[];
  biggest_movers: {
    up: RankingComparison[];
    down: RankingComparison[];
  };
  summary: {
    tools_moved_up: number;
    tools_moved_down: number;
    tools_stayed_same: number;
    average_score_change: number;
    highest_score: number;
    lowest_score: number;
  };
  change_report?: {
    summary: string;
    majorMovers: {
      rises: RankingChangeAnalysis[];
      declines: RankingChangeAnalysis[];
    };
    factorTrends: Record<string, { improving: number; declining: number }>;
    narrativeSummary: string;
  };
}

// This function is identical to the one in build/route.ts
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

function transformToToolMetrics(tool: any, innovationScore: number = 0): ToolMetricsV6 {
  // Extract metrics from tool.info structure (JSON format)
  const info = tool["info"];
  const technical = info?.technical || {};
  const businessMetrics = info?.metrics || {};
  const business = info?.business || {};

  return {
    tool_id: tool["id"],
    status: tool["status"],

    // Agentic capabilities based on category and tool specifics
    agentic_capability: getCategoryBasedAgenticScore(tool["category"], tool["name"]),
    swe_bench_score: businessMetrics["swe_bench_score"] || 0,
    multi_file_capability: technical["multi_file_support"] ? 75 : 25,
    planning_depth: technical["planning_capability"] || 5,
    context_utilization: technical["context_utilization"] || 5,

    // Technical metrics
    context_window: technical["context_window"] || 100000,
    language_support: technical["supported_languages"] || 10,
    github_stars: businessMetrics["github_stars"] || 0,

    // Innovation metrics
    innovation_score: innovationScore,
    innovations: [],

    // Market metrics
    estimated_users: businessMetrics["estimated_users"] || 0,
    monthly_arr: businessMetrics["monthly_arr"] || 0,
    valuation: businessMetrics["valuation"] || 0,
    funding: businessMetrics["funding_total"] || 0,
    business_model: business["business_model"] || "freemium",

    // Risk and sentiment (default neutral)
    business_sentiment: 5, // Neutral 0-10 scale
    risk_factors: [],

    // Development metrics
    release_frequency: 5, // Neutral default
    github_contributors: businessMetrics["github_contributors"] || 0,

    // Platform metrics
    llm_provider_count: 1,
    multi_model_support: technical["multi_model_support"] || false,
    community_size: businessMetrics["community_size"] || 0,
  };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { period, algorithm_version = "v6.0", preview_date, compare_with } = body;

    loggers.api.info("Preview rankings request received", { body });

    if (!period) {
      return NextResponse.json({ error: "Period parameter is required" }, { status: 400 });
    }

    const toolsRepo = getToolsRepo();
    const rankingsRepo = getRankingsRepo();

    loggers.api.info(`Generating ranking preview for period: ${period}`, {
      preview_date,
      compare_with,
    });

    // Determine comparison period
    let comparisonPeriod = compare_with;
    let currentRankings: any[] = [];

    if (compare_with === "auto" || !compare_with) {
      // Find the most recent ranking period before the preview period
      try {
        const availablePeriods = await rankingsRepo.getPeriods();
        loggers.api.info(`Available periods: ${availablePeriods.join(", ")}`);

        for (const p of availablePeriods) {
          if (p < period) {
            comparisonPeriod = p;
            break;
          }
        }
        loggers.api.info(`Selected comparison period: ${comparisonPeriod || "none"}`);
      } catch (error) {
        loggers.api.error("Failed to get periods", { error });
      }
    }

    // Get comparison rankings if available
    if (comparisonPeriod && comparisonPeriod !== "none") {
      const periodData = await rankingsRepo.getRankingsForPeriod(comparisonPeriod);
      if (periodData) {
        currentRankings = periodData.rankings;
      }
    }

    // Fetch all active tools
    let tools = [];
    try {
      tools = await toolsRepo.getByStatus("active");
      loggers.api.info(`Fetched ${tools.length} active tools`);

      // If preview_date is provided, filter tools that didn't exist yet
      if (preview_date) {
        const cutoffDate = new Date(preview_date);
        const beforeFilter = tools.length;
        tools = tools.filter((tool) => {
          // Use launch_date if available, otherwise fall back to created_at
          const toolDate = tool["launch_date"]
            ? new Date(tool["launch_date"])
            : new Date(tool["created_at"]);
          return toolDate <= cutoffDate;
        });
        const afterFilter = tools.length;

        if (beforeFilter !== afterFilter) {
          loggers.api.info(
            `Filtered tools from ${beforeFilter} to ${afterFilter} based on launch/creation date (cutoff: ${preview_date})`
          );
        }
      }
    } catch (error) {
      loggers.api.error("Failed to fetch tools", { error });
      throw new Error("Failed to fetch tools");
    }

    // Load innovation scores (same as build endpoint)
    const innovationScores: any[] = [];
    try {
      const fs = await import("fs-extra");
      const path = await import("node:path");
      const innovationPath = path.join(process.cwd(), "data", "json", "innovation-scores.json");
      if (await fs.pathExists(innovationPath)) {
        const innovationData = await fs.readJSON(innovationPath);
        innovationScores.push(...innovationData);
      }
    } catch (error) {
      loggers.api.warn("Failed to load innovation scores", { error });
    }
    const innovationMap = new Map(innovationScores.map((s: any) => [s.tool_id, s]));

    // Get news articles for metrics extraction (same as build endpoint)
    const newsRepo = getNewsRepo();
    const newsArticles = await newsRepo.getAll();
    loggers.api.info(`Found ${newsArticles.length} news articles for metrics extraction`);

    loggers.api.info(`Processing ${tools.length} tools for preview with enhanced news analysis`);

    const rankingEngine = new RankingEngineV6();
    const changeAnalyzer = new RankingChangeAnalyzer();
    const newScores: ToolScoreV6[] = [];

    // Calculate new scores for each tool (IDENTICAL to build endpoint)
    for (const tool of tools) {
      try {
        // Get innovation score for this tool
        const innovationData = innovationMap.get(tool["id"]);
        const innovationScore = innovationData?.["score"] || 0;

        // Extract enhanced metrics from news (quantitative + qualitative with AI)
        const enableAI = process.env["ENABLE_AI_NEWS_ANALYSIS"] !== "false"; // Default to true
        const enhancedMetrics = await extractEnhancedNewsMetrics(
          tool["id"],
          tool["name"],
          newsArticles,
          preview_date,
          enableAI
        );

        // Log extracted metrics for premium tools
        if (
          ["Devin", "Claude Code", "Google Jules", "Cursor"].includes(tool["name"]) &&
          (Object.keys(enhancedMetrics).length > 0 || enhancedMetrics["articlesProcessed"] > 0)
        ) {
          loggers.api.info(`Enhanced metrics for ${tool["name"]}:`, {
            quantitative: {
              swe_bench: enhancedMetrics["swe_bench_score"],
              funding: enhancedMetrics["funding"],
              users: enhancedMetrics["estimated_users"],
            },
            qualitative: {
              innovation_boost: enhancedMetrics["innovationBoost"],
              sentiment_adjust: enhancedMetrics["businessSentimentAdjust"],
              velocity_boost: enhancedMetrics["developmentVelocityBoost"],
            },
            articles_processed: enhancedMetrics["articlesProcessed"],
            significant_events: enhancedMetrics["significantEvents"],
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
        const { applyNewsImpactToScores } = await import("@/lib/ranking-news-enhancer");
        const adjustedFactorScores = applyNewsImpactToScores(score["factorScores"], enhancedMetrics);

        // Update the score's factor scores with the adjustments
        score["factorScores"] = {
          ...score["factorScores"],
          technicalPerformance:
            adjustedFactorScores["technicalPerformance"] || score.factorScores["technicalPerformance"],
          marketTraction: adjustedFactorScores["marketTraction"] || score.factorScores["marketTraction"],
        };

        // Recalculate overall score after news adjustments
        const weights = RankingEngineV6.getAlgorithmInfo().weights;
        score["overallScore"] = Object.entries(weights).reduce((total, [factor, weight]) => {
          const factorScore = score["factorScores"][factor as keyof typeof score["factorScores"]] || 0;
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

    // Sort by overall score (descending)
    newScores.sort((a, b) => b.overallScore - a.overallScore);

    // Create comparison data
    const comparisons: RankingComparison[] = [];
    const changeAnalyses: RankingChangeAnalysis[] = [];
    const currentRankingsMap = new Map(currentRankings.map((r) => [r.tool_id, r]));

    for (let i = 0; i < newScores.length; i++) {
      const newScore = newScores[i];
      const tool = tools.find((t) => t["id"] === newScore?.["toolId"]);
      if (!tool) {
        continue;
      }

      const currentRanking = currentRankingsMap.get(tool["id"]);
      const newPosition = i + 1;
      const currentPosition = currentRanking?.position;

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

      const scoreChange = currentRanking
        ? (newScore?.["overallScore"] || 0) - currentRanking["score"]
        : newScore?.["overallScore"] || 0;

      // Get previous factor scores if available
      const previousFactorScores = currentRanking?.factor_scores
        ? {
            agenticCapability: currentRanking.factor_scores["agentic_capability"] || 0,
            innovation: currentRanking.factor_scores["innovation"] || 0,
            technicalPerformance: currentRanking.factor_scores["technical_performance"] || 0,
            developerAdoption: currentRanking.factor_scores["developer_adoption"] || 0,
            marketTraction: currentRanking.factor_scores["market_traction"] || 0,
            businessSentiment: currentRanking.factor_scores["business_sentiment"] || 0,
            developmentVelocity: currentRanking.factor_scores["development_velocity"] || 0,
            platformResilience: currentRanking.factor_scores["platform_resilience"] || 0,
          }
        : undefined;

      // Generate change analysis
      const changeAnalysis = changeAnalyzer.analyzeRankingChange(
        {
          tool_id: tool["id"],
          tool_name: tool["name"],
          position: newPosition,
          score: newScore?.["overallScore"],
          new_position: newPosition,
          new_score: newScore?.["overallScore"],
        },
        currentRanking
          ? {
              tool_id: tool["id"],
              tool_name: tool["name"],
              position: currentPosition,
              score: currentRanking["score"],
              current_position: currentPosition,
              current_score: currentRanking["score"],
            }
          : null,
        newScore?.["factorScores"] || {},
        previousFactorScores
      );

      changeAnalyses.push(changeAnalysis);

      comparisons.push({
        tool_id: String(tool["id"]),
        tool_name: tool["name"],
        current_position: currentPosition,
        new_position: newPosition,
        current_score: currentRanking?.score,
        new_score: newScore?.["overallScore"] || 0,
        position_change: positionChange,
        score_change: scoreChange || 0,
        movement,
        factor_changes: {
          agentic_capability: newScore?.["factorScores"]?.["agenticCapability"] || 0,
          innovation: newScore?.["factorScores"]?.["innovation"] || 0,
          technical_performance: newScore?.["factorScores"]?.["technicalPerformance"] || 0,
          developer_adoption: newScore?.["factorScores"]?.["developerAdoption"] || 0,
          market_traction: newScore?.["factorScores"]?.["marketTraction"] || 0,
          business_sentiment: newScore?.["factorScores"]?.["businessSentiment"] || 0,
          development_velocity: newScore?.["factorScores"]?.["developmentVelocity"] || 0,
          platform_resilience: newScore?.["factorScores"]?.["platformResilience"] || 0,
        },
        change_analysis: changeAnalysis,
      });
    }

    // Find dropped tools (in current but not in new)
    for (const currentRanking of currentRankings) {
      const toolId = currentRanking["tool_id"];
      if (!comparisons.find((c) => c.tool_id === toolId)) {
        comparisons.push({
          tool_id: String(toolId),
          tool_name: currentRanking["tool_name"],
          current_position: currentRanking["position"],
          new_position: -1, // Indicates dropped
          current_score: currentRanking["score"],
          new_score: 0,
          position_change: -currentRanking["position"],
          score_change: -currentRanking["score"],
          movement: "dropped",
          factor_changes: {},
        });
      }
    }

    // Generate analytics
    const moversUp = comparisons
      .filter((c) => c.movement === "up")
      .sort((a, b) => b.position_change - a.position_change)
      .slice(0, 10);

    const moversDown = comparisons
      .filter((c) => c.movement === "down")
      .sort((a, b) => a.position_change - b.position_change)
      .slice(0, 10);

    const validScoreChanges = comparisons.filter((c) => c.current_score !== undefined);
    const validScores = comparisons
      .map((c) => c.new_score)
      .filter((score) => score !== null && !Number.isNaN(score));

    const summary = {
      tools_moved_up: comparisons.filter((c) => c.movement === "up").length,
      tools_moved_down: comparisons.filter((c) => c.movement === "down").length,
      tools_stayed_same: comparisons.filter((c) => c.movement === "same").length,
      average_score_change:
        validScoreChanges.length > 0
          ? validScoreChanges.reduce((sum, c) => sum + c.score_change, 0) / validScoreChanges.length
          : 0,
      highest_score: validScores.length > 0 ? Math.max(...validScores) : 0,
      lowest_score: validScores.length > 0 ? Math.min(...validScores) : 0,
    };

    // Generate overall change report
    const changeReport = changeAnalyzer.generateChangeReport(changeAnalyses);

    const result: PreviewResult = {
      period,
      algorithm_version,
      total_tools: newScores.length,
      new_entries: comparisons.filter((c) => c.movement === "new").length,
      dropped_entries: comparisons.filter((c) => c.movement === "dropped").length,
      rankings_comparison: comparisons.sort((a, b) => a.new_position - b.new_position),
      top_10_changes: comparisons
        .filter((c) => c.new_position <= 10 || (c.current_position && c.current_position <= 10))
        .sort((a, b) => a.new_position - b.new_position),
      biggest_movers: {
        up: moversUp,
        down: moversDown,
      },
      summary,
      change_report: changeReport,
      comparison_period: comparisonPeriod,
      is_initial_ranking:
        !comparisonPeriod || comparisonPeriod === "none" || currentRankings.length === 0,
    } as any;

    loggers.api.info("Ranking preview generated successfully", {
      period,
      total_tools: result.total_tools,
      new_entries: result.new_entries,
      biggest_move_up: moversUp[0]?.position_change || 0,
      biggest_move_down: moversDown[0]?.position_change || 0,
    });

    return NextResponse.json({
      success: true,
      preview: result,
    });
  } catch (error) {
    loggers.api.error("Failed to generate ranking preview:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
