import type { ToolCapabilities, ToolMetrics } from "@/types/database";
import type { RankingWeights, ToolScore } from "@/types/rankings";

export const DEFAULT_WEIGHTS: RankingWeights = {
  marketTraction: 0.25,
  technicalCapability: 0.2,
  developerAdoption: 0.2,
  developmentVelocity: 0.15,
  platformResilience: 0.1,
  communitySentiment: 0.1,
};

export type {
  RankingWeightsV7 as LatestRankingWeights,
  ToolMetricsV7 as LatestToolMetrics,
  ToolScoreV7 as LatestToolScore,
} from "./ranking-algorithm-v7";
// Re-export v7 as the latest version
export { RankingEngineV7 as LatestRankingEngine } from "./ranking-algorithm-v7";

export class RankingEngine {
  constructor(private weights: RankingWeights = DEFAULT_WEIGHTS) {}

  /**
   * Calculate the overall score for a tool based on its metrics and capabilities
   */
  calculateToolScore(metrics: ToolMetrics, capabilities: ToolCapabilities): ToolScore {
    const factorScores = {
      marketTraction: this.calculateMarketTractionScore(metrics),
      technicalCapability: this.calculateTechnicalCapabilityScore(capabilities),
      developerAdoption: this.calculateDeveloperAdoptionScore(metrics),
      developmentVelocity: this.calculateDevelopmentVelocityScore(metrics),
      platformResilience: this.calculatePlatformResilienceScore(capabilities),
      communitySentiment: this.calculateCommunitySentimentScore(metrics),
    };

    const overallScore = Object.entries(factorScores).reduce((total, [factor, score]) => {
      return total + score * this.weights[factor as keyof RankingWeights];
    }, 0);

    return {
      toolId: metrics.tool_id,
      overallScore: Math.round(overallScore * 1000) / 1000, // Round to 3 decimal places
      factorScores,
    };
  }

  /**
   * Calculate market traction score based on funding and valuation
   */
  private calculateMarketTractionScore(metrics: ToolMetrics): number {
    const fundingScore = this.normalizeScore(metrics.funding_total || 0, 0, 1000000000); // 0 to $1B
    const valuationScore = this.normalizeScore(metrics.valuation_latest || 0, 0, 10000000000); // 0 to $10B
    const userScore = this.normalizeScore(metrics.estimated_users || 0, 0, 1000000); // 0 to 1M users

    return (fundingScore * 0.3 + valuationScore * 0.4 + userScore * 0.3) * 100;
  }

  /**
   * Calculate technical capability score based on autonomy level and features
   */
  private calculateTechnicalCapabilityScore(capabilities: ToolCapabilities): number {
    const autonomyScore = (capabilities.autonomy_level / 10) * 100;
    const multiFileScore = capabilities.supports_multi_file ? 10 : 0;
    const languageScore = Math.min(capabilities.supported_languages.length * 2, 20);
    const contextScore = this.normalizeScore(capabilities.context_window_size || 0, 0, 200000) * 20;

    return autonomyScore * 0.5 + multiFileScore + languageScore + contextScore;
  }

  /**
   * Calculate developer adoption score based on GitHub metrics
   */
  private calculateDeveloperAdoptionScore(metrics: ToolMetrics): number {
    const starsScore = this.normalizeScore(metrics.github_stars || 0, 0, 100000) * 40;
    const forksScore = this.normalizeScore(metrics.github_forks || 0, 0, 10000) * 20;
    const contributorsScore = this.normalizeScore(metrics.github_contributors || 0, 0, 1000) * 20;
    const communityScore = this.normalizeScore(metrics.community_size || 0, 0, 50000) * 20;

    return starsScore + forksScore + contributorsScore + communityScore;
  }

  /**
   * Calculate development velocity score based on commit frequency and release cadence
   */
  private calculateDevelopmentVelocityScore(metrics: ToolMetrics): number {
    const commitScore = this.normalizeScore(metrics.github_commits_last_month, 0, 500) * 50;
    const releaseScore = metrics.release_frequency_days
      ? Math.max(0, 100 - metrics.release_frequency_days) * 0.5
      : 0;

    return commitScore + releaseScore;
  }

  /**
   * Calculate platform resilience score based on LLM provider diversity
   */
  private calculatePlatformResilienceScore(capabilities: ToolCapabilities): number {
    const providerDiversity = Math.min(capabilities.llm_providers.length * 20, 60);
    const deploymentOptions = Math.min(capabilities.deployment_options.length * 20, 40);

    return providerDiversity + deploymentOptions;
  }

  /**
   * Calculate community sentiment score based on social metrics
   */
  private calculateCommunitySentimentScore(metrics: ToolMetrics): number {
    const sentimentScore = metrics.sentiment_score * 50;
    const mentionsScore = this.normalizeScore(metrics.social_mentions_30d, 0, 1000) * 50;

    return sentimentScore + mentionsScore;
  }

  /**
   * Normalize a value between 0 and 1 based on min and max values
   */
  private normalizeScore(value: number, min: number, max: number): number {
    if (value <= min) {
      return 0;
    }
    if (value >= max) {
      return 1;
    }
    return (value - min) / (max - min);
  }
}
