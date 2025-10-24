/**
 * Rankings type definitions
 */

import type { Tool } from "./database";

/**
 * Base tool score structure
 */
export interface ToolScore {
  toolId: string;
  overallScore: number;
  factorScores?: Record<string, number>;
}

/**
 * Ranked tool with position and metadata
 */
export interface RankedTool extends Tool {
  position: number;
  score: number;
  position_change?: number;
  period?: string;
}

/**
 * Tool capabilities for ranking algorithm
 */
export interface ToolCapabilities {
  agentic_capability?: number;
  swe_bench_score?: number;
  multi_model_support?: boolean;
  [key: string]: any;
}

/**
 * Tool metrics for ranking calculations
 */
export interface ToolMetrics {
  github_stars?: number;
  estimated_users?: number;
  monthly_arr?: number;
  valuation?: number;
  growth_rate?: number;
  release_frequency?: number;
  github_contributors?: number;
  [key: string]: any;
}

/**
 * Ranking weights configuration
 */
export interface RankingWeights {
  [factor: string]: number;
}
