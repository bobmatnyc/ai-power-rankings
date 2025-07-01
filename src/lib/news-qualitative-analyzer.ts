/**
 * Qualitative News Analysis using Vercel AI SDK
 *
 * This module uses AI to extract qualitative metrics from news articles
 * that traditional regex-based extraction cannot capture.
 */

import { z } from "zod";
import type { NewsArticle } from "@/lib/json-db/schemas";
import { logger } from "@/lib/logger";

// Schema for qualitative metrics extraction
const _QualitativeMetricsSchema = z.object({
  // Innovation signals
  productLaunches: z
    .array(
      z.object({
        feature: z.string().describe("Name of the feature or product launched"),
        significance: z
          .enum(["breakthrough", "major", "incremental"])
          .describe("How significant is this launch?"),
        impact: z
          .number()
          .min(0)
          .max(10)
          .describe("Expected impact on the tool's competitiveness (0-10)"),
        description: z.string().describe("Brief description of what was launched"),
      })
    )
    .default([]),

  // Business momentum
  partnerships: z
    .array(
      z.object({
        partner: z.string().describe("Name of the partner organization"),
        type: z
          .enum(["strategic", "integration", "distribution", "technology"])
          .describe("Type of partnership"),
        significance: z
          .number()
          .min(0)
          .max(10)
          .describe("Strategic value of the partnership (0-10)"),
        description: z.string().describe("What the partnership entails"),
      })
    )
    .default([]),

  // Technical achievements
  technicalMilestones: z
    .array(
      z.object({
        achievement: z.string().describe("What technical milestone was achieved"),
        category: z
          .enum(["performance", "capability", "scale", "reliability"])
          .describe("Type of achievement"),
        improvement: z.number().optional().describe("Percentage improvement if quantifiable"),
        impact: z.number().min(0).max(10).describe("Impact on technical capability (0-10)"),
      })
    )
    .default([]),

  // Market sentiment analysis
  sentiment: z.object({
    overall: z.number().min(-1).max(1).describe("Overall sentiment (-1 to 1)"),
    confidence: z.number().min(0).max(1).describe("Confidence in sentiment analysis (0-1)"),
    aspects: z.object({
      product: z.number().min(-1).max(1).describe("Product-related sentiment"),
      leadership: z.number().min(-1).max(1).describe("Leadership/company sentiment"),
      competition: z.number().min(-1).max(1).describe("Competitive position sentiment"),
      future: z.number().min(-1).max(1).describe("Future outlook sentiment"),
    }),
  }),

  // Development signals
  developmentActivity: z.object({
    releaseCadence: z
      .enum(["accelerating", "steady", "slowing", "unknown"])
      .describe("Release frequency trend"),
    featureVelocity: z.number().min(0).max(10).describe("Speed of feature development (0-10)"),
    communityEngagement: z
      .enum(["increasing", "high", "medium", "low", "declining"])
      .describe("Community activity level"),
    openSourceActivity: z.boolean().optional().describe("Is there open source activity mentioned?"),
  }),

  // Competitive positioning
  competitivePosition: z.object({
    mentioned_competitors: z.array(z.string()).describe("Competitors mentioned in the article"),
    positioning: z
      .enum(["leader", "challenger", "follower", "niche", "unclear"])
      .describe("Market position"),
    differentiators: z.array(z.string()).describe("Key differentiators mentioned"),
    threats: z.array(z.string()).describe("Competitive threats identified"),
  }),

  // Key events
  keyEvents: z
    .array(
      z.object({
        event: z.string().describe("Description of the key event"),
        type: z.enum(["funding", "acquisition", "leadership", "crisis", "expansion", "other"]),
        impact: z.enum(["positive", "negative", "neutral", "mixed"]),
        significance: z.number().min(0).max(10).describe("Significance of the event (0-10)"),
      })
    )
    .default([]),
});

export type QualitativeMetrics = z.infer<typeof _QualitativeMetricsSchema>;

/**
 * Extract qualitative metrics from a news article using AI via API route
 */
export async function extractQualitativeMetrics(
  article: NewsArticle,
  toolName: string,
  toolContext?: string
): Promise<QualitativeMetrics | null> {
  try {
    // Use the AI API route
    const baseUrl = process.env["NEXT_PUBLIC_BASE_URL"] || "http://localhost:3000";
    const response = await fetch(`${baseUrl}/api/ai/analyze-news`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        article,
        toolName,
        toolContext,
        provider: "openai", // Default to OpenAI, can be made configurable
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.metrics) {
      logger.warn(`No qualitative metrics extracted for ${toolName}`, {
        tool: toolName,
        article_id: article.id,
        reason: data.reason,
      });
      return null;
    }

    logger.info(`Extracted qualitative metrics for ${toolName}`, {
      tool: toolName,
      article_id: article.id,
      provider: data.provider,
      metrics_summary: {
        product_launches: data.metrics.productLaunches.length,
        partnerships: data.metrics.partnerships.length,
        technical_milestones: data.metrics.technicalMilestones.length,
        overall_sentiment: data.metrics.sentiment.overall,
      },
    });

    return data.metrics;
  } catch (error) {
    logger.error(`Failed to extract qualitative metrics for ${toolName}`, {
      tool: toolName,
      article_id: article.id,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  }
}

/**
 * Convert qualitative metrics to ranking factor adjustments
 */
export function qualitativeMetricsToRankingAdjustments(metrics: QualitativeMetrics): {
  innovationBoost: number;
  businessSentimentAdjust: number;
  developmentVelocityBoost: number;
  marketTractionBoost: number;
  technicalPerformanceBoost: number;
} {
  // Calculate innovation boost from product launches and technical milestones
  const innovationFromLaunches =
    metrics.productLaunches.reduce((sum, launch) => {
      const weight =
        launch.significance === "breakthrough" ? 1.0 : launch.significance === "major" ? 0.6 : 0.3;
      return sum + launch.impact * weight;
    }, 0) / 10; // Normalize to 0-1

  const innovationFromTech =
    metrics.technicalMilestones.reduce((sum, milestone) => {
      return sum + milestone.impact;
    }, 0) / 10; // Normalize to 0-1

  const innovationBoost = Math.min(2, (innovationFromLaunches + innovationFromTech) * 0.5);

  // Business sentiment adjustment based on sentiment analysis
  const sentimentFactors = [
    metrics.sentiment.overall * 2,
    metrics.sentiment.aspects.product,
    metrics.sentiment.aspects.future,
    metrics.sentiment.aspects.competition * 0.5,
  ];
  const businessSentimentAdjust =
    sentimentFactors.reduce((a, b) => a + b, 0) / sentimentFactors.length;

  // Development velocity boost
  const velocityMultiplier =
    metrics.developmentActivity.releaseCadence === "accelerating"
      ? 1.5
      : metrics.developmentActivity.releaseCadence === "steady"
        ? 1.0
        : metrics.developmentActivity.releaseCadence === "slowing"
          ? 0.5
          : 0.8;

  const developmentVelocityBoost =
    (metrics.developmentActivity.featureVelocity / 10) * velocityMultiplier;

  // Market traction boost from partnerships and positioning
  const partnershipValue =
    metrics.partnerships.reduce((sum, partnership) => {
      return sum + partnership.significance;
    }, 0) / 10; // Normalize to 0-1

  const positionMultiplier =
    metrics.competitivePosition.positioning === "leader"
      ? 1.2
      : metrics.competitivePosition.positioning === "challenger"
        ? 1.0
        : metrics.competitivePosition.positioning === "follower"
          ? 0.8
          : 0.6;

  const marketTractionBoost = partnershipValue * positionMultiplier;

  // Technical performance boost from milestones
  const technicalPerformanceBoost =
    metrics.technicalMilestones
      .filter((m) => m.category === "performance" || m.category === "capability")
      .reduce((sum, m) => sum + m.impact, 0) / 20; // Normalize to 0-0.5

  return {
    innovationBoost: Math.round(innovationBoost * 100) / 100,
    businessSentimentAdjust: Math.round(businessSentimentAdjust * 100) / 100,
    developmentVelocityBoost: Math.round(developmentVelocityBoost * 100) / 100,
    marketTractionBoost: Math.round(marketTractionBoost * 100) / 100,
    technicalPerformanceBoost: Math.round(technicalPerformanceBoost * 100) / 100,
  };
}

/**
 * Process multiple news articles for a tool and aggregate qualitative impacts
 */
export async function processNewsQualitativeImpact(
  toolId: string,
  toolName: string,
  newsArticles: NewsArticle[],
  cutoffDate?: Date
): Promise<{
  aggregatedAdjustments: ReturnType<typeof qualitativeMetricsToRankingAdjustments>;
  processedArticles: number;
  significantEvents: Array<{
    event: string;
    date: string;
    impact: string;
  }>;
}> {
  const cutoff = cutoffDate || new Date();
  const relevantArticles = newsArticles
    .filter((article) => article.tool_mentions?.includes(toolId))
    .filter((article) => new Date(article.published_date) <= cutoff)
    .sort((a, b) => new Date(b.published_date).getTime() - new Date(a.published_date).getTime())
    .slice(0, 10); // Process up to 10 most recent articles

  const aggregatedAdjustments = {
    innovationBoost: 0,
    businessSentimentAdjust: 0,
    developmentVelocityBoost: 0,
    marketTractionBoost: 0,
    technicalPerformanceBoost: 0,
  };

  const significantEvents: Array<{ event: string; date: string; impact: string }> = [];
  let processedCount = 0;

  for (const article of relevantArticles) {
    const metrics = await extractQualitativeMetrics(article, toolName);
    if (!metrics) {
      continue;
    }

    const adjustments = qualitativeMetricsToRankingAdjustments(metrics);

    // Apply time decay (more recent news has more impact)
    const ageInDays = Math.max(
      0,
      (cutoff.getTime() - new Date(article.published_date).getTime()) / (1000 * 60 * 60 * 24)
    );
    const timeDecay = Math.exp(-ageInDays / 90); // 90-day half-life for qualitative impacts

    // Aggregate with time decay
    aggregatedAdjustments.innovationBoost += adjustments.innovationBoost * timeDecay;
    aggregatedAdjustments.businessSentimentAdjust +=
      adjustments.businessSentimentAdjust * timeDecay;
    aggregatedAdjustments.developmentVelocityBoost +=
      adjustments.developmentVelocityBoost * timeDecay;
    aggregatedAdjustments.marketTractionBoost += adjustments.marketTractionBoost * timeDecay;
    aggregatedAdjustments.technicalPerformanceBoost +=
      adjustments.technicalPerformanceBoost * timeDecay;

    // Collect significant events
    metrics.keyEvents
      .filter((e) => e.significance >= 7)
      .forEach((event) => {
        significantEvents.push({
          event: event.event,
          date: article.published_date,
          impact: event.impact,
        });
      });

    processedCount++;
  }

  // Normalize aggregated adjustments (cap at reasonable limits)
  const normalizedAdjustments = {
    innovationBoost: Math.min(3, aggregatedAdjustments.innovationBoost),
    businessSentimentAdjust: Math.max(
      -2,
      Math.min(2, aggregatedAdjustments.businessSentimentAdjust)
    ),
    developmentVelocityBoost: Math.min(2, aggregatedAdjustments.developmentVelocityBoost),
    marketTractionBoost: Math.min(2, aggregatedAdjustments.marketTractionBoost),
    technicalPerformanceBoost: Math.min(1, aggregatedAdjustments.technicalPerformanceBoost),
  };

  return {
    aggregatedAdjustments: normalizedAdjustments,
    processedArticles: processedCount,
    significantEvents: significantEvents.slice(0, 5), // Top 5 events
  };
}
