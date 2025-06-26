import { NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import { RankingEngineV6, ToolMetricsV6, ToolScoreV6 } from "@/lib/ranking-algorithm-v6";
import { logger } from "@/lib/logger";

interface PayloadTool {
  id: string;
  name: string;
  slug: string;
  status: string;
  category: string;
  supabase_tool_id?: string;
  display_name?: string;
  company: {
    id: string;
    name: string;
  };
  info?: {
    product?: {
      description?: string;
      pricing?: any;
      features?: any;
    };
    technical?: {
      context_window?: number;
      supported_languages?: number;
      github_url?: string;
    };
    metrics?: {
      github_stars?: number;
      github_contributors?: number;
      estimated_users?: number;
      monthly_arr?: number;
      valuation?: number;
      funding_total?: number;
      swe_bench_score?: number;
    };
    business?: {
      business_model?: string;
      pricing_model?: string;
    };
  };
}

interface PayloadMetric {
  id: string;
  tool: string;
  metric_key: string;
  value_integer?: number;
  value_decimal?: number;
  value_text?: string;
  value_boolean?: boolean;
  value_json?: any;
  unit?: string;
  source: string;
  collected_at: string;
}

function transformToToolMetrics(tool: PayloadTool, metrics: PayloadMetric[]): ToolMetricsV6 {
  // Filter metrics for this tool
  const toolMetrics = metrics.filter((m) => m.tool === tool.id);

  // Create a metrics map for easy lookup
  const metricsMap = new Map<string, any>();
  toolMetrics.forEach((metric) => {
    const value =
      metric.value_integer ??
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
    github_contributors:
      businessMetrics?.github_contributors || metricsMap.get("github_contributors") || 0,

    // Platform metrics
    llm_provider_count: metricsMap.get("llm_provider_count") || 1,
    multi_model_support: metricsMap.get("multi_model_support") || false,
    community_size: metricsMap.get("community_size") || 0,
  };
}

export async function POST() {
  try {
    logger.info("Starting rankings generation with Payload CMS via API");

    const payload = await getPayload({ config });

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

    logger.info(`Fetched ${tools.length} tools and ${metrics.length} metrics`);

    const rankingEngine = new RankingEngineV6();
    const scores: ToolScoreV6[] = [];

    // Calculate scores for each tool
    for (const tool of tools) {
      try {
        const toolMetrics = transformToToolMetrics(tool as PayloadTool, metrics as PayloadMetric[]);
        const score = rankingEngine.calculateToolScore(toolMetrics);
        scores.push(score);
      } catch (error) {
        logger.error(`Error calculating score for tool ${tool["name"]}:`, error);
      }
    }

    // Sort by overall score (descending)
    scores.sort((a, b) => b.overallScore - a.overallScore);

    // Store rankings in Payload
    const rankingPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM format
    
    // Get previous month's rankings for movement calculation
    const previousDate = new Date();
    previousDate.setMonth(previousDate.getMonth() - 1);
    const previousPeriod = previousDate.toISOString().slice(0, 7);
    
    const { docs: previousRankings } = await payload.find({
      collection: "rankings",
      where: {
        period: { equals: previousPeriod },
      },
      limit: 1000,
    });
    
    // Create a map of previous rankings by tool ID
    const previousRankingsMap = new Map(
      previousRankings.map(r => [
        typeof r['tool'] === 'object' ? r['tool']['id'] : r['tool'],
        r
      ])
    );

    // Clear existing rankings for this period
    const { docs: existingRankings } = await payload.find({
      collection: "rankings",
      where: {
        period: { equals: rankingPeriod },
      },
      limit: 1000,
    });

    for (const ranking of existingRankings) {
      await payload.delete({
        collection: "rankings",
        id: ranking.id,
      });
    }

    // Create new rankings
    const createdRankings = [];
    
    for (let i = 0; i < scores.length; i++) {
      const score = scores[i];
      if (!score) {
        continue;
      }
      const tool = tools.find((t) => t.id === score.toolId);

      if (!tool) {
        continue;
      }
      
      // Get previous ranking for this tool
      const previousRanking = previousRankingsMap.get(tool.id);
      const currentPosition = i + 1;
      const previousPosition = previousRanking?.['position'];
      
      // Calculate movement
      let movement: string = 'new';
      let movementPositions = 0;
      
      if (previousPosition) {
        movementPositions = previousPosition - currentPosition;
        if (movementPositions > 0) {
          movement = 'up';
        } else if (movementPositions < 0) {
          movement = 'down';
        } else {
          movement = 'same';
        }
      }

      const rankingData = {
        tool: tool.id,
        period: rankingPeriod,
        position: currentPosition,
        score: Math.round(score.overallScore * 100) / 100, // Round to 2 decimal places
        
        // Movement tracking
        previous_position: previousPosition || null,
        movement: movement,
        movement_positions: movementPositions,

        // Factor scores (map to collection field names)
        market_traction_score: Math.round((score.factorScores?.marketTraction || 0) * 100) / 100,
        technical_capability_score: Math.round((score.factorScores?.technicalPerformance || 0) * 100) / 100,
        developer_adoption_score: Math.round((score.factorScores?.developerAdoption || 0) * 100) / 100,
        development_velocity_score: Math.round((score.factorScores?.developmentVelocity || 0) * 100) / 100,
        platform_resilience_score: Math.round((score.factorScores?.platformResilience || 0) * 100) / 100,
        community_sentiment_score: Math.round((score.factorScores?.businessSentiment || 0) * 100) / 100,
        
        // Store additional v6 factors in appropriate fields
        agentic_capability: Math.round((score.factorScores?.agenticCapability || 0) * 100) / 100,
        innovation: Math.round((score.factorScores?.innovation || 0) * 100) / 100,

        // Modifiers
        innovation_decay_modifier: Math.round((score.modifiers?.innovationDecay || 0) * 100) / 100,
        platform_risk_modifier: Math.round((score.modifiers?.platformRisk || 0) * 100) / 100,
        revenue_quality_modifier: Math.round((score.modifiers?.revenueQuality || 0) * 100) / 100,

        // Metadata
        algorithm_version: "v6.0",
        confidence_score: score.validationStatus?.confidence || 0,
        completeness_score: score.validationStatus?.completeness || 0,
        is_valid: score.validationStatus?.isValid || false,
      };

      const created = await payload.create({
        collection: "rankings",
        data: rankingData,
      });

      createdRankings.push({
        position: i + 1,
        tool_name: tool["name"],
        score: score.overallScore,
        id: created.id,
      });
    }

    logger.info(
      `Successfully generated rankings for ${scores.length} tools in period ${rankingPeriod}`
    );

    return NextResponse.json({
      success: true,
      message: `Successfully generated rankings for ${scores.length} tools`,
      period: rankingPeriod,
      top_10: createdRankings.slice(0, 10),
      total_tools: scores.length,
      tools_ranked: scores.length, // Add this for frontend compatibility
    });
  } catch (error) {
    logger.error("Error generating rankings:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
