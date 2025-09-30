/**
 * Tool Scoring Service
 * Manages baseline scores and delta modifications for AI tools
 */

import { getDb } from "../db/connection";
import { tools } from "../db/schema";
import { eq, sql } from "drizzle-orm";
import { loggers } from "../logger";

export interface ToolScoreFactors {
  marketTraction?: number;
  technicalCapability?: number;
  developerAdoption?: number;
  developmentVelocity?: number;
  platformResilience?: number;
  communitySentiment?: number;
  overallScore?: number;
}

export interface ToolScoringData {
  toolId: string;
  baselineScore: ToolScoreFactors;
  deltaScore: ToolScoreFactors;
  currentScore?: ToolScoreFactors;
  lastUpdated?: Date;
}

export class ToolScoringService {
  /**
   * Calculate current score from baseline + delta
   */
  calculateCurrentScore(
    baseline: ToolScoreFactors,
    delta: ToolScoreFactors
  ): ToolScoreFactors {
    const current: ToolScoreFactors = {};

    // Add each factor's baseline and delta
    const factors = [
      'marketTraction',
      'technicalCapability',
      'developerAdoption',
      'developmentVelocity',
      'platformResilience',
      'communitySentiment',
      'overallScore'
    ] as const;

    for (const factor of factors) {
      const baselineValue = baseline[factor] || 0;
      const deltaValue = delta[factor] || 0;
      current[factor] = baselineValue + deltaValue;
    }

    return current;
  }

  /**
   * Get tool scoring data by ID
   */
  async getToolScoring(toolId: string): Promise<ToolScoringData | null> {
    const db = getDb();
    if (!db) {
      loggers.db.error("Database connection not available");
      throw new Error("Database connection unavailable");
    }

    try {
      const results = await db
        .select({
          id: tools.id,
          baselineScore: tools.baselineScore,
          deltaScore: tools.deltaScore,
          currentScore: tools.currentScore,
          scoreUpdatedAt: tools.scoreUpdatedAt
        })
        .from(tools)
        .where(sql`${tools.data}->>'id' = ${toolId}`)
        .limit(1);

      const tool = results[0];
      if (!tool) return null;

      return {
        toolId,
        baselineScore: (tool.baselineScore as ToolScoreFactors) || {},
        deltaScore: (tool.deltaScore as ToolScoreFactors) || {},
        currentScore: (tool.currentScore as ToolScoreFactors) || undefined,
        lastUpdated: tool.scoreUpdatedAt || undefined
      };
    } catch (error) {
      loggers.db.error("Error fetching tool scoring data", {
        toolId,
        error: error instanceof Error ? error.message : "Unknown error"
      });
      throw error;
    }
  }

  /**
   * Update baseline score for a tool
   */
  async updateBaselineScore(
    toolId: string,
    baselineScore: ToolScoreFactors
  ): Promise<void> {
    const db = getDb();
    if (!db) {
      loggers.db.error("Database connection not available");
      throw new Error("Database connection unavailable");
    }

    try {
      // Get current delta score
      const current = await this.getToolScoring(toolId);
      const deltaScore = current?.deltaScore || {};

      // Calculate new current score
      const currentScore = this.calculateCurrentScore(baselineScore, deltaScore);

      await db
        .update(tools)
        .set({
          baselineScore,
          currentScore,
          scoreUpdatedAt: new Date(),
          updatedAt: new Date()
        })
        .where(sql`${tools.data}->>'id' = ${toolId}`);

      loggers.db.info("Updated baseline score", { toolId });
    } catch (error) {
      loggers.db.error("Error updating baseline score", {
        toolId,
        error: error instanceof Error ? error.message : "Unknown error"
      });
      throw error;
    }
  }

  /**
   * Update delta score for a tool
   */
  async updateDeltaScore(
    toolId: string,
    deltaScore: ToolScoreFactors
  ): Promise<void> {
    const db = getDb();
    if (!db) {
      loggers.db.error("Database connection not available");
      throw new Error("Database connection unavailable");
    }

    try {
      // Get current baseline score
      const current = await this.getToolScoring(toolId);
      const baselineScore = current?.baselineScore || {};

      // Calculate new current score
      const currentScore = this.calculateCurrentScore(baselineScore, deltaScore);

      await db
        .update(tools)
        .set({
          deltaScore,
          currentScore,
          scoreUpdatedAt: new Date(),
          updatedAt: new Date()
        })
        .where(sql`${tools.data}->>'id' = ${toolId}`);

      loggers.db.info("Updated delta score", { toolId });
    } catch (error) {
      loggers.db.error("Error updating delta score", {
        toolId,
        error: error instanceof Error ? error.message : "Unknown error"
      });
      throw error;
    }
  }

  /**
   * Initialize baseline scores from existing data
   * This is used for migration - takes current scores as baseline
   */
  async initializeBaselinesFromCurrent(): Promise<void> {
    const db = getDb();
    if (!db) {
      loggers.db.error("Database connection not available");
      throw new Error("Database connection unavailable");
    }

    try {
      // Get all tools
      const allTools = await db.select().from(tools);

      for (const tool of allTools) {
        const toolData = tool.data as any;
        const toolId = toolData.id;

        // Check if already has baseline score
        if (tool.baselineScore && Object.keys(tool.baselineScore as object).length > 0) {
          continue; // Skip if already initialized
        }

        // Extract current score from tool data if exists
        const currentScore: ToolScoreFactors = {};
        if (toolData.score) {
          currentScore.overallScore = toolData.score;
        }
        if (toolData.factorScores) {
          Object.assign(currentScore, toolData.factorScores);
        }

        // Set baseline to current score, delta to 0
        await db
          .update(tools)
          .set({
            baselineScore: currentScore,
            deltaScore: {},
            currentScore: currentScore,
            scoreUpdatedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(tools.id, tool.id));
      }

      loggers.db.info("Initialized baseline scores from current data");
    } catch (error) {
      loggers.db.error("Error initializing baseline scores", {
        error: error instanceof Error ? error.message : "Unknown error"
      });
      throw error;
    }
  }

  /**
   * Recalculate all current scores from baseline + delta
   */
  async recalculateAllScores(): Promise<void> {
    const db = getDb();
    if (!db) {
      loggers.db.error("Database connection not available");
      throw new Error("Database connection unavailable");
    }

    try {
      const allTools = await db.select().from(tools);

      for (const tool of allTools) {
        const baselineScore = (tool.baselineScore as ToolScoreFactors) || {};
        const deltaScore = (tool.deltaScore as ToolScoreFactors) || {};
        const currentScore = this.calculateCurrentScore(baselineScore, deltaScore);

        await db
          .update(tools)
          .set({
            currentScore,
            scoreUpdatedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(tools.id, tool.id));
      }

      loggers.db.info("Recalculated all tool scores");
    } catch (error) {
      loggers.db.error("Error recalculating scores", {
        error: error instanceof Error ? error.message : "Unknown error"
      });
      throw error;
    }
  }

  /**
   * Get tools with their calculated current scores
   */
  async getToolsWithScores(): Promise<ToolScoringData[]> {
    const db = getDb();
    if (!db) {
      loggers.db.error("Database connection not available");
      throw new Error("Database connection unavailable");
    }

    try {
      const allTools = await db
        .select({
          id: tools.id,
          data: tools.data,
          baselineScore: tools.baselineScore,
          deltaScore: tools.deltaScore,
          currentScore: tools.currentScore,
          scoreUpdatedAt: tools.scoreUpdatedAt
        })
        .from(tools)
        .where(eq(tools.status, "active"));

      return allTools.map(tool => {
        const toolData = tool.data as any;
        const baselineScore = (tool.baselineScore as ToolScoreFactors) || {};
        const deltaScore = (tool.deltaScore as ToolScoreFactors) || {};

        // Calculate current score if not cached
        let currentScore = tool.currentScore as ToolScoreFactors;
        if (!currentScore || Object.keys(currentScore).length === 0) {
          currentScore = this.calculateCurrentScore(baselineScore, deltaScore);
        }

        return {
          toolId: toolData.id || tool.id,
          baselineScore,
          deltaScore,
          currentScore,
          lastUpdated: tool.scoreUpdatedAt || undefined
        };
      });
    } catch (error) {
      loggers.db.error("Error fetching tools with scores", {
        error: error instanceof Error ? error.message : "Unknown error"
      });
      throw error;
    }
  }
}

// Export singleton instance
export const toolScoringService = new ToolScoringService();