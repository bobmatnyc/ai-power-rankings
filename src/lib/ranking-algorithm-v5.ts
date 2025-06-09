import { ToolScore } from "@/types/rankings";

export interface RankingWeightsV5 {
  agenticCapability: number;
  technicalCapability: number;
  developerAdoption: number;
  innovation: number;
  marketTraction: number;
  businessSentiment: number;
  developmentVelocity: number;
  platformResilience: number;
}

export const ALGORITHM_V5_WEIGHTS: RankingWeightsV5 = {
  agenticCapability: 0.3, // 30% - Primary factor (reduced from 35%)
  innovation: 0.15, // 15% - Technical breakthroughs (increased from 10%)
  technicalCapability: 0.125, // 12.5% (reduced from 15%)
  developerAdoption: 0.125, // 12.5% (reduced from 15%)
  marketTraction: 0.125, // 12.5% (increased from 10%)
  businessSentiment: 0.075, // 7.5% (reduced from 10%)
  developmentVelocity: 0.05, // 5% - Minimum threshold (increased from 2.5%)
  platformResilience: 0.05, // 5% - Minimum threshold (increased from 2.5%)
};

export interface ToolMetricsV5 {
  tool_id: string;
  agentic_capability?: number;
  swe_bench_score?: number;
  github_stars?: number;
  estimated_users?: number;
  monthly_arr?: number;
  valuation?: number;
  growth_rate?: number;
  business_sentiment?: number;
  innovation_score?: number;
  release_frequency?: number;
  github_contributors?: number;
  llm_provider_count?: number;
  multi_model_support?: boolean;
  community_size?: number;
}

export interface ToolScoreV5 extends ToolScore {
  factorScores: {
    agenticCapability: number;
    technicalCapability: number;
    developerAdoption: number;
    innovation: number;
    marketTraction: number;
    businessSentiment: number;
    developmentVelocity: number;
    platformResilience: number;
    communitySentiment: number;
  };
}

export class RankingEngineV5 {
  constructor(private weights: RankingWeightsV5 = ALGORITHM_V5_WEIGHTS) {}

  /**
   * Calculate the overall score for a tool based on Algorithm v5.0
   */
  calculateToolScore(metrics: ToolMetricsV5, status: string = "active"): ToolScoreV5 {
    const factorScores = {
      agenticCapability: metrics.agentic_capability || 3.0,

      technicalCapability: Math.min(
        10,
        ((metrics.swe_bench_score || 0) / 10) * 0.5 +
          ((metrics.github_stars || 0) / 50000) * 10 * 0.5
      ),

      developerAdoption: Math.min(
        10,
        Math.min(10, ((metrics.estimated_users || 0) / 100000) * 5) * 0.5 +
          Math.min(10, ((metrics.github_stars || 0) / 10000) * 5) * 0.3 +
          ((metrics.community_size || metrics.estimated_users || 0) / 10 / 50000) * 10 * 0.2
      ),

      innovation: metrics.innovation_score || 5.0,

      marketTraction: Math.min(
        10,
        Math.min(10, ((metrics.monthly_arr || 0) / 10000000) * 5) * 0.4 +
          Math.min(10, ((metrics.valuation || 0) / 100000000) * 5) * 0.3 +
          ((metrics.growth_rate || 100) / 100) * 5 * 0.3
      ),

      businessSentiment: (metrics.business_sentiment || 0.5) * 10,

      developmentVelocity: Math.min(
        10,
        ((metrics.release_frequency || 2) / 4) * 10 * 0.5 +
          ((metrics.github_contributors || 10) / 100) * 10 * 0.5
      ),

      platformResilience: Math.min(
        10,
        (status === "acquired" ? 3 : 7) * 0.5 +
          (metrics.multi_model_support || (metrics.llm_provider_count || 1) > 1 ? 10 : 5) * 0.5
      ),

      communitySentiment: 5.0, // Default placeholder value
    };

    const overallScore = Object.entries(factorScores).reduce((total, [factor, score]) => {
      return total + score * this.weights[factor as keyof RankingWeightsV5];
    }, 0);

    return {
      toolId: metrics.tool_id,
      overallScore: Math.round(overallScore * 1000) / 1000,
      factorScores,
    };
  }

  /**
   * Get algorithm metadata
   */
  static getAlgorithmInfo(): {
    version: string;
    name: string;
    description: string;
    weights: RankingWeightsV5;
    updatedAt: string;
  } {
    return {
      version: "v5.1",
      name: "Enhanced Innovation & Market Focus",
      description:
        "Balanced approach with 30% agentic capability, 15% innovation, and minimum 5% for all factors",
      weights: ALGORITHM_V5_WEIGHTS,
      updatedAt: "2025-06-09",
    };
  }
}
