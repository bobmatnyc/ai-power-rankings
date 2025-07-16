/**
 * Enhanced News Integration for Ranking Algorithm
 *
 * Combines quantitative metric extraction with AI-powered qualitative analysis
 * to provide comprehensive news impact on rankings.
 */

import type { NewsArticle } from "@/lib/json-db/schemas";
import { logger } from "./logger";
import { processNewsQualitativeImpact } from "./news-qualitative-analyzer";

export interface Innovation {
  score: number;
  date: Date;
  description?: string;
}

export interface BaseMetrics {
  tool_id: string;
  swe_bench_score?: number;
  funding?: number;
  valuation?: number;
  monthly_arr?: number;
  estimated_users?: number;
  innovation_score?: number;
  business_sentiment?: number;
  release_frequency?: number;
  innovations?: Innovation[];
  news_impact?: {
    articles_analyzed: number;
    last_news_date?: string;
    significant_events: Array<{
      event: string;
      date: string;
      impact: string;
    }>;
    qualitative_boosts: {
      innovation: number;
      sentiment: number;
      velocity: number;
      traction: number;
      technical: number;
    };
  };
  [key: string]: unknown;
}

export interface EnhancedNewsMetrics {
  // Quantitative metrics (from regex extraction)
  swe_bench_score?: number;
  funding?: number;
  valuation?: number;
  monthly_arr?: number;
  estimated_users?: number;

  // Qualitative adjustments (from AI analysis)
  innovationBoost: number;
  businessSentimentAdjust: number;
  developmentVelocityBoost: number;
  marketTractionBoost: number;
  technicalPerformanceBoost: number;

  // Metadata
  articlesProcessed: number;
  significantEvents: Array<{
    event: string;
    date: string;
    impact: string;
  }>;
  lastNewsDate?: string;
}

/**
 * Extract metrics from news articles with regex patterns
 * (Existing functionality from build/route.ts)
 */
function extractQuantitativeMetrics(
  toolId: string,
  newsArticles: NewsArticle[],
  previewDate?: string
): {
  swe_bench_score?: number;
  funding?: number;
  valuation?: number;
  monthly_arr?: number;
  estimated_users?: number;
} {
  const metrics: {
    swe_bench_score?: number;
    funding?: number;
    valuation?: number;
    monthly_arr?: number;
    estimated_users?: number;
  } = {};

  // Filter articles that mention this tool
  let toolArticles = newsArticles.filter((article) => article.tool_mentions?.includes(toolId));

  // If previewDate is provided, only include articles published before that date
  if (previewDate) {
    const cutoffDate = new Date(previewDate);
    toolArticles = toolArticles.filter((article) => {
      const articleDate = new Date(article.published_date);
      return articleDate <= cutoffDate;
    });
  }

  for (const article of toolArticles) {
    const content = article.content?.toLowerCase() || "";
    const title = article.title?.toLowerCase() || "";
    const combined = `${title} ${content}`;

    // Extract SWE-bench scores
    const sweBenchMatch = combined.match(/(\d+\.?\d*)\s*%?\s*(?:on\s+)?swe[- ]bench/i);
    if (sweBenchMatch?.[1] && !metrics.swe_bench_score) {
      metrics.swe_bench_score = parseFloat(sweBenchMatch[1]);
    }

    // Extract valuation
    const valuationMatch = combined.match(/(\d+\.?\d*)\s*billion\s*(?:dollar\s*)?valuation/i);
    if (valuationMatch?.[1] && !metrics.valuation) {
      metrics.valuation = parseFloat(valuationMatch[1]) * 1_000_000_000;
    }

    // Extract funding
    const fundingMatch = combined.match(/raised?\s*\$?(\d+\.?\d*)\s*(million|billion)/i);
    if (fundingMatch?.[1] && fundingMatch[2] && !metrics.funding) {
      const amount = parseFloat(fundingMatch[1]);
      const multiplier = fundingMatch[2].toLowerCase() === "billion" ? 1_000_000_000 : 1_000_000;
      metrics.funding = amount * multiplier;
    }

    // Extract ARR
    const arrMatch = combined.match(/\$?(\d+\.?\d*)\s*[mb]\s*arr/i);
    if (arrMatch?.[1] && !metrics.monthly_arr) {
      const amount = parseFloat(arrMatch[1]);
      const multiplier = combined.match(/b\s*arr/i) ? 1_000_000_000 : 1_000_000;
      // Convert annual to monthly
      metrics.monthly_arr = (amount * multiplier) / 12;
    }

    // Extract users
    const usersMatch = combined.match(/(\d+\.?\d*)\s*[km]?\s*users/i);
    if (usersMatch?.[1] && !metrics.estimated_users) {
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

/**
 * Process news articles for enhanced metrics extraction
 * Combines quantitative extraction with AI-powered qualitative analysis
 */
export async function extractEnhancedNewsMetrics(
  toolId: string,
  toolName: string,
  newsArticles: NewsArticle[],
  previewDate?: string,
  enableAI: boolean = true
): Promise<EnhancedNewsMetrics> {
  logger.info(`Extracting enhanced news metrics for ${toolName}`, {
    tool_id: toolId,
    articles_count: newsArticles.filter((a) => a.tool_mentions?.includes(toolId)).length,
    enable_ai: enableAI,
    preview_date: previewDate,
  });

  // Extract quantitative metrics using regex
  const quantitativeMetrics = extractQuantitativeMetrics(toolId, newsArticles, previewDate);

  // Default qualitative adjustments
  let qualitativeAdjustments = {
    innovationBoost: 0,
    businessSentimentAdjust: 0,
    developmentVelocityBoost: 0,
    marketTractionBoost: 0,
    technicalPerformanceBoost: 0,
  };

  let articlesProcessed = 0;
  let significantEvents: Array<{ event: string; date: string; impact: string }> = [];

  // Extract qualitative metrics using AI if enabled
  if (enableAI && (process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY)) {
    try {
      const cutoffDate = previewDate ? new Date(previewDate) : new Date();
      const qualitativeResult = await processNewsQualitativeImpact(
        toolId,
        toolName,
        newsArticles,
        cutoffDate
      );

      qualitativeAdjustments = qualitativeResult.aggregatedAdjustments;
      articlesProcessed = qualitativeResult.processedArticles;
      significantEvents = qualitativeResult.significantEvents;

      logger.info(`AI qualitative analysis completed for ${toolName}`, {
        tool_id: toolId,
        articles_processed: articlesProcessed,
        adjustments: qualitativeAdjustments,
        significant_events: significantEvents.length,
      });
    } catch (error) {
      logger.error(`Failed to extract qualitative metrics for ${toolName}`, {
        tool_id: toolId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Get the most recent news date
  const toolArticles = newsArticles
    .filter((a) => a.tool_mentions?.includes(toolId))
    .filter((a) => !previewDate || new Date(a.published_date) <= new Date(previewDate))
    .sort((a, b) => new Date(b.published_date).getTime() - new Date(a.published_date).getTime());

  const lastNewsDate = toolArticles[0]?.published_date;

  return {
    ...quantitativeMetrics,
    ...qualitativeAdjustments,
    articlesProcessed,
    significantEvents,
    lastNewsDate,
  };
}

/**
 * Apply enhanced news metrics to tool metrics
 * Updates the tool metrics with both quantitative and qualitative impacts
 */
export function applyEnhancedNewsMetrics(
  baseMetrics: BaseMetrics | any,
  enhancedNewsMetrics: EnhancedNewsMetrics
): BaseMetrics | any {
  const updatedMetrics = { ...baseMetrics };

  // Apply quantitative updates (overwrite if found in news)
  if (enhancedNewsMetrics.swe_bench_score !== undefined) {
    updatedMetrics.swe_bench_score = enhancedNewsMetrics.swe_bench_score;
    logger.info(`Updated SWE-bench score from news: ${enhancedNewsMetrics.swe_bench_score}`);
  }

  if (enhancedNewsMetrics.funding !== undefined) {
    updatedMetrics.funding = enhancedNewsMetrics.funding;
    logger.info(`Updated funding from news: ${enhancedNewsMetrics.funding}`);
  }

  if (enhancedNewsMetrics.valuation !== undefined) {
    updatedMetrics.valuation = enhancedNewsMetrics.valuation;
    logger.info(`Updated valuation from news: ${enhancedNewsMetrics.valuation}`);
  }

  if (enhancedNewsMetrics.monthly_arr !== undefined) {
    updatedMetrics.monthly_arr = enhancedNewsMetrics.monthly_arr;
    logger.info(`Updated monthly ARR from news: ${enhancedNewsMetrics.monthly_arr}`);
  }

  if (enhancedNewsMetrics.estimated_users !== undefined) {
    updatedMetrics.estimated_users = enhancedNewsMetrics.estimated_users;
    logger.info(`Updated estimated users from news: ${enhancedNewsMetrics.estimated_users}`);
  }

  // Apply qualitative adjustments to innovation score
  if (enhancedNewsMetrics.innovationBoost > 0) {
    const currentInnovation = updatedMetrics.innovation_score || 5;
    updatedMetrics.innovation_score = Math.min(
      10,
      currentInnovation + enhancedNewsMetrics.innovationBoost
    );

    // Also update innovations array if boost is significant
    if (enhancedNewsMetrics.innovationBoost >= 1 && enhancedNewsMetrics.lastNewsDate) {
      if (!updatedMetrics.innovations) {
        updatedMetrics.innovations = [];
      }
      updatedMetrics.innovations.push({
        score: enhancedNewsMetrics.innovationBoost,
        date: new Date(enhancedNewsMetrics.lastNewsDate),
        description: "Innovation boost from recent developments",
      });
    }
  }

  // Apply business sentiment adjustment
  if (enhancedNewsMetrics.businessSentimentAdjust !== 0) {
    const currentSentiment = updatedMetrics.business_sentiment || 0.5;
    updatedMetrics.business_sentiment = Math.max(
      0,
      Math.min(1, currentSentiment + enhancedNewsMetrics.businessSentimentAdjust / 2)
    );
  }

  // Apply development velocity boost
  if (enhancedNewsMetrics.developmentVelocityBoost > 0) {
    const currentFrequency = updatedMetrics.release_frequency || 2;
    updatedMetrics.release_frequency = Math.min(
      30,
      currentFrequency * (1 + enhancedNewsMetrics.developmentVelocityBoost / 2)
    );
  }

  // Store news impact metadata
  updatedMetrics.news_impact = {
    articles_analyzed: enhancedNewsMetrics.articlesProcessed,
    last_news_date: enhancedNewsMetrics.lastNewsDate,
    significant_events: enhancedNewsMetrics.significantEvents,
    qualitative_boosts: {
      innovation: enhancedNewsMetrics.innovationBoost,
      sentiment: enhancedNewsMetrics.businessSentimentAdjust,
      velocity: enhancedNewsMetrics.developmentVelocityBoost,
      traction: enhancedNewsMetrics.marketTractionBoost,
      technical: enhancedNewsMetrics.technicalPerformanceBoost,
    },
  };

  return updatedMetrics;
}

/**
 * Calculate the final impact of news on ranking scores
 * This adjusts the factor scores based on qualitative analysis
 */
export function applyNewsImpactToScores(
  factorScores: Record<string, number>,
  enhancedNewsMetrics: EnhancedNewsMetrics
): Record<string, number> {
  const adjustedScores = { ...factorScores };

  // Apply technical performance boost
  if (enhancedNewsMetrics.technicalPerformanceBoost > 0) {
    adjustedScores.technicalPerformance = Math.min(
      10,
      (adjustedScores.technicalPerformance || 5) + enhancedNewsMetrics.technicalPerformanceBoost
    );
  }

  // Apply market traction boost
  if (enhancedNewsMetrics.marketTractionBoost > 0) {
    adjustedScores.marketTraction = Math.min(
      10,
      (adjustedScores.marketTraction || 5) + enhancedNewsMetrics.marketTractionBoost
    );
  }

  // Note: Innovation and business sentiment are already handled in the metrics
  // Development velocity is also reflected in the metrics

  return adjustedScores;
}
