/**
 * News Impact Integration for Ranking Algorithm
 *
 * Calculates how news articles affect tool rankings
 * considering age decay and PR discounts
 */

import { calculateEffectiveNewsImpact } from "./news-aging";
import { logger } from "./logger";

export interface NewsArticle {
  id: string;
  published_date: string;
  type: string;
  source: { name: string };
  tools_mentioned: Array<{
    tool_id: string;
    relevance: "primary" | "secondary" | "mentioned";
    sentiment?: "positive" | "neutral" | "negative" | "mixed";
  }>;
  impact_assessment?: {
    importance?: "critical" | "high" | "medium" | "low";
    market_impact?: "major" | "moderate" | "minor" | "none";
    ranking_impact?: Array<{
      tool_id: string;
      impact_type: "positive" | "negative" | "neutral";
      factors_affected?: string[];
    }>;
  };
  metadata?: {
    is_company_announcement?: boolean;
    source_credibility?: number;
  };
}

/**
 * Calculate the base impact score for a news article
 */
export function calculateBaseNewsImpact(article: NewsArticle): number {
  let baseImpact = 0;

  // Importance factor
  const importanceScores = {
    critical: 10,
    high: 7,
    medium: 4,
    low: 2,
  };
  baseImpact += importanceScores[article.impact_assessment?.importance || "medium"];

  // Market impact factor
  const marketImpactScores = {
    major: 8,
    moderate: 5,
    minor: 2,
    none: 0,
  };
  baseImpact += marketImpactScores[article.impact_assessment?.market_impact || "minor"];

  // News type factor
  const typeImpactScores: Record<string, number> = {
    funding: 8,
    acquisition: 9,
    product_launch: 7,
    feature_update: 5,
    benchmark_result: 8,
    pricing_change: 6,
    partnership: 4,
    technical_milestone: 7,
    security_incident: -5,
    company_announcement: 3,
    company_news: 3,
    market_analysis: 4,
    research_paper: 6,
    community_news: 3,
  };
  baseImpact += typeImpactScores[article.type] || 3;

  // Normalize to 0-10 scale
  return Math.min(10, Math.max(0, baseImpact / 2.5));
}

/**
 * Calculate news sentiment impact for a specific tool
 */
export function calculateSentimentImpact(toolMention: NewsArticle["tools_mentioned"][0]): number {
  const sentimentScores = {
    positive: 1.0,
    neutral: 0,
    negative: -1.0,
    mixed: 0.2,
  };

  const relevanceMultipliers = {
    primary: 1.0,
    secondary: 0.5,
    mentioned: 0.2,
  };

  const sentimentScore = sentimentScores[toolMention.sentiment || "neutral"];
  const relevanceMultiplier = relevanceMultipliers[toolMention.relevance];

  return sentimentScore * relevanceMultiplier;
}

/**
 * Calculate aggregated news impact for a tool
 */
export function calculateToolNewsImpact(
  toolId: string,
  newsArticles: NewsArticle[],
  referenceDate: Date = new Date()
): {
  totalImpact: number;
  positiveImpact: number;
  negativeImpact: number;
  articleCount: number;
  recentArticleCount: number;
} {
  let totalImpact = 0;
  let positiveImpact = 0;
  let negativeImpact = 0;
  let articleCount = 0;
  let recentArticleCount = 0;

  const thirtyDaysAgo = new Date(referenceDate);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  for (const article of newsArticles) {
    // Find mentions of this tool
    const toolMentions = article.tools_mentioned.filter((t) => t.tool_id === toolId);
    if (toolMentions.length === 0) {
      continue;
    }

    articleCount++;

    const articleDate = new Date(article.published_date);
    if (articleDate >= thirtyDaysAgo) {
      recentArticleCount++;
    }

    // Calculate base impact
    const baseImpact = calculateBaseNewsImpact(article);

    // Process each mention
    for (const mention of toolMentions) {
      // Calculate sentiment-adjusted impact
      const sentimentModifier = calculateSentimentImpact(mention);
      const sentimentAdjustedImpact = baseImpact * (1 + sentimentModifier);

      // Apply aging decay and PR discount
      const effectiveImpact = calculateEffectiveNewsImpact(
        article,
        sentimentAdjustedImpact,
        referenceDate
      );

      totalImpact += effectiveImpact;

      if (effectiveImpact > 0) {
        positiveImpact += effectiveImpact;
      } else {
        negativeImpact += Math.abs(effectiveImpact);
      }
    }
  }

  return {
    totalImpact: Math.round(totalImpact * 100) / 100,
    positiveImpact: Math.round(positiveImpact * 100) / 100,
    negativeImpact: Math.round(negativeImpact * 100) / 100,
    articleCount,
    recentArticleCount,
  };
}

/**
 * Apply news impact to ranking factors
 */
export function applyNewsImpactToRanking(
  baseScores: Record<string, number>,
  newsImpact: ReturnType<typeof calculateToolNewsImpact>
): Record<string, number> {
  const adjustedScores = { ...baseScores };

  // News primarily affects these factors
  const impactDistribution = {
    businessSentiment: 0.4,
    marketTraction: 0.3,
    developerAdoption: 0.2,
    innovation: 0.1,
  };

  // Calculate impact modifier (capped between -2 and +2)
  const impactModifier = Math.max(-2, Math.min(2, newsImpact.totalImpact / 10));

  // Apply impact to relevant factors
  for (const [factor, weight] of Object.entries(impactDistribution)) {
    if (adjustedScores[factor] !== undefined) {
      // Add weighted impact to the factor score
      adjustedScores[factor] = Math.max(
        0,
        Math.min(10, adjustedScores[factor] + impactModifier * weight)
      );
    }
  }

  // Boost development velocity if there's high recent news activity
  if (newsImpact.recentArticleCount > 5) {
    adjustedScores["developmentVelocity"] = Math.min(
      10,
      (adjustedScores["developmentVelocity"] || 5) + 0.5
    );
  }

  logger.info(`Applied news impact for tool:`, {
    newsImpact,
    impactModifier,
    adjustments: Object.entries(impactDistribution).map(([factor, weight]) => ({
      factor,
      adjustment: impactModifier * weight,
    })),
  });

  return adjustedScores;
}
