/**
 * Algorithm v7.0 Fixed: Accurate Capability Scoring with Subprocess/Tool Support
 *
 * Key fixes:
 * - Agentic scoring: Reduced SWE-bench weight, proper category bonuses
 * - Innovation scoring: Better feature detection and breakthrough recognition
 * - Technical performance: Accurate SWE-bench interpretation
 * - Subprocess/tool support: Critical differentiator for autonomous agents
 * - Maintains other scoring factors appropriately
 *
 * Subprocess and tool support scoring:
 * - Both capabilities together: +20 points for agentic, +15 for innovation, +15 for technical
 * - Subprocess alone: +12 agentic, +8 innovation, +10 technical
 * - Tool support alone: +8 agentic, +5 innovation, +5 technical
 */

import * as fs from "node:fs";
import * as path from "node:path";
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
    summary?: string;
    description?: string;
    technical?: {
      context_window?: number;
      multi_file_support?: boolean;
      language_support?: string[];
      llm_providers?: string[];
      swe_bench_score?: number;
      subprocess_support?: boolean;
      tool_support?: boolean;
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
    crisisDetection?: {
      isInCrisis: boolean;
      severityScore: number;
      negativePeriods: number;
      impactMultiplier: number;
    };
  };
  algorithm_version?: string;
}

// For backwards compatibility with existing imports
export type RankingWeightsV6 = RankingWeightsV7;
export type ToolMetricsV6 = ToolMetricsV7;
export type ToolScoreV6 = ToolScoreV7;
export interface CrisisDetection {
  isInCrisis: boolean;
  severityScore: number;
  negativePeriods: number;
  impactMultiplier: number;
}

interface VelocityScore {
  toolId: string;
  toolName: string;
  score: number;
  newsCount30Days: number;
  newsCount90Days: number;
  momentum: string;
}

interface VelocityScoresData {
  generated: string;
  scores: VelocityScore[];
}

export class RankingEngineV7 {
  private velocityScores: Map<string, number> | null = null;

  constructor(private weights: RankingWeightsV7 = ALGORITHM_V7_WEIGHTS) {
    this.loadVelocityScores();
  }

  private loadVelocityScores(): void {
    try {
      const velocityScoresPath = path.join(process.cwd(), "data", "velocity-scores.json");
      if (fs.existsSync(velocityScoresPath)) {
        const data = fs.readFileSync(velocityScoresPath, "utf-8");
        const velocityData: VelocityScoresData = JSON.parse(data);

        this.velocityScores = new Map();
        velocityData.scores.forEach((score) => {
          this.velocityScores?.set(score.toolId, score.score);
        });

        console.log(`Loaded velocity scores for ${this.velocityScores.size} tools`);
      } else {
        console.warn("Velocity scores file not found, using default calculations");
      }
    } catch (error) {
      console.error("Error loading velocity scores:", error);
      this.velocityScores = null;
    }
  }

  /**
   * Calculate agentic capability with proper category differentiation
   */
  private calculateAgenticCapability(metrics: ToolMetricsV7): number {
    let score = 30; // Lower base score

    // Category-based foundation (more differentiated)
    const categoryScores: Record<string, number> = {
      "autonomous-agent": 80, // True autonomous agents (Claude Code, Windsurf)
      "code-editor": 60, // Agentic editors (Cursor)
      "proprietary-ide": 50, // IDEs with AI features
      "ide-assistant": 40, // Copilot-style assistants (autocomplete focus)
      "devops-assistant": 45, // Specialized assistants
      "open-source-framework": 35, // Frameworks
      "app-builder": 25, // Low-code/no-code
    };

    if (metrics.category && categoryScores[metrics.category] !== undefined) {
      score = categoryScores[metrics.category] || 20;
    }

    // Agentic feature detection (look for true autonomous capabilities)
    const agenticFeatures = [
      "autonomous",
      "agent",
      "task execution",
      "workflow",
      "multi-step",
      "planning",
      "reasoning",
      "orchestration",
      "subprocess",
      "delegation",
    ];

    const features = metrics.info?.features || [];
    const description = `${metrics.info?.summary || ""} ${metrics.info?.description || ""}`;
    const allText = `${features.join(" ")} ${description}`;

    const agenticFeatureCount = agenticFeatures.filter((feature) =>
      allText.toLowerCase().includes(feature)
    ).length;

    // Add bonus for true agentic features (but cap it)
    score = Math.min(95, score + agenticFeatureCount * 3); // Reduced multiplier

    // Multi-file support is important for agentic capability
    if (metrics.info?.technical?.multi_file_support) {
      score = Math.min(95, score + 5); // Reduced bonus
    }

    // Subprocess and tool support are CRITICAL for true agentic capability
    const hasSubprocessSupport = metrics.info?.technical?.subprocess_support;
    const hasToolSupport = metrics.info?.technical?.tool_support;

    // These capabilities differentiate autonomous agents from assistants
    if (hasSubprocessSupport && hasToolSupport) {
      // Both together = truly autonomous agent
      score = Math.min(95, score + 20); // Significant boost
    } else if (hasSubprocessSupport) {
      // Subprocess alone is still powerful
      score = Math.min(95, score + 12);
    } else if (hasToolSupport) {
      // Tool support alone is valuable
      score = Math.min(95, score + 8);
    }

    // SWE-bench as supporting evidence (but not primary)
    const sweBench = metrics.info?.metrics?.swe_bench;
    if (sweBench?.verified || sweBench?.lite || sweBench?.full) {
      const benchScore = sweBench.verified || sweBench.lite || sweBench.full || 0;
      // Add modest bonus for good SWE-bench (max 10 points)
      const sweBonusMultiplier = Math.min(1, benchScore / 50);
      score = Math.min(95, score + sweBonusMultiplier * 10);
    }

    // Special cases for known tools
    if (metrics.name?.toLowerCase().includes("claude code")) {
      score = Math.max(score, 85); // Ensure Claude Code scores high
      score = Math.min(score, 90); // But cap at reasonable level
    } else if (
      metrics.name?.toLowerCase().includes("copilot") &&
      metrics.category === "ide-assistant"
    ) {
      score = Math.min(score, 50); // Cap Copilot as it's autocomplete-focused
    }

    return score;
  }

  /**
   * Calculate innovation score with better breakthrough detection
   */
  private calculateInnovation(metrics: ToolMetricsV7): number {
    let score = 30; // Base score

    // Feature count as baseline
    const featureCount = metrics.info?.features?.length || 0;
    if (featureCount > 0) {
      score = Math.min(60, 30 + featureCount * 3);
    }

    // Breakthrough innovation keywords (more comprehensive)
    const breakthroughKeywords = [
      "specification-driven",
      "autonomous",
      "agent",
      "mcp",
      "scaffolding",
      "multi-modal",
      "reasoning",
      "planning",
      "orchestration",
      "breakthrough",
      "first",
      "novel",
      "unique",
      "revolutionary",
      "paradigm",
      "next-generation",
    ];

    // Technical innovation indicators
    const technicalInnovations = [
      "200k",
      "context",
      "multi-file",
      "cross-repository",
      "enterprise",
      "production",
      "deployment",
      "real-world",
      "comprehensive",
      "subprocess",
      "tool",
      "integration",
      "extensible",
      "plugin",
      "api",
    ];

    const allText =
      (metrics.info?.summary || "") +
      " " +
      (metrics.info?.description || "") +
      " " +
      (metrics.info?.features?.join(" ") || "");

    const breakthroughCount = breakthroughKeywords.filter((keyword) =>
      allText.toLowerCase().includes(keyword)
    ).length;

    const technicalCount = technicalInnovations.filter((keyword) =>
      allText.toLowerCase().includes(keyword)
    ).length;

    // More aggressive scoring for innovation (but cap total)
    score = Math.min(85, score + breakthroughCount * 6 + technicalCount * 4);

    // Category bonuses for innovative categories
    if (metrics.category === "autonomous-agent") {
      score = Math.min(90, score + 10);
    } else if (metrics.category === "code-editor") {
      score = Math.min(85, score + 8);
    }

    // Subprocess and tool support represent innovative architecture
    const hasSubprocessSupport = metrics.info?.technical?.subprocess_support;
    const hasToolSupport = metrics.info?.technical?.tool_support;

    if (hasSubprocessSupport && hasToolSupport) {
      // Both together represent cutting-edge architecture
      score = Math.min(90, score + 15);
    } else if (hasSubprocessSupport) {
      score = Math.min(90, score + 8);
    } else if (hasToolSupport) {
      score = Math.min(90, score + 5);
    }

    // Special recognition for Claude Code's innovations
    if (metrics.name?.toLowerCase().includes("claude code")) {
      score = Math.max(score, 75); // Specification-driven development is innovative
      score = Math.min(score, 80); // But keep it reasonable
    }

    return score;
  }

  /**
   * Calculate technical performance with accurate SWE-bench interpretation
   */
  private calculateTechnicalPerformance(metrics: ToolMetricsV7): number {
    let score = 40; // Base score

    // SWE-bench scores (properly interpret the scale)
    const sweBench = metrics.info?.metrics?.swe_bench;
    if (sweBench?.lite !== undefined) {
      // SWE-bench lite: 47.4% is excellent (Claude Code level)
      // Scale: 0-20% poor, 20-30% good, 30-40% very good, 40%+ excellent
      if (sweBench.lite >= 40) {
        score = 90; // Top tier performance
      } else if (sweBench.lite >= 30) {
        score = 80;
      } else if (sweBench.lite >= 20) {
        score = 70;
      } else if (sweBench.lite >= 10) {
        score = 60;
      } else {
        score = 50;
      }
    } else if (sweBench?.verified !== undefined) {
      // Verified scores tend to be higher
      if (sweBench.verified >= 50) {
        score = 90;
      } else if (sweBench.verified >= 40) {
        score = 80;
      } else if (sweBench.verified >= 30) {
        score = 70;
      } else {
        score = 60;
      }
    }

    // Context window (200k is standard for top tools)
    const contextWindow = metrics.info?.technical?.context_window || 0;
    if (contextWindow >= 200000) {
      score = Math.max(score, 80); // Ensure good score for large context
    } else if (contextWindow >= 100000) {
      score = Math.max(score, 70);
    }

    // Technical capabilities
    const languageCount = metrics.info?.technical?.language_support?.length || 0;
    if (languageCount >= 10) {
      score = Math.min(100, score + 5);
    }

    const llmProviders = metrics.info?.technical?.llm_providers?.length || 0;
    if (llmProviders >= 3) {
      score = Math.min(100, score + 5);
    }

    // Multi-file support is technically important
    if (metrics.info?.technical?.multi_file_support) {
      score = Math.min(100, score + 5);
    }

    // Subprocess and tool support are technical differentiators
    const hasSubprocessSupport = metrics.info?.technical?.subprocess_support;
    const hasToolSupport = metrics.info?.technical?.tool_support;

    if (hasSubprocessSupport) {
      score = Math.min(100, score + 10); // Subprocess support is technically advanced
    }

    if (hasToolSupport) {
      score = Math.min(100, score + 5); // Tool support adds technical capability
    }

    // Ensure Claude Code's technical excellence is recognized
    if (
      metrics.name?.toLowerCase().includes("claude code") &&
      sweBench?.lite &&
      sweBench.lite >= 47
    ) {
      score = Math.max(score, 92); // Top technical performance
      score = Math.min(score, 95); // But keep reasonable
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
    if (newsImpact && !Number.isNaN(newsImpact.totalImpact)) {
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
   * Calculate development velocity using pre-calculated news-based scores
   */
  private calculateDevelopmentVelocity(metrics: ToolMetricsV7): number {
    // First, try to use pre-calculated velocity scores from news analysis
    if (this.velocityScores?.has(metrics.tool_id)) {
      const velocityScore = this.velocityScores.get(metrics.tool_id)!;
      console.log(`Using news-based velocity score for ${metrics.name}: ${velocityScore}`);
      return velocityScore;
    }

    // Fallback to default calculation if no velocity score available
    console.log(`No velocity score found for ${metrics.name}, using default calculation`);

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
    let newsImpact: ReturnType<typeof calculateToolNewsImpact> | undefined;
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
      businessSentiment: this.calculateBusinessSentiment(metrics, newsImpact),
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
        newsImpact && !Number.isNaN(newsImpact.totalImpact)
          ? {
              rawSentiment: 0,
              adjustedSentiment: 0,
              newsImpact: newsImpact.totalImpact,
              crisisDetection: {
                isInCrisis: false,
                severityScore: 0,
                negativePeriods: 0,
                impactMultiplier: 1,
              },
            }
          : undefined,
      algorithm_version: "v7.0-fixed",
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
      crisisDetection: {
        isInCrisis: false,
        severityScore: 0,
        negativePeriods: 0,
        impactMultiplier: 1,
      },
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
      version: "v7.0-fixed",
      name: "Smart Defaults & Accurate Capability Scoring with Dynamic Velocity",
      description:
        "Algorithm with fixed agentic, innovation, and technical scoring including subprocess/tool support and news-based velocity scores",
      weights: ALGORITHM_V7_WEIGHTS,
      features: [
        "Accurate agentic capability scoring (autonomous vs autocomplete)",
        "Enhanced innovation detection for breakthrough features",
        "Subprocess and tool support scoring for true autonomy",
        "Proper SWE-bench score interpretation",
        "Category-based differentiation",
        "Smart defaults and proxy metrics",
        "News mentions as adoption proxy",
        "Dynamic development velocity based on news analysis (0-100 scale)",
        "Recognizes tools with advanced autonomous capabilities",
        "Ensures accurate tool rankings",
      ],
      updatedAt: "2025-07-23",
    };
  }
}

// For backwards compatibility - extend base engine
export class RankingEngineV6 extends RankingEngineV7 {}
