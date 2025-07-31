#!/usr/bin/env tsx

/**
 * Historical Rankings Migration Script
 *
 * Migrates historical ranking data from exports to JSON database
 * Part of T-004: Migrate rankings data to JSON
 */

import path from "node:path";
import fs from "fs-extra";
import { getRankingsRepo, getToolsRepo, initializeRepositories } from "../../src/lib/json-db";
import type { RankingEntry, RankingPeriod } from "../../src/lib/json-db/schemas";
import { loggers } from "../../src/lib/logger";

const logger = loggers.migration;

interface HistoricalMigrationStats {
  periods: number;
  rankings: number;
  errors: string[];
}

class HistoricalRankingsMigrator {
  private stats: HistoricalMigrationStats = {
    periods: 0,
    rankings: 0,
    errors: [],
  };

  private exportsDir = path.join(process.cwd(), "data", "exports");

  async run() {
    try {
      logger.info("Starting historical rankings migration...");

      // Initialize repositories
      await initializeRepositories();

      // Migrate historical data from different sources
      await this.migrateFromProductionExport();
      await this.migrateFromHistoricalJson();

      // Report results
      this.reportResults();

      logger.info("Historical rankings migration completed successfully!");
    } catch (error) {
      logger.error("Historical rankings migration failed", { error });
      this.stats.errors.push(`Migration failed: ${error}`);
      throw error;
    }
  }

  private async migrateFromProductionExport(): Promise<void> {
    logger.info("Migrating from production export data...");

    try {
      const prodExportDir = path.join(this.exportsDir, "prod-export-2025-06-11");
      const rankingCachePath = path.join(prodExportDir, "ranking_cache.json");
      const rankingPeriodsPath = path.join(prodExportDir, "ranking_periods.json");

      if (!(await fs.pathExists(rankingCachePath)) || !(await fs.pathExists(rankingPeriodsPath))) {
        logger.warn("Production export files not found, skipping production migration");
        return;
      }

      const rankingCache = await fs.readJson(rankingCachePath);
      const rankingPeriods = await fs.readJson(rankingPeriodsPath);

      const rankingsRepo = getRankingsRepo();
      const toolsRepo = getToolsRepo();

      // Get existing tools for ID mapping
      const existingTools = await toolsRepo.getAll();
      const toolsMap = new Map(existingTools.map((tool) => [tool.name.toLowerCase(), tool.id]));

      // Process each period from the cache
      for (const cacheEntry of rankingCache) {
        try {
          const period = this.formatPeriod(cacheEntry.created_at || cacheEntry.period);

          if (!period || period === "2025-06") {
            // Skip current period as it's already migrated
            continue;
          }

          // Find corresponding period metadata
          const periodMeta = rankingPeriods.find(
            (p: any) =>
              this.formatPeriod(p.period) === period || this.formatPeriod(p.created_at) === period
          );

          const rankings: RankingEntry[] = [];

          if (cacheEntry.rankings && Array.isArray(cacheEntry.rankings)) {
            cacheEntry.rankings.forEach((ranking: any, index: number) => {
              const toolId = this.findToolId(ranking, toolsMap, index);

              rankings.push({
                tool_id: toolId,
                tool_name: ranking.tool_name || ranking.name || "Unknown Tool",
                position: ranking.position || ranking.rank || index + 1,
                score: ranking.score || 0,
                tier: ranking.tier || this.calculateTier(ranking.position || index + 1),
                factor_scores: {
                  agentic_capability: ranking.agentic_capability || 0,
                  innovation: ranking.innovation || 0,
                  technical_performance: ranking.technical_performance || 0,
                  developer_adoption: ranking.developer_adoption || 0,
                  market_traction: ranking.market_traction || 0,
                  business_sentiment: ranking.business_sentiment || 0,
                  development_velocity: ranking.development_velocity || 0,
                  platform_resilience: ranking.platform_resilience || 0,
                },
                movement: this.calculateMovement(ranking),
                change_analysis: {
                  primary_reason: ranking.primary_reason || undefined,
                  narrative_explanation: ranking.narrative_explanation || undefined,
                },
              });
            });
          }

          if (rankings.length > 0) {
            const rankingPeriod: RankingPeriod = {
              period,
              algorithm_version: periodMeta?.algorithm_version || "v5",
              is_current: false,
              created_at: cacheEntry.created_at || new Date().toISOString(),
              preview_date: undefined,
              rankings,
            };

            await rankingsRepo.saveRankingsForPeriod(rankingPeriod);
            this.stats.periods++;
            this.stats.rankings += rankings.length;

            logger.info(`Migrated historical period ${period} with ${rankings.length} rankings`);
          }
        } catch (error) {
          const errorMsg = `Failed to migrate period from cache: ${error}`;
          logger.error(errorMsg);
          this.stats.errors.push(errorMsg);
        }
      }
    } catch (error) {
      const errorMsg = `Production export migration failed: ${error}`;
      logger.error(errorMsg);
      this.stats.errors.push(errorMsg);
    }
  }

  private async migrateFromHistoricalJson(): Promise<void> {
    logger.info("Migrating from historical JSON file...");

    try {
      const historicalPath = path.join(this.exportsDir, "historical-rankings-june-2025.json");

      if (!(await fs.pathExists(historicalPath))) {
        logger.warn("Historical rankings JSON not found, skipping historical JSON migration");
        return;
      }

      const historicalData = await fs.readJson(historicalPath);
      const rankingsRepo = getRankingsRepo();
      const toolsRepo = getToolsRepo();

      // Get existing tools for ID mapping
      const existingTools = await toolsRepo.getAll();
      const toolsMap = new Map(existingTools.map((tool) => [tool.name.toLowerCase(), tool.id]));

      // Check if this is the enhanced June 2025 data
      if (historicalData.rankings && Array.isArray(historicalData.rankings)) {
        const period = "2025-06";

        // Check if we already have this period - if so, potentially upgrade it
        const existingPeriod = await rankingsRepo.getRankingsForPeriod(period);

        if (existingPeriod && historicalData.rankings.length > existingPeriod.rankings.length) {
          logger.info(
            `Upgrading ${period} with more comprehensive data (${historicalData.rankings.length} vs ${existingPeriod.rankings.length} tools)`
          );

          const rankings: RankingEntry[] = historicalData.rankings.map(
            (ranking: any, index: number) => {
              const toolId = this.findToolId(ranking, toolsMap, index);

              return {
                tool_id: toolId,
                tool_name: ranking.tool_name || ranking.name || "Unknown Tool",
                position: ranking.position || index + 1,
                score: ranking.score || 0,
                tier: ranking.tier || this.calculateTier(ranking.position || index + 1),
                factor_scores: {
                  agentic_capability: ranking.base_score || ranking.agentic_capability || 0,
                  innovation: ranking.innovation || 0,
                  technical_performance: ranking.technical_performance || 0,
                  developer_adoption: ranking.developer_adoption || 0,
                  market_traction: ranking.market_traction || 0,
                  business_sentiment: ranking.business_sentiment || 0,
                  development_velocity: ranking.development_velocity || 0,
                  platform_resilience: ranking.platform_resilience || 0,
                },
                movement: this.calculateMovement(ranking),
                change_analysis: {
                  primary_reason: ranking.primary_reason || undefined,
                  narrative_explanation: ranking.narrative_explanation || undefined,
                },
              };
            }
          );

          const enhancedPeriod: RankingPeriod = {
            period,
            algorithm_version: "v6-news",
            is_current: true,
            created_at: historicalData.created_at || new Date().toISOString(),
            preview_date: undefined,
            rankings,
          };

          await rankingsRepo.saveRankingsForPeriod(enhancedPeriod);
          this.stats.periods++;
          this.stats.rankings += rankings.length;

          logger.info(`Enhanced ${period} period with ${rankings.length} rankings`);
        }
      }
    } catch (error) {
      const errorMsg = `Historical JSON migration failed: ${error}`;
      logger.error(errorMsg);
      this.stats.errors.push(errorMsg);
    }
  }

  private findToolId(ranking: any, toolsMap: Map<string, string>, fallbackIndex: number): string {
    // Try to find tool ID by name
    if (ranking.tool_name) {
      const toolId = toolsMap.get(ranking.tool_name.toLowerCase());
      if (toolId) return toolId;
    }

    if (ranking.name) {
      const toolId = toolsMap.get(ranking.name.toLowerCase());
      if (toolId) return toolId;
    }

    // Try direct ID
    if (ranking.tool_id) {
      return ranking.tool_id.toString();
    }

    if (ranking.id) {
      return ranking.id.toString();
    }

    // Fallback to index-based ID
    return `historical-${fallbackIndex}`;
  }

  private formatPeriod(dateString: string): string | null {
    if (!dateString) return null;

    try {
      const date = new Date(dateString);
      if (Number.isNaN(date.getTime())) {
        // Try parsing as YYYY-MM format
        if (/^\d{4}-\d{2}$/.test(dateString)) {
          return dateString;
        }
        return null;
      }

      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      return `${year}-${month}`;
    } catch (error) {
      return null;
    }
  }

  private calculateTier(position: number): "S" | "A" | "B" | "C" | "D" {
    if (position <= 3) return "S";
    if (position <= 8) return "A";
    if (position <= 15) return "B";
    if (position <= 25) return "C";
    return "D";
  }

  private calculateMovement(
    ranking: any
  ):
    | { previous_position?: number; change: number; direction: "up" | "down" | "same" | "new" }
    | undefined {
    if (ranking.previous_position && ranking.position) {
      const change = ranking.previous_position - ranking.position;
      return {
        previous_position: ranking.previous_position,
        change: Math.abs(change),
        direction: change > 0 ? "up" : change < 0 ? "down" : "same",
      };
    }

    if (ranking.movement) {
      return ranking.movement;
    }

    return undefined;
  }

  private reportResults(): void {
    logger.info("Historical Rankings Migration Results:", {
      periods: this.stats.periods,
      rankings: this.stats.rankings,
      errors: this.stats.errors.length,
    });

    if (this.stats.errors.length > 0) {
      logger.error("Migration Errors:", this.stats.errors);
    }

    // Write results to file
    const resultsPath = path.join(
      process.cwd(),
      "data",
      "json",
      "historical-migration-results.json"
    );

    const results = {
      timestamp: new Date().toISOString(),
      migration_type: "historical-rankings-to-json",
      stats: this.stats,
      success: this.stats.errors.length === 0,
      source: "production exports and historical files",
    };

    fs.writeJsonSync(resultsPath, results, { spaces: 2 });
    logger.info("Historical migration results saved", { path: resultsPath });
  }
}

// Run migration if called directly
if (require.main === module) {
  const migrator = new HistoricalRankingsMigrator();
  migrator
    .run()
    .then(() => {
      logger.info("Historical rankings migration script completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      logger.error("Historical rankings migration script failed", { error });
      process.exit(1);
    });
}

export { HistoricalRankingsMigrator };
