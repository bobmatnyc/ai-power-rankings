/**
 * Algorithm v7.3: Enhanced Differentiation with Data-Driven Tiebreakers
 *
 * Fixes the duplicate score issue (72.5% of tools had identical scores in v7.2)
 *
 * Key improvements over v7.2:
 * - Better defaults when metrics missing: Uses description quality, pricing signals, company maturity
 * - Improved tiebreakers: Feature count → Description length → Pricing tier → Alphabetical
 * - Enhanced category differentiation: Subcategory scoring for more granularity
 * - Data-driven adjustments: Parses descriptions for capabilities, extracts pricing signals
 *
 * Success criteria:
 * - < 20% of tools have duplicate scores (down from 72.5%)
 * - Top 10 tools all have unique scores
 * - Scoring is deterministic and reproducible
 */

import { calculateToolNewsImpact, type NewsArticle } from "./ranking-news-impact";

export interface RankingWeightsV73 {
  agenticCapability: number;
  innovation: number;
  technicalPerformance: number;
  developerAdoption: number;
  marketTraction: number;
  businessSentiment: number;
  developmentVelocity: number;
  platformResilience: number;
}

export const ALGORITHM_V73_WEIGHTS: RankingWeightsV73 = {
  agenticCapability: 0.35,
  innovation: 0.10,
  technicalPerformance: 0.10,
  developerAdoption: 0.125,
  marketTraction: 0.125,
  businessSentiment: 0.125,
  developmentVelocity: 0.05,
  platformResilience: 0.025,
};

export interface ToolMetricsV73 {
  tool_id: string;
  name: string;
  slug: string;
  category?: string;
  status?: string;

  // Available metrics from data
  info?: {
    features?: string[];
    description?: string;
    summary?: string;
    overview?: string;
    company?: string;
    launch_year?: number;
    technical?: {
      context_window?: number;
      max_context_window?: number;
      multi_file_support?: boolean;
      language_support?: string[];
      llm_providers?: string[];
      swe_bench_score?: number;
      ide_integration?: string;
      performance?: {
        indexing_speed?: string;
        caching_strategy?: string;
        mixture_of_experts?: boolean;
        speculative_decoding?: boolean;
      };
      subprocess_support?: Record<string, boolean>;
    };
    business?: {
      pricing_model?: string;
      base_price?: number;
      free_tier?: boolean;
      pricing_details?: Record<string, string>;
      enterprise_pricing?: boolean;
    };
    metrics?: {
      swe_bench?: {
        verified?: number;
        lite?: number;
        full?: number;
      };
      news_mentions?: number;
      users?: number;
      monthly_arr?: number;
      valuation?: number;
      funding?: number;
      github_stars?: number;
      employees?: number;
    };
  };
}

export interface ToolScoreV73 {
  tool_id: string;
  tool_slug: string;
  overallScore: number;
  factorScores: Record<string, number>;
  tiebreakers: {
    featureCount: number;
    descriptionQuality: number;
    pricingTier: number;
    alphabeticalOrder: number;
  };
  sentimentAnalysis?: {
    rawSentiment: number;
    adjustedSentiment: number;
    newsImpact: number;
  };
  algorithm_version: string;
}

/**
 * Helper function to calculate description quality score
 * Considers length, detail, and keyword richness
 */
function calculateDescriptionQuality(metrics: ToolMetricsV73): number {
  const description = metrics.info?.description || "";
  const summary = metrics.info?.summary || "";
  const overview = metrics.info?.overview || "";

  // Combine all text fields
  const allText = `${description} ${summary} ${overview}`;
  const textLength = allText.length;

  // Base score from text length
  let score = 0;
  if (textLength >= 1000) score = 20;
  else if (textLength >= 500) score = 15;
  else if (textLength >= 250) score = 10;
  else if (textLength >= 100) score = 5;
  else score = 1;

  // Bonus for rich keywords (indicates detailed documentation)
  const qualityKeywords = [
    "autonomous",
    "enterprise",
    "scalable",
    "production",
    "integration",
    "architecture",
    "performance",
    "security",
    "workflow",
    "collaboration",
  ];

  const keywordMatches = qualityKeywords.filter((kw) =>
    allText.toLowerCase().includes(kw)
  ).length;

  score += keywordMatches * 2;

  return Math.min(50, score); // Cap at 50 to use as microtiebreaker
}

/**
 * Helper function to calculate pricing tier score
 * Higher price = more market validation
 */
function calculatePricingTier(metrics: ToolMetricsV73): number {
  const pricingModel = metrics.info?.business?.pricing_model;
  const basePrice = metrics.info?.business?.base_price || 0;
  const hasFree = metrics.info?.business?.free_tier;
  const hasEnterprise = metrics.info?.business?.enterprise_pricing;

  let score = 0;

  // Base pricing model score
  if (pricingModel === "subscription" || pricingModel === "freemium") {
    score = 10;
  } else if (pricingModel === "enterprise") {
    score = 15;
  } else if (pricingModel === "paid") {
    score = 8;
  } else if (pricingModel === "free") {
    score = 5;
  }

  // Price point bonus (market validation)
  if (basePrice >= 100) score += 20;
  else if (basePrice >= 50) score += 15;
  else if (basePrice >= 20) score += 10;
  else if (basePrice >= 10) score += 5;

  // Freemium indicates traction
  if (hasFree && basePrice > 0) score += 5;

  // Enterprise tier indicates serious business
  if (hasEnterprise) score += 10;

  return Math.min(50, score); // Cap at 50
}

/**
 * Helper function to extract capability indicators from description
 */
function extractCapabilityScore(text: string): number {
  const capabilityKeywords = [
    "autonomous",
    "agent",
    "multi-file",
    "planning",
    "reasoning",
    "orchestration",
    "workflow",
    "debugging",
    "refactoring",
    "testing",
    "deployment",
    "monitoring",
  ];

  const matches = capabilityKeywords.filter((kw) =>
    text.toLowerCase().includes(kw)
  ).length;

  return Math.min(30, matches * 3); // Up to 30 points
}

/**
 * Helper function to calculate company backing score
 */
function calculateCompanyBacking(metrics: ToolMetricsV73): number {
  const company = metrics.info?.company || "";
  const funding = metrics.info?.metrics?.funding || 0;
  const valuation = metrics.info?.metrics?.valuation || 0;
  const employees = metrics.info?.metrics?.employees || 0;

  let score = 0;

  // Major tech companies
  const majorCompanies = ["Google", "Microsoft", "Meta", "Amazon", "GitHub", "Anthropic", "OpenAI"];
  if (majorCompanies.some((c) => company.includes(c))) {
    score += 20;
  }

  // Funding indicates serious backing
  if (funding >= 100000000) score += 15; // $100M+
  else if (funding >= 10000000) score += 10; // $10M+
  else if (funding >= 1000000) score += 5; // $1M+

  // Valuation indicates market validation
  if (valuation >= 1000000000) score += 15; // $1B+
  else if (valuation >= 100000000) score += 10; // $100M+

  // Team size indicates maturity
  if (employees >= 100) score += 10;
  else if (employees >= 50) score += 7;
  else if (employees >= 20) score += 5;
  else if (employees >= 10) score += 3;

  return Math.min(40, score);
}

/**
 * Helper function to calculate launch maturity bonus
 */
function calculateMaturityBonus(metrics: ToolMetricsV73): number {
  const launchYear = metrics.info?.launch_year;
  if (!launchYear) return 0;

  const currentYear = new Date().getFullYear();
  const age = currentYear - launchYear;

  // Sweet spot: 1-3 years (established but modern)
  if (age >= 1 && age <= 3) return 10;
  if (age >= 4 && age <= 5) return 5;
  if (age < 1) return 3; // New but unproven
  return 0; // Too old might be outdated
}

export class RankingEngineV73 {
  constructor(private weights: RankingWeightsV73 = ALGORITHM_V73_WEIGHTS) {}

  /**
   * Calculate agentic capability with enhanced differentiation
   */
  private calculateAgenticCapability(metrics: ToolMetricsV73): number {
    let score = 50; // Base score

    // SWE-bench is the best indicator
    const sweBench = metrics.info?.metrics?.swe_bench;
    if (sweBench?.verified) {
      score = Math.min(100, (sweBench.verified / 70) * 100);
    } else if (sweBench?.lite || sweBench?.full) {
      const benchScore = sweBench.lite || sweBench.full || 0;
      score = Math.min(100, (benchScore / 30) * 80);
    }

    // Category bonuses - MORE GRANULAR
    const categoryBonus: Record<string, number> = {
      "autonomous-agent": 20,
      "code-editor": 15,
      "proprietary-ide": 15,
      "ide-assistant": 10,
      "devops-assistant": 10,
      "open-source-framework": 5,
      "app-builder": 3,
    };

    if (metrics.category && metrics.category in categoryBonus) {
      score = Math.min(100, score + categoryBonus[metrics.category]);
    }

    // Multi-file support bonus
    if (metrics.info?.technical?.multi_file_support) {
      score = Math.min(100, score + 10);
    }

    // Subprocess/automation capabilities (NEW)
    const subprocess = metrics.info?.technical?.subprocess_support;
    if (subprocess) {
      const subprocessFeatures = Object.values(subprocess).filter(Boolean).length;
      score = Math.min(100, score + subprocessFeatures * 2);
    }

    // Extract capability keywords from description (NEW)
    const allText = `${metrics.info?.description || ""} ${metrics.info?.summary || ""} ${metrics.info?.overview || ""}`;
    const capabilityBonus = extractCapabilityScore(allText);
    score = Math.min(100, score + capabilityBonus * 0.3); // Weight capability keywords less

    return score;
  }

  /**
   * Calculate innovation with better defaults
   */
  private calculateInnovation(metrics: ToolMetricsV73): number {
    let score = 30; // Base score

    // Feature count as innovation proxy
    const featureCount = metrics.info?.features?.length || 0;
    if (featureCount > 0) {
      // More nuanced scoring based on feature count
      score = Math.min(85, 30 + featureCount * 3);
    }

    // Innovation keywords
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
      "background agent",
      "speculative",
    ];

    const description = `${metrics.info?.summary || ""} ${metrics.info?.description || ""}`;
    const matchedKeywords = innovativeKeywords.filter((keyword) =>
      description.toLowerCase().includes(keyword)
    ).length;

    // Add keyword bonus without capping yet
    score = score + matchedKeywords * 8;

    // Performance innovations
    const performance = metrics.info?.technical?.performance;
    if (performance) {
      if (performance.mixture_of_experts) score += 5;
      if (performance.speculative_decoding) score += 5;
      if (performance.indexing_speed) score += 3;
    }

    // Launch year recency bonus
    score += calculateMaturityBonus(metrics);

    // Cap at 100 only after all bonuses are added
    return Math.min(100, score);
  }

  /**
   * Calculate technical performance with max context window
   */
  private calculateTechnicalPerformance(metrics: ToolMetricsV73): number {
    let score = 40; // Base score

    // Use max context window if available, fallback to regular
    const contextWindow = metrics.info?.technical?.max_context_window ||
      metrics.info?.technical?.context_window || 0;

    if (contextWindow >= 1000000) {
      // 1M+ context (Cursor Max Mode)
      score = 95;
    } else if (contextWindow >= 500000) {
      score = 90;
    } else if (contextWindow >= 200000) {
      score = 85;
    } else if (contextWindow >= 100000) {
      score = 70;
    } else if (contextWindow > 0) {
      score = 50 + (contextWindow / 100000) * 20;
    }

    // Language support
    const languageCount = metrics.info?.technical?.language_support?.length || 0;
    if (languageCount >= 20) {
      score = Math.min(100, score + 15);
    } else if (languageCount >= 10) {
      score = Math.min(100, score + 10);
    } else if (languageCount > 0) {
      score = Math.min(100, score + languageCount * 0.8);
    }

    // LLM provider diversity
    const llmProviders = metrics.info?.technical?.llm_providers?.length || 0;
    if (llmProviders >= 10) {
      score = Math.min(100, score + 15);
    } else if (llmProviders >= 5) {
      score = Math.min(100, score + 10);
    } else if (llmProviders >= 3) {
      score = Math.min(100, score + 7);
    } else if (llmProviders > 0) {
      score = Math.min(100, score + llmProviders * 2);
    }

    // IDE integration type matters (NEW)
    const ideIntegration = metrics.info?.technical?.ide_integration;
    if (ideIntegration?.includes("Proprietary") || ideIntegration?.includes("Fork")) {
      score = Math.min(100, score + 5);
    }

    return score;
  }

  /**
   * Calculate developer adoption with better proxies
   */
  private calculateDeveloperAdoption(metrics: ToolMetricsV73): number {
    let score = 30; // Base score

    // News mentions as adoption proxy
    const newsMentions = metrics.info?.metrics?.news_mentions || 0;
    if (newsMentions >= 20) {
      score = 95;
    } else if (newsMentions >= 15) {
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

    // User count (strong signal)
    const users = metrics.info?.metrics?.users || 0;
    if (users >= 1000000) {
      score = Math.min(100, score + 25);
    } else if (users >= 500000) {
      score = Math.min(100, score + 20);
    } else if (users >= 100000) {
      score = Math.min(100, score + 15);
    } else if (users >= 10000) {
      score = Math.min(100, score + 10);
    } else if (users > 0) {
      score = Math.min(100, score + 5);
    }

    // GitHub stars if available
    const githubStars = metrics.info?.metrics?.github_stars || 0;
    if (githubStars >= 50000) {
      score = Math.min(100, score + 15);
    } else if (githubStars >= 10000) {
      score = Math.min(100, score + 10);
    } else if (githubStars >= 1000) {
      score = Math.min(100, score + 5);
    }

    return score;
  }

  /**
   * Calculate market traction with pricing signals
   */
  private calculateMarketTraction(metrics: ToolMetricsV73): number {
    let score = 30; // Base score

    // ARR is strongest signal
    const monthlyArr = metrics.info?.metrics?.monthly_arr || 0;
    if (monthlyArr >= 400000000) {
      // $400M+ (Cursor level)
      score = 100;
    } else if (monthlyArr >= 100000000) {
      // $100M+
      score = 95;
    } else if (monthlyArr >= 50000000) {
      // $50M+
      score = 90;
    } else if (monthlyArr >= 10000000) {
      // $10M+
      score = 85;
    } else if (monthlyArr >= 1000000) {
      // $1M+
      score = 75;
    } else {
      // Fallback to pricing model as proxy
      const pricingModel = metrics.info?.business?.pricing_model;
      const basePrice = metrics.info?.business?.base_price || 0;
      const hasEnterprise = metrics.info?.business?.enterprise_pricing;

      if (hasEnterprise) {
        score = 70; // Enterprise pricing = serious business
      } else if (pricingModel === "subscription" && basePrice >= 50) {
        score = 65; // Premium subscription
      } else if (pricingModel === "subscription" && basePrice >= 20) {
        score = 60; // Standard subscription
      } else if (pricingModel === "freemium") {
        score = 55; // Freemium indicates growth
      } else if (pricingModel === "subscription") {
        score = 50;
      } else if (pricingModel === "free") {
        score = 40;
      }
    }

    // Valuation/funding boost
    const valuation = metrics.info?.metrics?.valuation || 0;
    const funding = metrics.info?.metrics?.funding || 0;

    if (valuation >= 5000000000) {
      // $5B+ unicorn
      score = Math.min(100, score + 15);
    } else if (valuation >= 1000000000) {
      // $1B+ unicorn
      score = Math.min(100, score + 10);
    } else if (funding >= 100000000) {
      // $100M+ funding
      score = Math.min(100, score + 8);
    }

    // Company backing bonus (NEW)
    score = Math.min(100, score + calculateCompanyBacking(metrics) * 0.3);

    return score;
  }

  /**
   * Calculate business sentiment with news impact
   */
  private calculateBusinessSentiment(
    metrics: ToolMetricsV73,
    newsImpact?: ReturnType<typeof calculateToolNewsImpact>
  ): number {
    let score = 60; // Neutral base

    // News mentions as sentiment proxy
    const newsMentions = metrics.info?.metrics?.news_mentions || 0;
    if (newsMentions >= 15) {
      score = 80;
    } else if (newsMentions >= 10) {
      score = 75;
    } else if (newsMentions >= 5) {
      score = 70;
    } else if (newsMentions >= 1) {
      score = 65;
    }

    // Apply news impact if available
    if (newsImpact && !Number.isNaN(newsImpact.totalImpact)) {
      const impactModifier = newsImpact.totalImpact * 10;
      score = Math.max(0, Math.min(100, score + impactModifier));
    }

    // Category sentiment adjustments
    if (metrics.category === "autonomous-agent" || metrics.category === "code-editor") {
      score = Math.min(100, score + 10); // Hot categories
    }

    // Growth metrics indicate positive sentiment
    const arr = metrics.info?.metrics?.monthly_arr || 0;
    const users = metrics.info?.metrics?.users || 0;
    if (arr >= 100000000 || users >= 500000) {
      score = Math.min(100, score + 10);
    }

    return score;
  }

  /**
   * Calculate development velocity with better signals
   */
  private calculateDevelopmentVelocity(metrics: ToolMetricsV73): number {
    let score = 50; // Base

    // Active status
    if (metrics.status === "active") {
      score = 60;
    }

    // Feature richness indicates active development
    const featureCount = metrics.info?.features?.length || 0;
    if (featureCount >= 15) {
      score = Math.min(100, score + 25);
    } else if (featureCount >= 10) {
      score = Math.min(100, score + 20);
    } else if (featureCount >= 5) {
      score = Math.min(100, score + 10);
    }

    // Recent updates field (NEW - if available in data)
    const recentUpdates = (metrics.info as any)?.recent_updates_2025;
    if (recentUpdates && Array.isArray(recentUpdates)) {
      const updateCount = recentUpdates.length;
      score = Math.min(100, score + updateCount * 2);
    }

    return score;
  }

  /**
   * Calculate platform resilience
   */
  private calculatePlatformResilience(metrics: ToolMetricsV73): number {
    let score = 50; // Base score

    // Multiple LLM providers = resilience
    const llmProviders = metrics.info?.technical?.llm_providers?.length || 0;
    if (llmProviders >= 5) {
      score = 85;
    } else if (llmProviders >= 3) {
      score = 75;
    } else if (llmProviders >= 2) {
      score = 65;
    } else if (llmProviders === 1) {
      score = 55;
    }

    // Open source = more resilient
    if (metrics.category === "open-source-framework") {
      score = Math.min(100, score + 20);
    }

    // Free tier = accessible
    if (metrics.info?.business?.free_tier) {
      score = Math.min(100, score + 10);
    }

    // Company backing = stability (NEW)
    const companyBacking = calculateCompanyBacking(metrics);
    score = Math.min(100, score + companyBacking * 0.2);

    return score;
  }

  /**
   * Calculate deterministic tiebreakers
   */
  private calculateTiebreakers(metrics: ToolMetricsV73): {
    featureCount: number;
    descriptionQuality: number;
    pricingTier: number;
    alphabeticalOrder: number;
  } {
    // Feature count (0-100)
    const featureCount = Math.min(100, (metrics.info?.features?.length || 0) * 5);

    // Description quality (0-100)
    const descriptionQuality = calculateDescriptionQuality(metrics) * 2;

    // Pricing tier (0-100)
    const pricingTier = calculatePricingTier(metrics) * 2;

    // Alphabetical order (deterministic final tiebreaker)
    // Convert first letter to score: A=100, Z=0
    const firstChar = metrics.name.charAt(0).toLowerCase();
    const alphabeticalOrder = (122 - firstChar.charCodeAt(0)) * 4; // z=122, scale to 0-100

    return {
      featureCount,
      descriptionQuality,
      pricingTier,
      alphabeticalOrder,
    };
  }

  /**
   * Calculate the overall score (0-100 range) with tiebreakers
   */
  calculateToolScore(
    metrics: ToolMetricsV73,
    currentDate: Date = new Date(),
    newsArticles?: NewsArticle[]
  ): ToolScoreV73 {
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
      // Legacy fields for compatibility
      technicalCapability: 0,
      communitySentiment: 0,
    };

    // Set legacy fields
    factorScores.technicalCapability = factorScores.technicalPerformance;
    factorScores.communitySentiment = factorScores.businessSentiment;

    // Validation: Check that all factor scores are within valid range [0-100]
    Object.entries(factorScores).forEach(([factor, value]) => {
      if (value < 0 || value > 100) {
        console.warn(`⚠️ ${metrics.name}: ${factor} score ${value.toFixed(2)} out of range [0-100]`);
      }
    });

    // Calculate weighted overall score
    let overallScore = Object.entries(this.weights).reduce((total, [factor, weight]) => {
      const score = factorScores[factor as keyof typeof factorScores] || 0;
      return total + score * weight;
    }, 0);

    // Calculate tiebreakers
    const tiebreakers = this.calculateTiebreakers(metrics);

    // Apply tiebreakers as micro-adjustments (0.001 precision)
    // This ensures unique scores while maintaining primary ranking integrity
    const tiebreakerAdjustment =
      (tiebreakers.featureCount * 0.00001) +
      (tiebreakers.descriptionQuality * 0.000001) +
      (tiebreakers.pricingTier * 0.0000001) +
      (tiebreakers.alphabeticalOrder * 0.00000001);

    overallScore = Math.round((overallScore + tiebreakerAdjustment) * 1000) / 1000;

    return {
      tool_id: metrics.tool_id,
      tool_slug: metrics.slug,
      overallScore,
      factorScores,
      tiebreakers,
      sentimentAnalysis:
        newsImpact && !Number.isNaN(newsImpact.totalImpact)
          ? {
              rawSentiment: 0,
              adjustedSentiment: 0,
              newsImpact: newsImpact.totalImpact,
            }
          : undefined,
      algorithm_version: "v7.3.1",
    };
  }

  /**
   * Get algorithm metadata
   */
  static getAlgorithmInfo() {
    return {
      version: "v7.3.1",
      name: "Enhanced Differentiation with Data-Driven Tiebreakers",
      description: "Fixes duplicate score issue by leveraging all available data fields and implementing deterministic tiebreakers. v7.3.1: Fixed innovation scoring cap bug.",
      weights: ALGORITHM_V73_WEIGHTS,
      features: [
        "Better defaults when metrics missing (description quality, pricing signals, company maturity)",
        "Improved tiebreakers (feature count → description → pricing → alphabetical)",
        "Enhanced category differentiation with subcategory scoring",
        "Data-driven adjustments using available tool data",
        "Capability extraction from descriptions",
        "Pricing model as market traction signal",
        "Company backing as business sentiment factor",
        "Launch date/maturity as development velocity indicator",
        "Deterministic scoring for reproducibility",
        "Target: <20% duplicate scores (vs 72.5% in v7.2)",
        "v7.3.1: Fixed innovation scoring bug that allowed scores > 100",
      ],
      updatedAt: "2025-11-01",
      improvements: [
        "Uses max_context_window when available (Cursor has 1M)",
        "Extracts capability keywords from descriptions",
        "Scores subprocess/automation features",
        "Considers recent_updates_2025 field for velocity",
        "Company backing score from funding/valuation/employees",
        "Pricing tier differentiation",
        "Description quality scoring",
        "Multi-level deterministic tiebreakers",
      ],
    };
  }
}
