import path from "node:path";
import Ajv from "ajv";
import ajvFormats from "ajv-formats";
import fs from "fs-extra";
import { BaseRepository } from "./base-repository";
import type { RankingPeriod, RankingsData } from "./schemas";

const ajv = new Ajv({ allErrors: true });
ajvFormats(ajv);

const rankingPeriodSchema = {
  type: "object",
  required: ["period", "algorithm_version", "rankings"],
  properties: {
    period: { type: "string", pattern: "^\\d{4}-\\d{2}(-\\d{2})?$" },
    date: { type: ["string", "null"], format: "date" },
    algorithm_version: { type: "string" },
    algorithm_name: { type: ["string", "null"] },
    is_current: { type: ["boolean", "null"] },
    created_at: { type: ["string", "null"], format: "date-time" },
    preview_date: { type: ["string", "null"], format: "date-time" },
    rankings: {
      type: "array",
      items: {
        type: "object",
        required: ["tool_id", "tool_name", "rank", "score", "factor_scores"],
        properties: {
          tool_id: { type: "string" },
          tool_name: { type: "string" },
          rank: { type: "number", minimum: 1 },
          score: { type: "number", minimum: 0 },
          tier: { type: ["string", "null"], enum: ["S", "A", "B", "C", "D"] },
          factor_scores: {
            type: "object",
            properties: {
              // Snake case for backward compatibility
              agentic_capability: { type: ["number", "null"] },
              innovation: { type: ["number", "null"] },
              technical_performance: { type: ["number", "null"] },
              developer_adoption: { type: ["number", "null"] },
              market_traction: { type: ["number", "null"] },
              business_sentiment: { type: ["number", "null"] },
              development_velocity: { type: ["number", "null"] },
              platform_resilience: { type: ["number", "null"] },
              // Camel case for v7 algorithm
              agenticCapability: { type: ["number", "null"] },
              technicalPerformance: { type: ["number", "null"] },
              developerAdoption: { type: ["number", "null"] },
              marketTraction: { type: ["number", "null"] },
              businessSentiment: { type: ["number", "null"] },
              developmentVelocity: { type: ["number", "null"] },
              platformResilience: { type: ["number", "null"] },
              technicalCapability: { type: ["number", "null"] },
              communitySentiment: { type: ["number", "null"] },
            },
          },
          sentiment_analysis: {
            type: ["object", "null"],
            properties: {
              rawSentiment: { type: "number" },
              adjustedSentiment: { type: "number" },
              newsImpact: { type: "number" },
              crisisDetection: {
                type: ["object", "null"],
                properties: {
                  isInCrisis: { type: "boolean" },
                  severityScore: { type: "number" },
                  negativePeriods: { type: "number" },
                  impactMultiplier: { type: "number" },
                },
              },
            },
          },
          movement: {
            type: ["object", "null"],
            properties: {
              previous_position: { type: ["number", "null"] },
              change: { type: "number" },
              direction: { enum: ["up", "down", "same", "new"] },
            },
          },
          change_analysis: {
            type: ["object", "null"],
            properties: {
              primary_reason: { type: ["string", "null"] },
              narrative_explanation: { type: ["string", "null"] },
            },
          },
        },
      },
    },
    metadata: {
      type: ["object", "null"],
      properties: {
        total_tools: { type: "number" },
        calculation_date: { type: "string" },
        notes: { type: ["string", "null"] },
      },
    },
  },
};

const validateRankingPeriod = ajv.compile(rankingPeriodSchema);

export class RankingsRepository extends BaseRepository<RankingsData> {
  private static instance: RankingsRepository;
  private periodsDir: string;

  constructor() {
    const filePath = path.join(process.cwd(), "data", "json", "rankings", "index.json");
    const defaultData: RankingsData = {
      periods: [],
      current: "",
      metadata: {
        last_updated: new Date().toISOString(),
        version: "1.0.0",
      },
    };

    super(filePath, defaultData);
    this.periodsDir = path.join(process.cwd(), "data", "json", "rankings", "periods");

    // Ensure periods directory exists
    fs.ensureDirSync(this.periodsDir);
  }

  static getInstance(): RankingsRepository {
    if (!RankingsRepository.instance) {
      RankingsRepository.instance = new RankingsRepository();
    }
    return RankingsRepository.instance;
  }

  async validate(data: RankingsData): Promise<boolean> {
    // Basic structure validation
    if (!Array.isArray(data.periods) || typeof data.current !== "string") {
      return false;
    }

    return true;
  }

  /**
   * Get all available periods
   */
  async getPeriods(): Promise<string[]> {
    const data = await this.getData();
    return [...data.periods].sort((a, b) => b.localeCompare(a)); // Newest first
  }

  /**
   * Alias for getPeriods() for compatibility
   */
  async getAvailablePeriods(): Promise<string[]> {
    return this.getPeriods();
  }

  /**
   * Get current ranking period
   */
  async getCurrentPeriod(): Promise<string> {
    const data = await this.getData();
    return data.current;
  }

  /**
   * Get rankings for a specific period
   */
  async getRankingsForPeriod(period: string): Promise<RankingPeriod | null> {
    const periodPath = path.join(this.periodsDir, `${period}.json`);

    if (!(await fs.pathExists(periodPath))) {
      return null;
    }

    try {
      const content = (await fs.readJson(periodPath)) as RankingPeriod;

      if (!validateRankingPeriod(content)) {
        this.logger.error("Invalid ranking period data", {
          period,
          errors: validateRankingPeriod.errors,
        });
        return null;
      }

      // Normalize the rankings to ensure position field exists
      if (content.rankings && content.rankings.length > 0) {
        content.rankings = content.rankings.map((ranking) => ({
          ...ranking,
          // Ensure position field exists (use rank if position is not present)
          position: ranking.position ?? ranking.rank ?? 0,
        }));
      }

      return content;
    } catch (error) {
      this.logger.error("Failed to read ranking period", { period, error });
      return null;
    }
  }

  /**
   * Get current rankings
   */
  async getCurrentRankings(): Promise<RankingPeriod | null> {
    const data = await this.getData();
    if (!data.current) {
      return null;
    }

    return this.getRankingsForPeriod(data.current);
  }

  /**
   * Alias for getRankingsForPeriod for API compatibility
   */
  async getByPeriod(period: string): Promise<RankingPeriod | null> {
    return this.getRankingsForPeriod(period);
  }

  /**
   * Alias for deletePeriod for API compatibility
   */
  async deleteByPeriod(period: string): Promise<boolean> {
    return this.deletePeriod(period);
  }

  /**
   * Save rankings for a period
   */
  async saveRankingsForPeriod(rankings: RankingPeriod): Promise<void> {
    // Validate the ranking data
    if (!validateRankingPeriod(rankings)) {
      throw new Error("Invalid ranking period data");
    }

    const periodPath = path.join(this.periodsDir, `${rankings.period}.json`);

    // Create backup if file exists
    if (await fs.pathExists(periodPath)) {
      const backupPath = `${periodPath}.backup`;
      await fs.copy(periodPath, backupPath);
    }

    try {
      // Write the period file
      await fs.writeJson(periodPath, rankings, { spaces: 2 });

      // Update the index
      await this.update(async (data) => {
        if (!data.periods.includes(rankings.period)) {
          data.periods.push(rankings.period);
          data.periods.sort((a, b) => b.localeCompare(a)); // Keep sorted, newest first
        }

        // Update current if this is marked as current
        if (rankings.is_current) {
          data.current = rankings.period;
        }

        data.metadata.last_updated = new Date().toISOString();
      });

      this.logger.info("Rankings saved successfully", { period: rankings.period });
    } catch (error) {
      this.logger.error("Failed to save rankings", { period: rankings.period, error });

      // Restore from backup if it exists
      const backupPath = `${periodPath}.backup`;
      if (await fs.pathExists(backupPath)) {
        await fs.copy(backupPath, periodPath);
      }

      throw error;
    }
  }

  /**
   * Set current ranking period
   */
  async setCurrentPeriod(period: string): Promise<void> {
    const periodPath = path.join(this.periodsDir, `${period}.json`);

    if (!(await fs.pathExists(periodPath))) {
      throw new Error(`Period ${period} does not exist`);
    }

    await this.update(async (data) => {
      data.current = period;
      data.metadata.last_updated = new Date().toISOString();
    });

    // Update the period file to mark as current
    const rankings = await this.getRankingsForPeriod(period);
    if (rankings) {
      rankings.is_current = true;
      await fs.writeJson(periodPath, rankings, { spaces: 2 });
    }
  }

  /**
   * Delete a ranking period
   */
  async deletePeriod(period: string): Promise<boolean> {
    const periodPath = path.join(this.periodsDir, `${period}.json`);

    if (!(await fs.pathExists(periodPath))) {
      return false;
    }

    // Create backup before deletion
    const backupPath = `${periodPath}.deleted.backup`;
    await fs.copy(periodPath, backupPath);

    // Remove the period file
    await fs.remove(periodPath);

    // Update the index
    await this.update(async (data) => {
      const index = data.periods.indexOf(period);
      if (index !== -1) {
        data.periods.splice(index, 1);
      }

      // If this was the current period, clear current
      if (data.current === period) {
        data.current = data.periods[0] || "";
      }

      data.metadata.last_updated = new Date().toISOString();
    });

    // Fix movement data for the next period
    await this.fixMovementDataAfterDeletion(period);

    this.logger.info("Ranking period deleted", { period });
    return true;
  }

  /**
   * Fix movement data after a period is deleted
   * This ensures the next period compares against the previous available period
   */
  private async fixMovementDataAfterDeletion(deletedPeriod: string): Promise<void> {
    const periods = await this.getAvailablePeriods();
    const sortedPeriods = periods.sort();

    // Find the period that comes after the deleted one
    const deletedDate = new Date(deletedPeriod);
    let nextPeriod: string | null = null;

    for (const period of sortedPeriods) {
      const periodDate = new Date(period);
      if (periodDate > deletedDate) {
        nextPeriod = period;
        break;
      }
    }

    if (!nextPeriod) {
      return; // No period after the deleted one
    }

    // Find the period before the deleted one (which is now the previous for the next)
    const nextIndex = sortedPeriods.indexOf(nextPeriod);
    if (nextIndex <= 0) {
      return; // Next period is the first one, movement should all be 'new'
    }

    const previousPeriod = sortedPeriods[nextIndex - 1];

    // Load both periods
    const nextData = await this.getRankingsForPeriod(nextPeriod);
    const previousData = await this.getRankingsForPeriod(previousPeriod!);

    if (!nextData || !previousData) {
      return;
    }

    // Create a map of previous positions
    const previousPositions = new Map<string, number>();
    previousData.rankings.forEach((r) => {
      previousPositions.set(r.tool_id, r.position ?? r.rank ?? 0);
    });

    // Update movement data for the next period
    nextData.rankings.forEach((ranking) => {
      const previousPosition = previousPositions.get(ranking.tool_id);

      if (previousPosition === undefined) {
        // Tool is new
        ranking.movement = {
          change: 0,
          direction: "new",
        };
      } else {
        // Tool existed before
        const change = previousPosition - (ranking.position ?? ranking.rank ?? 0);
        ranking.movement = {
          previous_position: previousPosition,
          change: Math.abs(change),
          direction: change > 0 ? "up" : change < 0 ? "down" : "same",
        };

        // Update change analysis if significant movement and not already set
        if (Math.abs(change) >= 5 && !ranking.change_analysis) {
          ranking.change_analysis = {
            primary_reason: change > 0 ? "Performance improvements" : "Competitive pressure",
          };
        }
      }
    });

    // Save the updated period data
    await this.saveRankingsForPeriod(nextData);

    this.logger.info("Fixed movement data after deletion", {
      deletedPeriod,
      nextPeriod,
      previousPeriod,
    });
  }

  /**
   * Rename a ranking period
   */
  async renamePeriod(oldPeriod: string, newPeriod: string): Promise<boolean> {
    const oldPath = path.join(this.periodsDir, `${oldPeriod}.json`);
    const newPath = path.join(this.periodsDir, `${newPeriod}.json`);

    if (!(await fs.pathExists(oldPath))) {
      return false;
    }

    if (await fs.pathExists(newPath)) {
      throw new Error(`Period ${newPeriod} already exists`);
    }

    // Read, update, and save with new period name
    const rankings = await fs.readJson(oldPath);
    rankings.period = newPeriod;

    await fs.writeJson(newPath, rankings, { spaces: 2 });
    await fs.remove(oldPath);

    // Update the index
    await this.update(async (data) => {
      const index = data.periods.indexOf(oldPeriod);
      if (index !== -1) {
        data.periods[index] = newPeriod;
        data.periods.sort((a, b) => b.localeCompare(a));
      }

      // Update current if needed
      if (data.current === oldPeriod) {
        data.current = newPeriod;
      }

      data.metadata.last_updated = new Date().toISOString();
    });

    this.logger.info("Ranking period renamed", { from: oldPeriod, to: newPeriod });
    return true;
  }
}
