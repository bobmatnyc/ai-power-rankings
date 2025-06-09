// import { ToolScore } from "@/types/rankings";

export interface RankingWeightsV6 {
  agenticCapability: number;
  innovation: number;
  technicalPerformance: number;
  developerAdoption: number;
  marketTraction: number;
  businessSentiment: number;
  developmentVelocity: number;
  platformResilience: number;
}

export const ALGORITHM_V6_WEIGHTS: RankingWeightsV6 = {
  agenticCapability: 0.3, // Primary differentiator
  innovation: 0.15, // With decay function
  technicalPerformance: 0.125, // Enhanced benchmark focus
  developerAdoption: 0.125, // Maintained
  marketTraction: 0.125, // With revenue quality
  businessSentiment: 0.075, // With platform risk
  developmentVelocity: 0.05, // Minimum threshold
  platformResilience: 0.05, // With independence bonuses
};

// Platform risk modifiers
export const PLATFORM_RISK_MODIFIERS: Record<string, number> = {
  // Penalties (subtract from business sentiment score)
  acquired_by_llm_provider: -2.0, // OpenAI acquires competitor
  exclusive_llm_dependency: -1.0, // Only works with one LLM
  competitor_controlled: -1.5, // Owned by direct competitor
  regulatory_risk: -0.5, // Privacy/compliance issues
  funding_distress: -1.0, // Running out of funding

  // Bonuses (add to platform resilience score)
  multi_llm_support: 0.5, // Works with 3+ LLM providers
  open_source_llm_ready: 0.3, // Supports open models
  self_hosted_option: 0.3, // Can run locally
};

// Revenue quality multipliers
export const REVENUE_QUALITY_MULTIPLIERS: Record<string, number> = {
  enterprise_high_acv: 1.0, // >$100k ACV
  enterprise_standard: 0.8, // $10k-100k ACV
  smb_saas: 0.6, // <$10k ACV
  consumer_premium: 0.5, // Consumer subscriptions
  freemium: 0.3, // Freemium model
  open_source_donations: 0.2, // Donation-based
};

// Validation rules
export const VALIDATION_RULES = {
  min_metrics_required: 0.8, // 80% of core metrics must be populated
  min_confidence_score: 0.6, // Source reliability threshold
  max_monthly_change: 0.5, // Flag >50% month-over-month changes
  outlier_position_jump: 3, // Flag tools moving >3 positions
};

export interface Innovation {
  score: number;
  date: Date;
  description?: string;
}

export interface ToolMetricsV6 {
  tool_id: string;
  status?: string;
  // Agentic metrics
  agentic_capability?: number;
  swe_bench_score?: number;
  multi_file_capability?: number;
  planning_depth?: number;
  context_utilization?: number;

  // Technical metrics
  context_window?: number;
  language_support?: number;
  github_stars?: number;

  // Innovation metrics
  innovation_score?: number;
  innovations?: Innovation[];

  // Market metrics
  estimated_users?: number;
  monthly_arr?: number;
  valuation?: number;
  funding?: number;
  business_model?: string;

  // Risk and sentiment
  business_sentiment?: number;
  risk_factors?: string[];

  // Development metrics
  release_frequency?: number;
  github_contributors?: number;

  // Platform metrics
  llm_provider_count?: number;
  multi_model_support?: boolean;
  community_size?: number;
}

export interface ToolScoreV6 {
  toolId: string;
  overallScore: number;
  factorScores: {
    agenticCapability: number;
    innovation: number;
    technicalPerformance: number;
    developerAdoption: number;
    marketTraction: number;
    businessSentiment: number;
    developmentVelocity: number;
    platformResilience: number;
    // Add base interface compatibility
    technicalCapability: number;
    communitySentiment: number;
  };
  modifiers: {
    innovationDecay: number;
    platformRisk: number;
    revenueQuality: number;
  };
  validationStatus: {
    isValid: boolean;
    completeness: number;
    confidence: number;
  };
}

export class RankingEngineV6 {
  constructor(private weights: RankingWeightsV6 = ALGORITHM_V6_WEIGHTS) {}

  /**
   * Apply temporal decay to innovation scores
   */
  calculateInnovationWithDecay(innovations: Innovation[] | undefined, currentDate: Date): number {
    if (!innovations || innovations.length === 0) {
      return 5.0; // Default innovation score
    }

    return innovations.reduce((total, innovation) => {
      const monthsOld =
        (currentDate.getTime() - innovation.date.getTime()) / (30 * 24 * 60 * 60 * 1000);
      const decayedScore = innovation.score * Math.exp(-0.115 * monthsOld); // 6-month half-life
      return total + decayedScore;
    }, 0);
  }

  /**
   * Apply platform risk modifiers
   */
  applyPlatformRiskModifiers(riskFactors: string[] = []): number {
    let modifier = 0;
    riskFactors.forEach((factor) => {
      if (PLATFORM_RISK_MODIFIERS[factor] !== undefined) {
        modifier += PLATFORM_RISK_MODIFIERS[factor];
      }
    });
    return modifier;
  }

  /**
   * Calculate quality-adjusted revenue
   */
  calculateQualityAdjustedRevenue(revenue: number, businessModel?: string): number {
    const multiplier =
      businessModel && REVENUE_QUALITY_MULTIPLIERS[businessModel]
        ? REVENUE_QUALITY_MULTIPLIERS[businessModel]
        : 0.5;
    return revenue * multiplier;
  }

  /**
   * Enhanced technical performance calculation
   */
  calculateTechnicalPerformance(metrics: ToolMetricsV6): number {
    const sweBenchScore = (metrics.swe_bench_score || 0) / 100; // Normalize 0-100% to 0-1
    const multiFileScore = (metrics.multi_file_capability || 5) / 10; // Expert assessment 1-10
    const contextScore = Math.min((metrics.context_window || 100000) / 200000, 1); // Normalize to 200k max
    const languageScore = Math.min((metrics.language_support || 10) / 20, 1); // Max 20 languages

    return (
      (sweBenchScore * 0.4 + // Increased from 25% to 40%
        multiFileScore * 0.3 + // Maintained at 30%
        contextScore * 0.2 + // Reduced from 25% to 20%
        languageScore * 0.1) * // Reduced from 25% to 10%
      10
    ); // Scale to 0-10
  }

  /**
   * Enhanced agentic capability calculation
   */
  calculateAgenticCapability(metrics: ToolMetricsV6): number {
    const sweBenchScore = (metrics.swe_bench_score || 0) / 100; // 0-1 scale
    const multiFileScore = (metrics.multi_file_capability || 5) / 10; // 0-1 scale
    const planningScore = (metrics.planning_depth || 5) / 10; // Expert assessment
    const contextUtilScore = (metrics.context_utilization || 5) / 10; // Expert assessment

    return (
      (sweBenchScore * 0.4 + // Primary benchmark
        multiFileScore * 0.25 + // Multi-file capability
        planningScore * 0.2 + // Planning & reasoning
        contextUtilScore * 0.15) * // Context utilization
      10
    ); // Scale to 0-10
  }

  /**
   * Enhanced market traction with quality
   */
  calculateMarketTraction(metrics: ToolMetricsV6): number {
    const adjustedRevenue = this.calculateQualityAdjustedRevenue(
      metrics.monthly_arr || 0,
      metrics.business_model
    );

    // Log scale normalization for exponential metrics
    const revenueScore = Math.log10(adjustedRevenue + 1) / 10; // Normalize to ~0-1
    const userScore = Math.log10((metrics.estimated_users || 0) + 1) / 7; // Normalize to ~0-1
    const fundingScore = Math.log10((metrics.funding || 0) + 1) / 11; // Normalize to ~0-1
    const valuationScore = Math.log10((metrics.valuation || 0) + 1) / 12; // Normalize to ~0-1

    return (
      (revenueScore * 0.4 + // Quality-adjusted revenue primary
        userScore * 0.3 + // User adoption
        fundingScore * 0.2 + // Funding raised
        valuationScore * 0.1) * // Latest valuation
      10
    ); // Scale to 0-10
  }

  /**
   * Calculate developer adoption
   */
  calculateDeveloperAdoption(metrics: ToolMetricsV6): number {
    return Math.min(
      10,
      Math.min(10, ((metrics.estimated_users || 0) / 100000) * 5) * 0.5 +
        Math.min(10, ((metrics.github_stars || 0) / 10000) * 5) * 0.3 +
        ((metrics.community_size || metrics.estimated_users || 0) / 10 / 50000) * 10 * 0.2
    );
  }

  /**
   * Calculate business sentiment with platform risk
   */
  calculateBusinessSentiment(metrics: ToolMetricsV6): number {
    const baseSentiment = (metrics.business_sentiment || 0.5) * 10;
    const platformRiskModifier = this.applyPlatformRiskModifiers(metrics.risk_factors);
    return Math.max(0, Math.min(10, baseSentiment + platformRiskModifier));
  }

  /**
   * Calculate development velocity
   */
  calculateDevelopmentVelocity(metrics: ToolMetricsV6): number {
    return Math.min(
      10,
      ((metrics.release_frequency || 2) / 4) * 10 * 0.5 +
        ((metrics.github_contributors || 10) / 100) * 10 * 0.5
    );
  }

  /**
   * Calculate platform resilience with bonuses
   */
  calculatePlatformResilience(metrics: ToolMetricsV6): number {
    const baseResilience =
      (metrics.status === "acquired" ? 3 : 7) * 0.5 +
      (metrics.multi_model_support || (metrics.llm_provider_count || 1) > 1 ? 10 : 5) * 0.5;

    // Apply positive platform risk modifiers (bonuses)
    let bonus = 0;
    if (metrics.risk_factors) {
      metrics.risk_factors.forEach((factor) => {
        const modifier = PLATFORM_RISK_MODIFIERS[factor];
        if (modifier && modifier > 0) {
          bonus += modifier;
        }
      });
    }

    return Math.min(10, baseResilience + bonus);
  }

  /**
   * Calculate data completeness for validation
   */
  calculateDataCompleteness(metrics: ToolMetricsV6): number {
    const coreMetrics = [
      "agentic_capability",
      "swe_bench_score",
      "estimated_users",
      "monthly_arr",
      "business_sentiment",
      "innovation_score",
      "github_stars",
      "release_frequency",
    ];

    const populated = coreMetrics.filter(
      (key) =>
        metrics[key as keyof ToolMetricsV6] !== undefined &&
        metrics[key as keyof ToolMetricsV6] !== null
    ).length;

    return populated / coreMetrics.length;
  }

  /**
   * Calculate source confidence (placeholder - would use source metadata)
   */
  calculateSourceConfidence(_metrics: ToolMetricsV6): number {
    // In a real implementation, this would check source reliability,
    // recency, and corroboration
    return 0.8; // Default to 80% confidence
  }

  /**
   * Validate tool for ranking inclusion
   */
  validateToolForRanking(metrics: ToolMetricsV6): {
    isValid: boolean;
    completeness: number;
    confidence: number;
  } {
    const completeness = this.calculateDataCompleteness(metrics);
    const confidence = this.calculateSourceConfidence(metrics);

    return {
      isValid:
        completeness >= VALIDATION_RULES.min_metrics_required &&
        confidence >= VALIDATION_RULES.min_confidence_score,
      completeness,
      confidence,
    };
  }

  /**
   * Calculate the overall score for a tool based on Algorithm v6.0
   */
  calculateToolScore(metrics: ToolMetricsV6, currentDate: Date = new Date()): ToolScoreV6 {
    // Validate tool data
    const validationStatus = this.validateToolForRanking(metrics);

    // Calculate factor scores
    const factorScores = {
      agenticCapability: this.calculateAgenticCapability(metrics),
      innovation: this.calculateInnovationWithDecay(metrics.innovations, currentDate),
      technicalPerformance: this.calculateTechnicalPerformance(metrics),
      developerAdoption: this.calculateDeveloperAdoption(metrics),
      marketTraction: this.calculateMarketTraction(metrics),
      businessSentiment: this.calculateBusinessSentiment(metrics),
      developmentVelocity: this.calculateDevelopmentVelocity(metrics),
      platformResilience: this.calculatePlatformResilience(metrics),
      // Add base interface compatibility
      technicalCapability: this.calculateTechnicalPerformance(metrics),
      communitySentiment: 5.0, // Default placeholder
    };

    // Calculate modifiers for transparency
    const modifiers = {
      innovationDecay: metrics.innovation_score
        ? factorScores.innovation / (metrics.innovation_score || 1)
        : 1,
      platformRisk: this.applyPlatformRiskModifiers(metrics.risk_factors),
      revenueQuality: metrics.business_model
        ? REVENUE_QUALITY_MULTIPLIERS[metrics.business_model] || 0.5
        : 0.5,
    };

    // Calculate weighted total - only use factors that have weights
    const overallScore = Object.entries(this.weights).reduce((total, [factor, weight]) => {
      const score = factorScores[factor as keyof typeof factorScores] || 0;
      return total + score * weight;
    }, 0);

    return {
      toolId: metrics.tool_id,
      overallScore: Math.max(0, Math.min(10, Math.round(overallScore * 1000) / 1000)),
      factorScores,
      modifiers,
      validationStatus,
    };
  }

  /**
   * Get algorithm metadata
   */
  static getAlgorithmInfo(): {
    version: string;
    name: string;
    description: string;
    weights: RankingWeightsV6;
    features: string[];
    updatedAt: string;
  } {
    return {
      version: "v6.0",
      name: "Code-Ready Modifiers",
      description:
        "Enhanced algorithm with innovation decay, platform risk, and revenue quality modifiers",
      weights: ALGORITHM_V6_WEIGHTS,
      features: [
        "Innovation decay over time (6-month half-life)",
        "Platform risk penalties and bonuses",
        "Revenue quality adjustments by business model",
        "Enhanced technical performance weighting",
        "Data validation requirements",
        "Logarithmic scaling for market metrics",
      ],
      updatedAt: "2025-06-09",
    };
  }
}
