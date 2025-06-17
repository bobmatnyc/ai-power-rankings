/**
 * Historical Rankings Calculator
 *
 * Generates rankings for any historical month using all available data
 * including news impacts calculated with proper aging
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import {
  ALGORITHM_V6_WEIGHTS,
  PLATFORM_RISK_MODIFIERS,
  REVENUE_QUALITY_MULTIPLIERS,
  type ToolMetricsV6,
} from "./ranking-algorithm-v6";

export interface HistoricalRankingRequest {
  month: string; // Format: YYYY-MM
  algorithmVersion?: string;
  includeNewsImpact?: boolean;
}

export interface HistoricalRanking {
  tool_id: string;
  tool_name: string;
  position: number;
  score: number;
  factor_scores: {
    agenticCapability: number;
    innovation: number;
    technicalPerformance: number;
    developerAdoption: number;
    marketTraction: number;
    businessSentiment: number;
    developmentVelocity: number;
    platformResilience: number;
    newsImpactModifier?: number;
  };
  metrics_used: Record<string, any>;
  news_summary?: {
    article_count: number;
    total_impact: number;
    positive_impact: number;
    negative_impact: number;
  };
}

/**
 * Get metric value at a specific point in time
 */
async function getMetricAtTime(
  supabase: any,
  toolId: string,
  metricKey: string,
  referenceDate: string
): Promise<number | null> {
  const { data, error } = await supabase.rpc("get_metric_at_time", {
    p_tool_id: toolId,
    p_metric_key: metricKey,
    p_timestamp: referenceDate,
  });

  if (error) {
    logger.warn(`Error fetching metric ${metricKey} for ${toolId}:`, error);
    return null;
  }

  return data;
}

/**
 * Calculate historical rankings for a specific month
 */
export async function calculateHistoricalRankings(
  request: HistoricalRankingRequest
): Promise<HistoricalRanking[]> {
  const supabase = await createClient();

  // Convert month to reference date (last day of month)
  const startDate = `${request.month}-01`;
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 1);
  endDate.setDate(0); // Last day of the month
  const referenceDate = endDate.toISOString();

  logger.info(`Calculating historical rankings for ${request.month} (reference: ${referenceDate})`);

  // Get all active tools at that time
  const { data: tools, error: toolsError } = await supabase
    .from("tools")
    .select("id, name, slug, status, founded_date")
    .or("status.eq.active,status.eq.beta")
    .lte("founded_date", referenceDate);

  if (toolsError) {
    logger.error("Error fetching tools:", toolsError);
    throw toolsError;
  }

  const rankings: HistoricalRanking[] = [];

  // Calculate scores for each tool
  for (const tool of tools) {
    try {
      // Fetch all metrics at reference date
      const metrics: Partial<ToolMetricsV6> = {
        tool_id: tool.id,
        status: tool.status,
      };

      // Fetch core metrics
      const metricKeys = [
        "agentic_capability",
        "swe_bench_score",
        "multi_file_capability",
        "planning_depth",
        "context_utilization",
        "context_window",
        "language_support",
        "github_stars",
        "innovation_score",
        "estimated_users",
        "monthly_arr",
        "valuation",
        "funding",
        "business_sentiment",
        "release_frequency",
        "github_contributors",
        "llm_provider_count",
      ];

      for (const key of metricKeys) {
        const value = await getMetricAtTime(supabase, tool.id, key, referenceDate);
        if (value !== null) {
          metrics[key] = value;
        }
      }

      // Calculate factor scores
      const factorScores = calculateFactorScores(metrics);

      // Apply news impact if requested
      let newsImpactModifier = 0;
      let newsSummary;

      if (request.includeNewsImpact !== false) {
        const { data: newsImpact, error: newsError } = await supabase.rpc(
          "calculate_aggregate_news_impact",
          {
            p_tool_id: tool.id,
            p_reference_date: referenceDate,
          }
        );

        if (!newsError && newsImpact?.[0]) {
          newsSummary = {
            article_count: newsImpact[0].article_count,
            total_impact: newsImpact[0].total_impact,
            positive_impact: newsImpact[0].positive_impact,
            negative_impact: newsImpact[0].negative_impact,
          };

          // Calculate modifier (capped between -2 and +2)
          newsImpactModifier = Math.max(-2, Math.min(2, newsImpact[0].total_impact / 10));

          // Apply news impact to relevant factors
          applyNewsImpact(factorScores, newsImpactModifier, newsImpact[0].recent_article_count);
        }
      }

      // Calculate final score
      const weights = ALGORITHM_V6_WEIGHTS;
      const finalScore = Object.entries(weights).reduce((total, [factor, weight]) => {
        return total + (factorScores[factor] || 0) * weight;
      }, 0);

      rankings.push({
        tool_id: tool.id,
        tool_name: tool.name,
        position: 0, // Will be set after sorting
        score: Math.round(finalScore * 100) / 100,
        factor_scores: {
          ...factorScores,
          newsImpactModifier,
        },
        metrics_used: metrics,
        news_summary: newsSummary,
      });
    } catch (error) {
      logger.error(`Error calculating ranking for ${tool.name}:`, error);
    }
  }

  // Sort by score and assign positions
  rankings.sort((a, b) => b.score - a.score);
  rankings.forEach((ranking, index) => {
    ranking.position = index + 1;
  });

  return rankings;
}

/**
 * Calculate factor scores from metrics
 */
function calculateFactorScores(metrics: Partial<ToolMetricsV6>): Record<string, number> {
  const scores: Record<string, number> = {};

  // Agentic Capability (0-10)
  scores.agenticCapability = calculateAgenticScore(metrics);

  // Innovation (0-10)
  scores.innovation = metrics.innovation_score || 5;

  // Technical Performance (0-10)
  scores.technicalPerformance = calculateTechnicalScore(metrics);

  // Developer Adoption (0-10)
  scores.developerAdoption = calculateDeveloperScore(metrics);

  // Market Traction (0-10)
  scores.marketTraction = calculateMarketScore(metrics);

  // Business Sentiment (0-10)
  scores.businessSentiment = metrics.business_sentiment || 5;

  // Development Velocity (0-10)
  scores.developmentVelocity = calculateVelocityScore(metrics);

  // Platform Resilience (0-10)
  scores.platformResilience = calculateResilienceScore(metrics);

  return scores;
}

function calculateAgenticScore(metrics: Partial<ToolMetricsV6>): number {
  let score = 5; // Base score

  if (metrics.agentic_capability) {
    score = metrics.agentic_capability;
  } else {
    // Calculate from components
    if (metrics.swe_bench_score) {
      score += (metrics.swe_bench_score / 100) * 3;
    }
    if (metrics.multi_file_capability) {
      score += metrics.multi_file_capability * 0.2;
    }
    if (metrics.planning_depth) {
      score += metrics.planning_depth * 0.1;
    }
  }

  return Math.min(10, Math.max(0, score));
}

function calculateTechnicalScore(metrics: Partial<ToolMetricsV6>): number {
  let score = 5;

  if (metrics.context_window) {
    // Normalize context window (assume 200k is excellent)
    score += Math.min(3, (metrics.context_window / 200000) * 3);
  }

  if (metrics.language_support) {
    // Normalize language support (assume 20+ is excellent)
    score += Math.min(2, (metrics.language_support / 20) * 2);
  }

  return Math.min(10, Math.max(0, score));
}

function calculateDeveloperScore(metrics: Partial<ToolMetricsV6>): number {
  let score = 5;

  if (metrics.github_stars) {
    // Logarithmic scale for stars
    score = Math.min(10, Math.log10(metrics.github_stars + 1) * 2);
  }

  if (metrics.estimated_users) {
    // Boost for large user base
    score = Math.max(score, Math.min(10, Math.log10(metrics.estimated_users + 1) * 1.5));
  }

  return score;
}

function calculateMarketScore(metrics: Partial<ToolMetricsV6>): number {
  let score = 5;

  if (metrics.monthly_arr) {
    // Logarithmic scale for revenue
    score = Math.min(10, (Math.log10(metrics.monthly_arr + 1) / 6) * 10);
  } else if (metrics.valuation) {
    // Use valuation as proxy
    score = Math.min(10, (Math.log10(metrics.valuation + 1) / 9) * 10);
  } else if (metrics.funding) {
    // Use funding as proxy
    score = Math.min(10, (Math.log10(metrics.funding + 1) / 8) * 10);
  }

  // Apply revenue quality multiplier if business model is known
  if (metrics.business_model && REVENUE_QUALITY_MULTIPLIERS[metrics.business_model]) {
    score *= REVENUE_QUALITY_MULTIPLIERS[metrics.business_model];
  }

  return Math.min(10, Math.max(0, score));
}

function calculateVelocityScore(metrics: Partial<ToolMetricsV6>): number {
  let score = 5;

  if (metrics.release_frequency) {
    // Normalize release frequency (assume 50+ releases/year is excellent)
    score = Math.min(10, (metrics.release_frequency / 50) * 10);
  }

  if (metrics.github_contributors && metrics.github_contributors > 10) {
    score = Math.max(score, 6); // Boost for active community
  }

  return score;
}

function calculateResilienceScore(metrics: Partial<ToolMetricsV6>): number {
  let score = 5;

  if (metrics.llm_provider_count && metrics.llm_provider_count > 1) {
    score += Math.min(3, metrics.llm_provider_count - 1);
  }

  if (metrics.multi_model_support) {
    score += 2;
  }

  // Apply risk modifiers
  if (metrics.risk_factors) {
    for (const risk of metrics.risk_factors) {
      if (PLATFORM_RISK_MODIFIERS[risk]) {
        score += PLATFORM_RISK_MODIFIERS[risk];
      }
    }
  }

  return Math.min(10, Math.max(0, score));
}

/**
 * Apply news impact to factor scores
 */
function applyNewsImpact(
  scores: Record<string, number>,
  newsImpactModifier: number,
  recentArticleCount: number
): void {
  // News primarily affects these factors
  const impactDistribution = {
    businessSentiment: 0.4,
    marketTraction: 0.3,
    developerAdoption: 0.2,
    innovation: 0.1,
  };

  // Apply weighted impact
  for (const [factor, weight] of Object.entries(impactDistribution)) {
    if (scores[factor] !== undefined) {
      scores[factor] = Math.max(0, Math.min(10, scores[factor] + newsImpactModifier * weight));
    }
  }

  // Boost development velocity for high recent activity
  if (recentArticleCount > 5 && scores.developmentVelocity !== undefined) {
    scores.developmentVelocity = Math.min(10, scores.developmentVelocity + 0.5);
  }
}

/**
 * Get available months with data
 */
export async function getAvailableMonths(): Promise<string[]> {
  const supabase = await createClient();

  // Get distinct months from metrics_history
  const { data: metricsMonths, error: metricsError } = await supabase
    .from("metrics_history")
    .select("recorded_at")
    .order("recorded_at", { ascending: false });

  if (metricsError) {
    logger.error("Error fetching metrics months:", metricsError);
    throw metricsError;
  }

  // Get distinct months from news_updates
  const { data: newsMonths, error: newsError } = await supabase
    .from("news_updates")
    .select("published_date")
    .not("published_date", "is", null)
    .order("published_date", { ascending: false });

  if (newsError) {
    logger.error("Error fetching news months:", newsError);
    throw newsError;
  }

  // Combine and deduplicate months
  const allDates = [
    ...metricsMonths.map((m) => m.recorded_at),
    ...newsMonths.map((n) => n.published_date),
  ];

  const uniqueMonths = new Set(
    allDates.map((date) => {
      const d = new Date(date);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    })
  );

  return Array.from(uniqueMonths).sort().reverse();
}
