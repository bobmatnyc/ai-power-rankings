import { Tool, ToolCapabilities, ToolMetrics, Ranking } from "./database";

export interface RankingWeights {
  marketTraction: number; // 25%
  technicalCapability: number; // 20%
  developerAdoption: number; // 20%
  developmentVelocity: number; // 15%
  platformResilience: number; // 10%
  communitySentiment: number; // 10%
}

export interface ToolScore {
  toolId: string;
  overallScore: number;
  factorScores: {
    marketTraction: number;
    technicalCapability: number;
    developerAdoption: number;
    developmentVelocity: number;
    platformResilience: number;
    communitySentiment: number;
  };
}

export interface RankedTool extends Tool {
  ranking: Ranking;
  capabilities: ToolCapabilities;
  metrics: ToolMetrics;
}

export interface RankingComparison {
  toolId: string;
  currentPosition: number;
  previousPosition?: number;
  positionChange: number;
  scoreChange: number;
}
