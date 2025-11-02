
import { calculateToolNewsImpact, type NewsArticle } from "./ranking-news-impact";

export interface RankingWeightsV75 {
  agenticCapability: number;
  innovation: number;
  technicalPerformance: number;
  developerAdoption: number;
  marketTraction: number;
  businessSentiment: number;
  developmentVelocity: number;
  platformResilience: number;
}

export const ALGORITHM_V75_WEIGHTS: RankingWeightsV75 = {
  agenticCapability: 0.12,      // ↓ from 0.35 - reduce theory-based scoring
  innovation: 0.08,              // ↓ from 0.10 - reduce hype-based scoring
  technicalPerformance: 0.18,    // ↓ from 0.10 - maintain benchmark value
  developerAdoption: 0.18,       // ↑ from 0.125 - MAJOR INCREASE for real users
  marketTraction: 0.10,          // ↑ from 0.125 - MAJOR INCREASE for market validation
  businessSentiment: 0.12,       // ↓ from 0.125 - maintain enterprise signals
  developmentVelocity: 0.12,     // ↑ from 0.05 - reward active development
  platformResilience: 0.10,      // ↑ from 0.025 - reward stability
};

export interface ToolMetricsV75 {
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
    company_name?: string;
    launch_year?: number;
    pricing_model?: string;
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
      annual_recurring_revenue?: number;
      valuation?: number;
      funding?: number;
      github_stars?: number;
      employees?: number;
    };
    // Additional metrics that might be present
    github_stats?: {
      stars?: number;
      forks?: number;
      watchers?: number;
    };
    vscode_installs?: number;
    npm_downloads?: number;
    user_count?: number;
    annual_recurring_revenue?: number;
    swe_bench_score?: number;
  };
}

export interface ToolScoreV75 {
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
  dataCompleteness: number;
  confidenceMultiplier: number;
  sentimentAnalysis?: {
    rawSentiment: number;
    adjustedSentiment: number;
    newsImpact: number;
  };
  algorithm_version: string;
}

/**
 * NEW: Calculate data completeness percentage
 * Returns 0-100 based on availability of real-world metrics
 */
function calculateDataCompleteness(metrics: ToolMetricsV75): number {
  // Helper to safely check numeric values
  const hasValue = (value: any): boolean => {
    return value !== undefined && value !== null && value > 0;
  };

  // Access the actual metrics data location
  const metricsData = (metrics as any).metrics || {}; // NEW: actual storage location

  const dataPoints = {
    // High-value metrics (20 points each) - Real-world verification
    // GitHub stars - check NEW location first, then legacy paths
    hasGitHubStars: hasValue(metricsData.github?.stars) ||              // NEW: actual path
                     hasValue(metrics.info?.metrics?.github_stars) ||   // OLD: legacy
                     hasValue(metrics.info?.github_stats?.stars),       // OLD: alt legacy

    // VS Code marketplace installs - check NEW location first, then legacy
    hasVSCodeInstalls: hasValue(metricsData.vscode?.installs) ||        // NEW: actual path
                       hasValue(metrics.info?.vscode_installs),         // OLD: legacy

    // npm package downloads - check NEW location first, then legacy
    hasnpmDownloads: hasValue(metricsData.npm?.downloads_last_month) || // NEW: actual path
                     hasValue(metrics.info?.npm_downloads),             // OLD: legacy

    // PyPI downloads - NEW metric from actual data
    hasPyPIDownloads: hasValue(metricsData.pypi?.downloads_last_month), // NEW

    // Medium-value metrics (15 points each) - Business validation
    // User count - strong market validation
    hasUserCount: hasValue(metrics.info?.metrics?.users) ||
                  hasValue(metrics.info?.user_count),

    // Revenue/ARR - strong business validation
    hasRevenue: hasValue(metrics.info?.metrics?.monthly_arr) ||
                hasValue(metrics.info?.metrics?.annual_recurring_revenue) ||
                hasValue(metrics.info?.annual_recurring_revenue),

    // SWE-bench scores - technical validation
    hasSWEBench: hasValue(metrics.info?.metrics?.swe_bench?.verified) ||
                 hasValue(metrics.info?.metrics?.swe_bench?.lite) ||
                 hasValue(metrics.info?.metrics?.swe_bench?.full) ||
                 hasValue(metrics.info?.technical?.swe_bench_score) ||
                 hasValue(metrics.info?.swe_bench_score),

    // Low-value metrics (10 points each) - Descriptive data
    // Detailed description indicates quality documentation
    hasDescription: (metrics.info?.description?.length || 0) > 100 ||
                    (metrics.info?.summary?.length || 0) > 100,

    // Feature list indicates mature product
    hasFeatures: (metrics.info?.features?.length || 0) > 5,

    // Company backing indicates stability
    hasCompanyInfo: !!(metrics.info?.company || metrics.info?.company_name),

    // Pricing model indicates go-to-market strategy
    hasPricing: !!(metrics.info?.business?.pricing_model || metrics.info?.pricing_model),
  };

  let score = 0;

  // High-value data (20 points each, adjusted to make room for PyPI)
  if (dataPoints.hasGitHubStars) score += 20;
  if (dataPoints.hasVSCodeInstalls) score += 20;
  if (dataPoints.hasnpmDownloads) score += 20;
  if (dataPoints.hasPyPIDownloads) score += 15; // NEW: PyPI downloads

  // Medium-value data (15 points each)
  if (dataPoints.hasUserCount) score += 15;
  if (dataPoints.hasRevenue) score += 15;
  if (dataPoints.hasSWEBench) score += 15;

  // Low-value data (10 points each)
  if (dataPoints.hasDescription) score += 10;
  if (dataPoints.hasFeatures) score += 10;
  if (dataPoints.hasCompanyInfo) score += 10;
  if (dataPoints.hasPricing) score += 10;

  return Math.min(100, score); // Max 170 possible, capped at 100
}

/**
 * Helper function to calculate description quality score
 * Considers length, detail, and keyword richness
 */
function calculateDescriptionQuality(metrics: ToolMetricsV75): number {
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
function calculatePricingTier(metrics: ToolMetricsV75): number {
  const pricingModel = metrics.info?.business?.pricing_model || metrics.info?.pricing_model;
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
function calculateCompanyBacking(metrics: ToolMetricsV75): number {
  const company = metrics.info?.company || metrics.info?.company_name || "";
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
function calculateMaturityBonus(metrics: ToolMetricsV75): number {
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

export class RankingEngineV75 {
  constructor(private weights: RankingWeightsV75 = ALGORITHM_V75_WEIGHTS) {}

  /**
   * Helper to safely access nested data
   * Problem: scripts pass `info: toolData` where toolData = {info: {...}, metrics: {...}}
   * So we need to check both metrics.info.* and metrics.info.info.* paths
   */
  private getData(metrics: ToolMetricsV75): {
    info: any;
    metrics: any;
  } {
    // If metrics.info has an 'info' property, it means we have double nesting
    const hasDoubleNesting = metrics.info && 'info' in metrics.info;

    return {
      info: hasDoubleNesting ? (metrics.info as any).info : metrics.info,
      metrics: hasDoubleNesting ? (metrics.info as any).metrics : (metrics as any).metrics,
    };
  }

  /**
   * Calculate agentic capability with enhanced differentiation
   */
  private calculateAgenticCapability(metrics: ToolMetricsV75): number {
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

    // Subprocess/automation capabilities
    const subprocess = metrics.info?.technical?.subprocess_support;
    if (subprocess) {
      const subprocessFeatures = Object.values(subprocess).filter(Boolean).length;
      score = Math.min(100, score + subprocessFeatures * 2);
    }

    // Extract capability keywords from description
    const allText = `${metrics.info?.description || ""} ${metrics.info?.summary || ""} ${metrics.info?.overview || ""}`;
    const capabilityBonus = extractCapabilityScore(allText);
    score = Math.min(100, score + capabilityBonus * 0.3);

    return score;
  }

  /**
   * Calculate innovation with better defaults
   */
  private calculateInnovation(metrics: ToolMetricsV75): number {
    let score = 30; // Base score

    // Feature count as innovation proxy
    const featureCount = metrics.info?.features?.length || 0;
    if (featureCount > 0) {
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

    return Math.min(100, score);
  }

  /**
   * Calculate technical performance with max context window
   */
  private calculateTechnicalPerformance(metrics: ToolMetricsV75): number {
    let score = 40; // Base score

    // Use max context window if available, fallback to regular
    const contextWindow = metrics.info?.technical?.max_context_window ||
      metrics.info?.technical?.context_window || 0;

    if (contextWindow >= 1000000) {
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

    // IDE integration type matters
    const ideIntegration = metrics.info?.technical?.ide_integration;
    if (ideIntegration?.includes("Proprietary") || ideIntegration?.includes("Fork")) {
      score = Math.min(100, score + 5);
    }

    return score;
  }

  /**
   * Calculate developer adoption with market-realistic thresholds
   *
   * MARKET REALITY:
   * - GitHub Copilot: 57M VS Code installs, 1.8M users, 265K npm downloads
   * - Cursor: 447K VS Code installs, 360K users, 16 news mentions
   * - Jules: 233 VS Code installs, 0 users, 9K npm downloads
   *
   * Strategy: Heavily reward proven adoption, penalize tools with minimal data
   */
  private calculateDeveloperAdoption(metrics: ToolMetricsV75): number {
    let score = 0; // Start at 0 - must earn all points

    // Use helper to get correctly nested data
    const { info, metrics: metricsData } = this.getData(metrics);

    // VS Code installs - PRIMARY signal (most reliable)
    const vscodeInstalls = metricsData?.vscode?.installs || 0;
    if (vscodeInstalls >= 50000000) {
      score += 40; // GitHub Copilot level
    } else if (vscodeInstalls >= 10000000) {
      score += 35;
    } else if (vscodeInstalls >= 1000000) {
      score += 30; // Claude Code level
    } else if (vscodeInstalls >= 500000) {
      score += 25;
    } else if (vscodeInstalls >= 100000) {
      score += 20; // Meaningful adoption
    } else if (vscodeInstalls >= 10000) {
      score += 10; // Early traction
    } else if (vscodeInstalls >= 1000) {
      score += 5; // Minimal adoption
    }
    // < 1000 installs = 0 points (Jules at 233 = 0)

    // User count (strong validation signal)
    const users = info?.metrics?.users || info?.user_count || 0;
    if (users >= 1000000) {
      score += 30; // Copilot level
    } else if (users >= 500000) {
      score += 25;
    } else if (users >= 100000) {
      score += 20; // Cursor level
    } else if (users >= 50000) {
      score += 15;
    } else if (users >= 10000) {
      score += 10;
    } else if (users >= 5000) {
      score += 5;
    }
    // No users = 0 points

    // npm downloads - secondary signal
    const npmDownloads = metricsData?.npm?.downloads_last_month || 0;
    if (npmDownloads >= 1000000) {
      score += 15;
    } else if (npmDownloads >= 500000) {
      score += 12;
    } else if (npmDownloads >= 100000) {
      score += 10; // Copilot level
    } else if (npmDownloads >= 50000) {
      score += 7;
    } else if (npmDownloads >= 10000) {
      score += 3; // Claude Code level
    }
    // < 10K downloads = 0 points (Jules at 9K = 0)

    // News mentions - market awareness indicator
    const newsMentions = info?.metrics?.news_mentions || 0;
    if (newsMentions >= 20) {
      score += 10; // Copilot level
    } else if (newsMentions >= 15) {
      score += 8; // Cursor level
    } else if (newsMentions >= 10) {
      score += 6;
    } else if (newsMentions >= 5) {
      score += 4;
    } else if (newsMentions >= 2) {
      score += 2;
    }
    // 1 mention = 0 points (Jules = 0)

    // GitHub stars - community validation
    const githubStars = metricsData?.github?.stars ||
                       info?.metrics?.github_stars ||
                       info?.github_stats?.stars || 0;
    if (githubStars >= 50000) {
      score += 5;
    } else if (githubStars >= 20000) {
      score += 4;
    } else if (githubStars >= 10000) {
      score += 3;
    } else if (githubStars >= 5000) {
      score += 2;
    }

    return Math.min(100, score);
  }

  /**
   * Calculate market traction with business reality
   *
   * MARKET REALITY:
   * - GitHub Copilot: $400M ARR, 1.8M users
   * - Cursor: $500M ARR, 360K users
   * - Jules: $0 ARR, 0 users, free tier only
   *
   * Strategy: Reward proven business models and revenue
   */
  private calculateMarketTraction(metrics: ToolMetricsV75): number {
    let score = 0; // Start at 0 - must prove market traction

    // Use helper to get correctly nested data
    const { info, metrics: metricsData } = this.getData(metrics);

    // ARR is PRIMARY signal - actual revenue proves market validation
    const monthlyArr = info?.metrics?.monthly_arr ||
                      info?.metrics?.annual_recurring_revenue ||
                      info?.annual_recurring_revenue || 0;
    if (monthlyArr >= 400000000) {
      score += 50; // Copilot/Cursor level
    } else if (monthlyArr >= 100000000) {
      score += 45;
    } else if (monthlyArr >= 50000000) {
      score += 40;
    } else if (monthlyArr >= 10000000) {
      score += 35;
    } else if (monthlyArr >= 1000000) {
      score += 25;
    } else if (monthlyArr >= 100000) {
      score += 15;
    }
    // No revenue = 0 points (Jules = 0)

    // Pricing model as proxy ONLY if no revenue data
    if (monthlyArr === 0) {
      const pricingModel = info?.business?.pricing_model || info?.pricing_model;
      const basePrice = info?.business?.base_price || 0;
      const hasEnterprise = info?.business?.enterprise_pricing;

      if (hasEnterprise) {
        score += 20; // Enterprise pricing shows serious intent
      } else if (pricingModel === "subscription" && basePrice >= 50) {
        score += 15;
      } else if (pricingModel === "subscription" && basePrice >= 20) {
        score += 12;
      } else if (pricingModel === "freemium" && basePrice > 0) {
        score += 10; // Has paid tier
      } else if (pricingModel === "subscription") {
        score += 8;
      } else if (pricingModel === "freemium") {
        score += 5; // Free with no paid tier
      } else if (pricingModel === "free") {
        score += 0; // Jules: free only = 0 points
      }
    }

    // Valuation/funding - investor validation
    const valuation = info?.metrics?.valuation || 0;
    const funding = info?.metrics?.funding || 0;

    if (valuation >= 5000000000) {
      score += 20;
    } else if (valuation >= 1000000000) {
      score += 15;
    } else if (valuation >= 100000000) {
      score += 10;
    } else if (funding >= 100000000) {
      score += 8;
    } else if (funding >= 10000000) {
      score += 5;
    }

    // GitHub stars - community traction signal
    const githubStars = metricsData?.github?.stars ||
                       info?.metrics?.github_stars ||
                       info?.github_stats?.stars || 0;
    if (githubStars >= 50000) {
      score += 10;
    } else if (githubStars >= 20000) {
      score += 7;
    } else if (githubStars >= 10000) {
      score += 5;
    } else if (githubStars >= 5000) {
      score += 3;
    }

    // Company backing - stability indicator
    const companyBonus = calculateCompanyBacking(metrics) * 0.2; // Reduced weight
    score += companyBonus;

    return Math.min(100, score);
  }

  /**
   * Calculate business sentiment with news impact
   */
  private calculateBusinessSentiment(
    metrics: ToolMetricsV75,
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
      score = Math.min(100, score + 10);
    }

    // Growth metrics indicate positive sentiment
    const arr = metrics.info?.metrics?.monthly_arr || metrics.info?.metrics?.annual_recurring_revenue || metrics.info?.annual_recurring_revenue || 0;
    const users = metrics.info?.metrics?.users || metrics.info?.user_count || 0;
    if (arr >= 100000000 || users >= 500000) {
      score = Math.min(100, score + 10);
    }

    return score;
  }

  /**
   * Calculate development velocity with better signals
   */
  private calculateDevelopmentVelocity(metrics: ToolMetricsV75): number {
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

    // Recent updates field
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
  private calculatePlatformResilience(metrics: ToolMetricsV75): number {
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

    // Company backing = stability
    const companyBacking = calculateCompanyBacking(metrics);
    score = Math.min(100, score + companyBacking * 0.2);

    return score;
  }

  /**
   * Calculate deterministic tiebreakers
   */
  private calculateTiebreakers(metrics: ToolMetricsV75): {
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
    const firstChar = metrics.name.charAt(0).toLowerCase();
    const alphabeticalOrder = (122 - firstChar.charCodeAt(0)) * 4;

    return {
      featureCount,
      descriptionQuality,
      pricingTier,
      alphabeticalOrder,
    };
  }

  /**
   * Calculate the overall score (0-100 range) with data completeness penalty
   */
  calculateToolScore(
    metrics: ToolMetricsV75,
    currentDate: Date = new Date(),
    newsArticles?: NewsArticle[]
  ): ToolScoreV75 {
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

    // NEW: Calculate data completeness and apply confidence multiplier
    const dataCompleteness = calculateDataCompleteness(metrics);
    const confidenceMultiplier = 0.7 + (dataCompleteness / 100) * 0.3;
    // Range: 0.7 (no data) to 1.0 (complete data)

    // Apply confidence penalty to overall score
    overallScore = overallScore * confidenceMultiplier;

    // Calculate tiebreakers
    const tiebreakers = this.calculateTiebreakers(metrics);

    // Apply tiebreakers as micro-adjustments (0.001 precision)
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
      dataCompleteness,
      confidenceMultiplier,
      sentimentAnalysis:
        newsImpact && !Number.isNaN(newsImpact.totalImpact)
          ? {
              rawSentiment: 0,
              adjustedSentiment: 0,
              newsImpact: newsImpact.totalImpact,
            }
          : undefined,
      algorithm_version: "v7.5",
    };
  }

  /**
   * Get algorithm metadata
   */
  static getAlgorithmInfo() {
    return {
      version: "v7.5",
      name: "Data-Driven Confidence Scoring with Missing Data Penalty",
      description: "Penalizes tools lacking real-world metrics. Tools with verified data (GitHub, VS Code, npm, revenue) rank higher than those with only descriptions.",
      weights: ALGORITHM_V75_WEIGHTS,
      features: [
        "Data completeness scoring system (0-100%)",
        "Confidence multiplier: 0.7 (no data) to 1.0 (complete data)",
        "High-value metrics: GitHub stars, VS Code installs, npm downloads (25 pts each)",
        "Medium-value metrics: User count, revenue, SWE-bench (15 pts each)",
        "Low-value metrics: Description, features, company info, pricing (10 pts each)",
        "All v7.3 features: Tiebreakers, differentiation, determinism",
        "Target: Data-backed tools rank higher than unverified tools",
        "Target: <20% duplicate scores, Top 10 all unique",
      ],
      updatedAt: "2025-11-01",
      improvements: [
        "Rewards tools with real-world verification metrics",
        "Penalizes tools with limited/missing data",
        "GitHub Copilot, Cursor, Claude Code benefit from real metrics",
        "Jules, Refact.ai penalized for lacking verification data",
        "Confidence-based scoring ensures data quality matters",
        "Maintains all v7.3 improvements for score differentiation",
      ],
    };
  }
}
