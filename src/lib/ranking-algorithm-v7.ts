/**
 * Algorithm v7.0: Smart Defaults & Proxy Metrics
 *
 * Key improvements:
 * - Works with available data (news mentions, pricing, features, context window)
 * - Produces 0-100 scores with good distribution
 * - Uses smart defaults and proxy metrics for missing data
 * - Ensures major tools rank appropriately
 */

import { calculateToolNewsImpact, type NewsArticle } from "./ranking-news-impact";

export interface RankingWeightsV7 {
  agenticCapability: number;
  innovation: number;
  technicalPerformance: number;
  developerAdoption: number;
  marketTraction: number;
  businessSentiment: number;
  developmentVelocity: number;
  platformResilience: number;
}

export const ALGORITHM_V7_WEIGHTS: RankingWeightsV7 = {
  agenticCapability: 0.25,
  innovation: 0.125,
  technicalPerformance: 0.125,
  developerAdoption: 0.125,
  marketTraction: 0.125,
  businessSentiment: 0.15,
  developmentVelocity: 0.05,
  platformResilience: 0.05,
};

export interface ToolMetricsV7 {
  tool_id: string;
  name: string;
  category?: string;
  status?: string;

  // Available metrics from data
  info?: {
    features?: string[];
    technical?: {
      context_window?: number;
      multi_file_support?: boolean;
      language_support?: string[];
      llm_providers?: string[];
      swe_bench_score?: number;
    };
    business?: {
      pricing_model?: string;
      base_price?: number;
      pricing_details?: Record<string, string>;
    };
    metrics?: {
      swe_bench?: {
        verified?: number;
        lite?: number;
        full?: number;
      };
      news_mentions?: number;
      news_mention_rate?: string;
      users?: number;
      monthly_arr?: number;
      valuation?: number;
      funding?: number;
      github_stars?: number;
    };
  };

  // Legacy metrics (mostly not available)
  agentic_capability?: number;
  estimated_users?: number;
  monthly_arr?: number;
  github_stars?: number;
  business_sentiment?: number;
  release_frequency?: number;
}

export interface ToolScoreV7 {
  tool_id: string;
  overallScore: number;
  factorScores: Record<string, number>;
  sentimentAnalysis?: {
    rawSentiment: number;
    adjustedSentiment: number;
    newsImpact: number;
  };
  algorithm_version?: string;
}

// For backwards compatibility with existing imports
export interface RankingWeightsV6 extends RankingWeightsV7 {}
export interface ToolMetricsV6 extends ToolMetricsV7 {}
export interface ToolScoreV6 extends ToolScoreV7 {}
export interface CrisisDetection {
  isInCrisis: boolean;
  severityScore: number;
  negativePeriods: number;
  impactMultiplier: number;
}

export class RankingEngineV7 {
  constructor(private weights: RankingWeightsV7 = ALGORITHM_V7_WEIGHTS) {}

  /**
   * Calculate agentic capability using available metrics
   */
  private calculateAgenticCapability(metrics: ToolMetricsV7): number {
    let score = 50; // Base score

    // SWE-bench is the best indicator of agentic capability
    const sweBench = metrics.info?.metrics?.swe_bench;
    if (sweBench?.verified) {
      // Verified scores: 0-100 scale, top tools score 50-70
      score = Math.min(100, (sweBench.verified / 70) * 100);
    } else if (sweBench?.lite || sweBench?.full) {
      // Lite/full scores: usually 0-50 scale
      const benchScore = sweBench.lite || sweBench.full || 0;
      score = Math.min(100, (benchScore / 30) * 80);
    } else if (metrics.info?.technical?.swe_bench_score) {
      // Legacy field
      score = Math.min(100, (metrics.info.technical.swe_bench_score / 50) * 80);
    }

    // Category bonuses
    const categoryBonus: Record<string, number> = {
      "autonomous-agent": 20,
      "code-editor": 15,
      "ide-assistant": 10,
      "devops-assistant": 10,
      "open-source-framework": 5,
      "app-builder": 0,
      "proprietary-ide": 15,
    };

    if (metrics.category && metrics.category in categoryBonus) {
      const bonus = categoryBonus[metrics.category];
      if (bonus !== undefined) {
        score = Math.min(100, score + bonus);
      }
    }

    // Multi-file support bonus
    if (metrics.info?.technical?.multi_file_support) {
      score = Math.min(100, score + 10);
    }

    return score;
  }

  /**
   * Calculate innovation score based on features and recency
   */
  private calculateInnovation(metrics: ToolMetricsV7): number {
    let score = 30; // Base score

    // Feature count as innovation proxy
    const featureCount = metrics.info?.features?.length || 0;
    if (featureCount > 0) {
      score = Math.min(80, 30 + featureCount * 5);
    }

    // Special innovation keywords
    const innovativeKeywords = [
      "specification-driven",
      "autonomous",
      "agent",
      "mcp",
      "scaffolding",
      "multi-modal",
      "reasoning",
      "planning",
      "orchestration",
    ];

    const description = ((metrics.info as any)?.summary || "") + " " + ((metrics.info && 'description' in metrics.info) ? (metrics.info as any).description : "");
    const matchedKeywords = innovativeKeywords.filter((keyword) =>
      description.toLowerCase().includes(keyword)
    ).length;

    score = Math.min(100, score + matchedKeywords * 10);

    return score;
  }

  /**
   * Calculate technical performance using context window and capabilities
   */
  private calculateTechnicalPerformance(metrics: ToolMetricsV7): number {
    let score = 40; // Base score

    // Context window (100k-200k is good, 200k+ is excellent)
    const contextWindow = metrics.info?.technical?.context_window || 0;
    if (contextWindow >= 200000) {
      score = 90;
    } else if (contextWindow >= 100000) {
      score = 70;
    } else if (contextWindow > 0) {
      score = 50 + (contextWindow / 100000) * 20;
    }

    // Language support
    const languageCount = metrics.info?.technical?.language_support?.length || 0;
    if (languageCount >= 10) {
      score = Math.min(100, score + 10);
    } else if (languageCount > 0) {
      score = Math.min(100, score + languageCount);
    }

    // LLM provider diversity
    const llmProviders = metrics.info?.technical?.llm_providers?.length || 0;
    if (llmProviders >= 3) {
      score = Math.min(100, score + 10);
    } else if (llmProviders > 0) {
      score = Math.min(100, score + llmProviders * 3);
    }

    return score;
  }

  /**
   * Calculate developer adoption using news mentions as proxy
   */
  private calculateDeveloperAdoption(metrics: ToolMetricsV7): number {
    let score = 30; // Base score

    // News mentions as adoption proxy
    const newsMentions = metrics.info?.metrics?.news_mentions || 0;
    if (newsMentions >= 15) {
      score = 90;
    } else if (newsMentions >= 10) {
      score = 80;
    } else if (newsMentions >= 5) {
      score = 70;
    } else if (newsMentions >= 2) {
      score = 60;
    } else if (newsMentions >= 1) {
      score = 50;
    }

    // GitHub stars if available
    const githubStars = metrics.info?.metrics?.github_stars || metrics.github_stars || 0;
    if (githubStars >= 50000) {
      score = Math.min(100, score + 20);
    } else if (githubStars >= 10000) {
      score = Math.min(100, score + 15);
    } else if (githubStars >= 1000) {
      score = Math.min(100, score + 10);
    }

    // User count if available
    const users = metrics.info?.metrics?.users || metrics.estimated_users || 0;
    if (users >= 1000000) {
      score = Math.min(100, score + 20);
    } else if (users >= 100000) {
      score = Math.min(100, score + 15);
    } else if (users >= 10000) {
      score = Math.min(100, score + 10);
    }

    return score;
  }

  /**
   * Calculate market traction using pricing and ARR
   */
  private calculateMarketTraction(metrics: ToolMetricsV7): number {
    let score = 30; // Base score

    // Pricing model as market position proxy
    const pricingModel = metrics.info?.business?.pricing_model;
    const basePrice = metrics.info?.business?.base_price || 0;

    if (pricingModel === "subscription" && basePrice >= 20) {
      score = 70; // Premium tools
    } else if (pricingModel === "freemium") {
      score = 60; // Freemium indicates market traction
    } else if (pricingModel === "subscription") {
      score = 50;
    } else if (pricingModel === "free") {
      score = 40; // Open source or free tools
    }

    // ARR if available
    const monthlyArr = metrics.info?.metrics?.monthly_arr || metrics.monthly_arr || 0;
    if (monthlyArr >= 400000000) {
      // $400M+ (Cursor, Copilot level)
      score = 100;
    } else if (monthlyArr >= 100000000) {
      // $100M+
      score = Math.max(score, 90);
    } else if (monthlyArr >= 10000000) {
      // $10M+
      score = Math.max(score, 80);
    } else if (monthlyArr >= 1000000) {
      // $1M+
      score = Math.max(score, 70);
    }

    // Valuation/funding as additional signal
    const valuation = metrics.info?.metrics?.valuation || 0;
    const funding = metrics.info?.metrics?.funding || 0;
    if (valuation >= 1000000000 || funding >= 100000000) {
      score = Math.min(100, score + 10);
    }

    return score;
  }

  /**
   * Calculate business sentiment with news impact
   */
  private calculateBusinessSentiment(
    metrics: ToolMetricsV7,
    newsImpact?: ReturnType<typeof calculateToolNewsImpact>
  ): number {
    let score = 60; // Neutral base

    // Use news mentions as sentiment proxy
    const newsMentions = metrics.info?.metrics?.news_mentions || 0;
    if (newsMentions >= 10) {
      score = 75; // High visibility is generally positive
    } else if (newsMentions >= 5) {
      score = 70;
    } else if (newsMentions >= 1) {
      score = 65;
    }

    // Apply news impact if available
    if (newsImpact && !isNaN(newsImpact.totalImpact)) {
      const impactModifier = newsImpact.totalImpact * 10;
      score = Math.max(0, Math.min(100, score + impactModifier));
    }

    // Category adjustments
    if (metrics.category === "autonomous-agent" || metrics.category === "code-editor") {
      score = Math.min(100, score + 10); // Hot categories
    }

    return score;
  }

  /**
   * Calculate development velocity
   */
  private calculateDevelopmentVelocity(metrics: ToolMetricsV7): number {
    // Default to moderate velocity
    let score = 50;

    // Active status indicates ongoing development
    if (metrics.status === "active") {
      score = 60;
    }

    // More features indicates active development
    const featureCount = metrics.info?.features?.length || 0;
    if (featureCount >= 10) {
      score = Math.min(100, score + 20);
    } else if (featureCount >= 5) {
      score = Math.min(100, score + 10);
    }

    return score;
  }

  /**
   * Calculate platform resilience
   */
  private calculatePlatformResilience(metrics: ToolMetricsV7): number {
    let score = 50; // Base score

    // Multiple LLM providers = resilience
    const llmProviders = metrics.info?.technical?.llm_providers?.length || 0;
    if (llmProviders >= 3) {
      score = 80;
    } else if (llmProviders >= 2) {
      score = 70;
    } else if (llmProviders === 1) {
      score = 60;
    }

    // Open source = more resilient
    if (metrics.category === "open-source-framework") {
      score = Math.min(100, score + 20);
    }

    // Free tier = accessible
    if (
      metrics.info?.business?.pricing_model === "free" ||
      metrics.info?.business?.pricing_model === "freemium"
    ) {
      score = Math.min(100, score + 10);
    }

    return score;
  }

  /**
   * Calculate the overall score (0-100 range)
   */
  calculateToolScore(
    metrics: ToolMetricsV7,
    currentDate: Date = new Date(),
    newsArticles?: NewsArticle[]
  ): ToolScoreV7 {
    // Calculate news impact if articles provided
    let newsImpact = null;
    if (newsArticles && metrics.tool_id) {
      newsImpact = calculateToolNewsImpact(metrics.tool_id, newsArticles, currentDate);
    }

    // Calculate all factor scores (0-100 scale)
    const factorScores = {
      agenticCapability: this.calculateAgenticCapability(metrics),
      innovation: this.calculateInnovation(metrics),
      technicalPerformance: this.calculateTechnicalPerformance(metrics),
      developerAdoption: this.calculateDeveloperAdoption(metrics),
      marketTraction: this.calculateMarketTraction(metrics),
      businessSentiment: this.calculateBusinessSentiment(metrics, newsImpact || undefined),
      developmentVelocity: this.calculateDevelopmentVelocity(metrics),
      platformResilience: this.calculatePlatformResilience(metrics),
      // Add legacy fields for compatibility
      technicalCapability: 0,
      communitySentiment: 0,
    };

    // Set legacy fields to match new ones
    factorScores.technicalCapability = factorScores.technicalPerformance;
    factorScores.communitySentiment = factorScores.businessSentiment;

    // Calculate weighted overall score
    const overallScore = Object.entries(this.weights).reduce((total, [factor, weight]) => {
      const score = factorScores[factor as keyof typeof factorScores] || 0;
      return total + score * weight;
    }, 0);

    return {
      tool_id: metrics.tool_id,
      overallScore: Math.round(overallScore * 10) / 10, // Round to 1 decimal
      factorScores,
      sentimentAnalysis:
        newsImpact && !isNaN(newsImpact.totalImpact)
          ? {
              rawSentiment: 0,
              adjustedSentiment: 0,
              newsImpact: newsImpact.totalImpact,
            }
          : undefined,
      algorithm_version: "v7.0",
    };
  }

  // Legacy methods for compatibility
  calculateBusinessSentimentV7(
    metrics: ToolMetricsV7,
    newsImpact?: ReturnType<typeof calculateToolNewsImpact>
  ) {
    const score = this.calculateBusinessSentiment(metrics, newsImpact);
    return {
      score: score / 10, // Convert to 0-10 scale for legacy compatibility
      rawSentiment: 0,
      adjustedSentiment: 0,
    };
  }

  applyEnhancedNewsImpact(
    baseScores: Record<string, number>,
    _newsImpact: ReturnType<typeof calculateToolNewsImpact>
  ): Record<string, number> {
    // Legacy compatibility - just return scores as-is since news impact is already applied
    return baseScores;
  }

  /**
   * Get algorithm metadata
   */
  static getAlgorithmInfo() {
    return {
      version: "v7.0",
      name: "Smart Defaults & Proxy Metrics",
      description: "Algorithm that works with available data and produces 0-100 scores",
      weights: ALGORITHM_V7_WEIGHTS,
      features: [
        "Works with available data (news mentions, pricing, features)",
        "Produces 0-100 scores with good distribution",
        "Uses smart defaults and proxy metrics",
        "News mentions as adoption proxy",
        "Pricing tier as market position proxy",
        "Category-based scoring adjustments",
        "Ensures major tools rank appropriately",
      ],
      updatedAt: "2025-07-22",
    };
  }
}

// For backwards compatibility - extend base engine
export class RankingEngineV6 extends RankingEngineV7 {}
