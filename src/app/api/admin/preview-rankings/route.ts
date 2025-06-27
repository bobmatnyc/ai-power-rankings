import { NextRequest, NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import { loggers } from "@/lib/logger";
import { RankingEngineV6, ToolMetricsV6, ToolScoreV6 } from "@/lib/ranking-algorithm-v6";
import { RankingChangeAnalyzer, RankingChangeAnalysis } from "@/lib/ranking-change-analyzer";

interface RankingComparison {
  tool_id: string;
  tool_name: string;
  current_position?: number;
  new_position: number;
  current_score?: number;
  new_score: number;
  position_change: number;
  score_change: number;
  movement: 'up' | 'down' | 'same' | 'new' | 'dropped';
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

function transformToToolMetrics(tool: any, metrics: any[]): ToolMetricsV6 {
  // Filter metrics for this tool
  const toolMetrics = metrics.filter(m => m.tool === tool.id);
  
  // Create a metrics map for easy lookup
  const metricsMap = new Map<string, any>();
  toolMetrics.forEach(metric => {
    const value = metric.value_integer ?? 
                  metric.value_decimal ?? 
                  metric.value_text ?? 
                  metric.value_boolean ?? 
                  metric.value_json;
    metricsMap.set(metric.metric_key, value);
  });

  // Extract metrics from tool.info and metrics collection
  const info = tool.info;
  const technical = info?.technical;
  const businessMetrics = info?.metrics;
  const business = info?.business;

  return {
    tool_id: tool.id,
    status: tool.status,
    
    // Agentic capabilities
    agentic_capability: metricsMap.get("agentic_capability") || 5,
    swe_bench_score: businessMetrics?.swe_bench_score || metricsMap.get("swe_bench_score") || 0,
    multi_file_capability: metricsMap.get("multi_file_capability") || 5,
    planning_depth: metricsMap.get("planning_depth") || 5,
    context_utilization: metricsMap.get("context_utilization") || 5,

    // Technical metrics
    context_window: technical?.context_window || metricsMap.get("context_window") || 100000,
    language_support: technical?.supported_languages || metricsMap.get("language_support") || 10,
    github_stars: businessMetrics?.github_stars || metricsMap.get("github_stars") || 0,

    // Innovation metrics
    innovation_score: metricsMap.get("innovation_score") || 5,
    innovations: metricsMap.get("innovations") || [],

    // Market metrics
    estimated_users: businessMetrics?.estimated_users || metricsMap.get("estimated_users") || 0,
    monthly_arr: businessMetrics?.monthly_arr || metricsMap.get("monthly_arr") || 0,
    valuation: businessMetrics?.valuation || metricsMap.get("valuation") || 0,
    funding: businessMetrics?.funding_total || metricsMap.get("funding") || 0,
    business_model: business?.business_model || metricsMap.get("business_model") || "freemium",

    // Risk and sentiment
    business_sentiment: metricsMap.get("business_sentiment") || 5,
    risk_factors: metricsMap.get("risk_factors") || [],

    // Development metrics
    release_frequency: metricsMap.get("release_frequency") || 5,
    github_contributors: businessMetrics?.github_contributors || metricsMap.get("github_contributors") || 0,

    // Platform metrics
    llm_provider_count: metricsMap.get("llm_provider_count") || 1,
    multi_model_support: metricsMap.get("multi_model_support") || false,
    community_size: metricsMap.get("community_size") || 0,
  };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { 
      period, 
      algorithm_version = "v6.0", 
      preview_date,
      compare_with 
    } = await request.json();
    
    if (!period) {
      return NextResponse.json(
        { error: "Period parameter is required" },
        { status: 400 }
      );
    }

    const payload = await getPayload({ config });
    
    loggers.api.info(`Generating ranking preview for period: ${period}`, {
      preview_date,
      compare_with
    });

    // Determine comparison period
    let comparisonPeriod = compare_with;
    let currentRankings: any[] = [];
    
    if (compare_with === "auto" || !compare_with) {
      // Find the most recent ranking period before the preview period
      const { docs: availablePeriods } = await payload.find({
        collection: "rankings",
        where: {
          period: {
            not_equals: period,
          },
        },
        limit: 1000,
        sort: "-period",
      });
      
      const periodSet = new Set(availablePeriods.map(r => r["period"]));
      const sortedPeriods = Array.from(periodSet).sort().reverse();
      
      for (const p of sortedPeriods) {
        if (p < period) {
          comparisonPeriod = p;
          break;
        }
      }
    }

    // Get comparison rankings if available
    if (comparisonPeriod && comparisonPeriod !== "none") {
      const { docs: rankings } = await payload.find({
        collection: "rankings",
        where: {
          period: { equals: comparisonPeriod }
        },
        limit: 1000,
        sort: "position",
      });
      currentRankings = rankings;
    }

    // Fetch all active tools
    const { docs: tools } = await payload.find({
      collection: "tools",
      where: {
        status: { equals: "active" },
      },
      limit: 1000,
    });

    // Fetch latest metrics for all tools
    const { docs: metrics } = await payload.find({
      collection: "metrics",
      limit: 10000,
      sort: "-collected_at",
    });

    loggers.api.info(`Fetched ${tools.length} tools and ${metrics.length} metrics for preview`);

    const rankingEngine = new RankingEngineV6();
    const changeAnalyzer = new RankingChangeAnalyzer();
    const newScores: ToolScoreV6[] = [];

    // Calculate new scores for each tool
    for (const tool of tools) {
      try {
        const toolMetrics = transformToToolMetrics(tool, metrics);
        const score = rankingEngine.calculateToolScore(toolMetrics);
        newScores.push(score);
      } catch (error) {
        loggers.api.error(`Error calculating score for tool ${tool['name']}:`, error);
      }
    }

    // Sort by overall score (descending)
    newScores.sort((a, b) => b.overallScore - a.overallScore);

    // Create comparison data
    const comparisons: RankingComparison[] = [];
    const changeAnalyses: RankingChangeAnalysis[] = [];
    const currentRankingsMap = new Map(currentRankings.map(r => [r['tool']['id'] || r['tool'], r]));

    for (let i = 0; i < newScores.length; i++) {
      const newScore = newScores[i];
      const tool = tools.find(t => t.id === newScore?.toolId);
      if (!tool) {continue;}

      const currentRanking = currentRankingsMap.get(tool.id);
      const newPosition = i + 1;
      const currentPosition = currentRanking?.['position'];
      
      let positionChange = 0;
      let movement: RankingComparison['movement'] = 'new';
      
      if (currentPosition) {
        positionChange = currentPosition - newPosition;
        if (positionChange > 0) {
          movement = 'up';
        } else if (positionChange < 0) {
          movement = 'down';
        } else {
          movement = 'same';
        }
      }

      const scoreChange = currentRanking ? 
        (newScore!.overallScore - currentRanking['score']) : 
        newScore!.overallScore;

      // Get previous factor scores if available
      const previousFactorScores = currentRanking ? {
        agenticCapability: currentRanking['agentic_capability'] || 0,
        innovation: currentRanking['innovation'] || 0,
        technicalPerformance: currentRanking['technical_performance'] || 0,
        developerAdoption: currentRanking['developer_adoption'] || 0,
        marketTraction: currentRanking['market_traction'] || 0,
        businessSentiment: currentRanking['business_sentiment'] || 0,
        developmentVelocity: currentRanking['development_velocity'] || 0,
        platformResilience: currentRanking['platform_resilience'] || 0,
      } : undefined;

      // Generate change analysis
      const changeAnalysis = changeAnalyzer.analyzeRankingChange(
        { 
          tool_id: tool.id, 
          tool_name: tool['name'], 
          position: newPosition,
          score: newScore!.overallScore,
          new_position: newPosition,
          new_score: newScore!.overallScore
        },
        currentRanking ? {
          position: currentPosition,
          score: currentRanking['score'],
          current_position: currentPosition,
          current_score: currentRanking['score']
        } : undefined,
        newScore!.factorScores || {},
        previousFactorScores
      );

      changeAnalyses.push(changeAnalysis);

      comparisons.push({
        tool_id: String(tool.id),
        tool_name: tool['name'],
        current_position: currentPosition,
        new_position: newPosition,
        current_score: currentRanking?.['score'],
        new_score: newScore!.overallScore,
        position_change: positionChange,
        score_change: scoreChange,
        movement,
        factor_changes: {
          agentic_capability: newScore!.factorScores?.agenticCapability || 0,
          innovation: newScore!.factorScores?.innovation || 0,
          technical_performance: newScore!.factorScores?.technicalPerformance || 0,
          developer_adoption: newScore!.factorScores?.developerAdoption || 0,
          market_traction: newScore!.factorScores?.marketTraction || 0,
          business_sentiment: newScore!.factorScores?.businessSentiment || 0,
          development_velocity: newScore!.factorScores?.developmentVelocity || 0,
          platform_resilience: newScore!.factorScores?.platformResilience || 0,
        },
        change_analysis: changeAnalysis,
      });
    }

    // Find dropped tools (in current but not in new)
    for (const currentRanking of currentRankings) {
      const toolId = currentRanking['tool']['id'] || currentRanking['tool'];
      if (!comparisons.find(c => c.tool_id === toolId)) {
        const tool = tools.find(t => t.id === toolId);
        if (tool) {
          comparisons.push({
            tool_id: String(toolId),
            tool_name: tool['name'],
            current_position: currentRanking['position'],
            new_position: -1, // Indicates dropped
            current_score: currentRanking['score'],
            new_score: 0,
            position_change: -currentRanking['position'],
            score_change: -currentRanking['score'],
            movement: 'dropped',
            factor_changes: {},
          });
        }
      }
    }

    // Generate analytics
    const moversUp = comparisons
      .filter(c => c.movement === 'up')
      .sort((a, b) => b.position_change - a.position_change)
      .slice(0, 10);

    const moversDown = comparisons
      .filter(c => c.movement === 'down')
      .sort((a, b) => a.position_change - b.position_change)
      .slice(0, 10);

    const validScoreChanges = comparisons.filter(c => c.current_score !== undefined);
    const validScores = comparisons.map(c => c.new_score).filter(score => score != null && !isNaN(score));
    
    const summary = {
      tools_moved_up: comparisons.filter(c => c.movement === 'up').length,
      tools_moved_down: comparisons.filter(c => c.movement === 'down').length,
      tools_stayed_same: comparisons.filter(c => c.movement === 'same').length,
      average_score_change: validScoreChanges.length > 0 
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
      new_entries: comparisons.filter(c => c.movement === 'new').length,
      dropped_entries: comparisons.filter(c => c.movement === 'dropped').length,
      rankings_comparison: comparisons.sort((a, b) => a.new_position - b.new_position),
      top_10_changes: comparisons
        .filter(c => c.new_position <= 10 || (c.current_position && c.current_position <= 10))
        .sort((a, b) => a.new_position - b.new_position),
      biggest_movers: {
        up: moversUp,
        down: moversDown,
      },
      summary,
      change_report: changeReport,
      comparison_period: comparisonPeriod,
      is_initial_ranking: !comparisonPeriod || comparisonPeriod === "none" || currentRankings.length === 0,
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