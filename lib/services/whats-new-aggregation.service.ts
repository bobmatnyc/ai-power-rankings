/**
 * What's New Aggregation Service
 * Collects and aggregates data from multiple sources for monthly summaries
 */

import { createHash } from "crypto";
import { getDb } from "@/lib/db/connection";
import { articles } from "@/lib/db/article-schema";
import { rankings, tools } from "@/lib/db/schema";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { loggers } from "@/lib/logger";
import * as fs from "fs/promises";
import * as path from "path";

export interface MonthlyDataSources {
  newsArticles: Array<{
    id: string;
    title: string;
    summary: string | null;
    publishedAt: Date | null;
    importanceScore: number | null;
    toolMentions: any;
    source: string | null;
    sourceUrl: string | null;
  }>;
  rankingChanges: Array<{
    period: string;
    algorithmVersion: string;
    publishedAt: Date | null;
    toolCount: number;
  }>;
  newTools: Array<{
    id: string;
    name: string;
    category: string;
    createdAt: Date;
    scoreUpdatedAt: Date | null;
  }>;
  siteChanges: Array<{
    version: string;
    date: string;
    changes: Array<{
      type: string;
      description: string;
    }>;
  }>;
  metadata: {
    period: string;
    startDate: Date;
    endDate: Date;
    totalArticles: number;
    totalRankingChanges: number;
    totalNewTools: number;
    totalSiteChanges: number;
  };
}

export class WhatsNewAggregationService {
  /**
   * Get current period in YYYY-MM format
   */
  private getCurrentPeriod(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }

  /**
   * Get date range for filtering data
   * If month/year provided, returns the first and last day of that calendar month
   * Otherwise, returns a rolling 30-day window from now
   */
  private getDateRange(month?: number, year?: number): { startDate: Date; endDate: Date } {
    if (month && year) {
      // Filter by specific calendar month
      const startDate = new Date(year, month - 1, 1); // First day of month
      const endDate = new Date(year, month, 0, 23, 59, 59); // Last day of month
      return { startDate, endDate };
    }

    // Default: rolling 30-day window
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    return { startDate, endDate };
  }

  /**
   * Parse CHANGELOG.md to extract recent site changes
   */
  private async parseSiteChanges(startDate: Date): Promise<MonthlyDataSources["siteChanges"]> {
    try {
      const changelogPath = path.join(process.cwd(), "CHANGELOG.md");
      const content = await fs.readFile(changelogPath, "utf-8");

      // Parse changelog entries
      const versionRegex = /## \[([^\]]+)\] - (\d{4}-\d{2}-\d{2})/g;
      const changes: MonthlyDataSources["siteChanges"] = [];

      let match;
      let currentVersion: string | null = null;
      let currentDate: string | null = null;
      let currentChanges: Array<{ type: string; description: string }> = [];

      const lines = content.split("\n");
      let i = 0;

      while (i < lines.length) {
        const line = lines[i];

        // Check for version header
        const versionMatch = line.match(/## \[([^\]]+)\] - (\d{4}-\d{2}-\d{2})/);
        if (versionMatch) {
          // Save previous version if exists and within date range
          if (currentVersion && currentDate) {
            const changeDate = new Date(currentDate);
            if (changeDate >= startDate) {
              changes.push({
                version: currentVersion,
                date: currentDate,
                changes: [...currentChanges],
              });
            }
          }

          currentVersion = versionMatch[1];
          currentDate = versionMatch[2];
          currentChanges = [];
          i++;
          continue;
        }

        // Check for change type headers (Added, Changed, Fixed, etc.)
        const typeMatch = line.match(/### (Added|Changed|Fixed|Removed|Security|Performance|Deprecated)/);
        if (typeMatch && currentVersion) {
          const type = typeMatch[1];
          i++;

          // Collect all items under this type
          while (i < lines.length && lines[i].startsWith("- ")) {
            const description = lines[i].substring(2).trim();
            if (description) {
              currentChanges.push({
                type: type.toLowerCase(),
                description,
              });
            }
            i++;
          }
          continue;
        }

        i++;
      }

      // Save last version if within range
      if (currentVersion && currentDate) {
        const changeDate = new Date(currentDate);
        if (changeDate >= startDate) {
          changes.push({
            version: currentVersion,
            date: currentDate,
            changes: [...currentChanges],
          });
        }
      }

      loggers.api.debug(`Parsed ${changes.length} changelog entries from CHANGELOG.md`);
      return changes;
    } catch (error) {
      loggers.api.error("Failed to parse CHANGELOG.md", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return [];
    }
  }

  /**
   * Aggregate all data sources for monthly summary
   * @param month Optional month (1-12) to filter by specific calendar month
   * @param year Optional year to filter by specific calendar month
   */
  async getMonthlyData(month?: number, year?: number): Promise<MonthlyDataSources> {
    const db = getDb();
    if (!db) {
      throw new Error("Database connection not available");
    }

    const targetPeriod = month && year
      ? `${year}-${String(month).padStart(2, "0")}`
      : this.getCurrentPeriod();
    const { startDate, endDate } = this.getDateRange(month, year);

    loggers.api.info(`Aggregating monthly data for period: ${targetPeriod}`, {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    try {
      // Fetch all data sources in parallel
      const [newsArticles, rankingChanges, newTools, siteChanges] = await Promise.all([
        // 1. News Articles from ingested articles table (filtered by date range and status)
        db
          .select({
            id: articles.id,
            title: articles.title,
            summary: articles.summary,
            publishedAt: articles.publishedDate,
            importanceScore: articles.importanceScore,
            toolMentions: articles.toolMentions,
            source: articles.sourceName,
            sourceUrl: articles.sourceUrl,
          })
          .from(articles)
          .where(
            and(
              eq(articles.status, "active"),
              gte(articles.publishedDate, startDate),
              lte(articles.publishedDate, endDate)
            )
          )
          .orderBy(desc(articles.importanceScore), desc(articles.publishedDate))
          .limit(50),

        // 2. Ranking Changes (last 30 days)
        db
          .select({
            period: rankings.period,
            algorithmVersion: rankings.algorithmVersion,
            publishedAt: rankings.publishedAt,
            data: rankings.data,
          })
          .from(rankings)
          .where(gte(rankings.publishedAt, startDate))
          .orderBy(desc(rankings.publishedAt))
          .then((results) =>
            results.map((r) => ({
              period: r.period,
              algorithmVersion: r.algorithmVersion,
              publishedAt: r.publishedAt,
              toolCount: Array.isArray(r.data) ? r.data.length : 0,
            }))
          ),

        // 3. New Tools (created in last 30 days)
        db
          .select({
            id: tools.id,
            name: tools.name,
            category: tools.category,
            createdAt: tools.createdAt,
            scoreUpdatedAt: tools.scoreUpdatedAt,
          })
          .from(tools)
          .where(gte(tools.createdAt, startDate))
          .orderBy(desc(tools.createdAt))
          .limit(20),

        // 4. Site Changes from CHANGELOG.md
        this.parseSiteChanges(startDate),
      ]);

      const monthlyData: MonthlyDataSources = {
        newsArticles,
        rankingChanges,
        newTools,
        siteChanges,
        metadata: {
          period: targetPeriod,
          startDate,
          endDate,
          totalArticles: newsArticles.length,
          totalRankingChanges: rankingChanges.length,
          totalNewTools: newTools.length,
          totalSiteChanges: siteChanges.reduce((sum, v) => sum + v.changes.length, 0),
        },
      };

      loggers.api.info("Monthly data aggregation complete", {
        articles: monthlyData.metadata.totalArticles,
        rankingChanges: monthlyData.metadata.totalRankingChanges,
        newTools: monthlyData.metadata.totalNewTools,
        siteChanges: monthlyData.metadata.totalSiteChanges,
      });

      return monthlyData;
    } catch (error) {
      loggers.api.error("Failed to aggregate monthly data", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Calculate SHA-256 hash of aggregated data for change detection
   */
  calculateDataHash(data: MonthlyDataSources): string {
    // Create a deterministic string representation of the data
    const hashInput = JSON.stringify({
      articleIds: data.newsArticles.map((a) => a.id).sort(),
      rankingPeriods: data.rankingChanges.map((r) => r.period).sort(),
      toolIds: data.newTools.map((t) => t.id).sort(),
      siteVersions: data.siteChanges.map((s) => s.version).sort(),
      counts: {
        articles: data.metadata.totalArticles,
        rankings: data.metadata.totalRankingChanges,
        tools: data.metadata.totalNewTools,
        changes: data.metadata.totalSiteChanges,
      },
    });

    return createHash("sha256").update(hashInput).digest("hex");
  }

  /**
   * Check if data has changed since last summary generation
   */
  async hasDataChanged(month: number, year: number, previousHash: string): Promise<boolean> {
    const currentData = await this.getMonthlyData(month, year);
    const currentHash = this.calculateDataHash(currentData);
    return currentHash !== previousHash;
  }
}
