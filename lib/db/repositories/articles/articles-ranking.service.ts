/**
 * Articles Ranking Service
 * Handles ranking changes and rollback operations for articles
 */

import { and, desc, eq } from "drizzle-orm";
import {
  type ArticleRankingsChange,
  type NewArticleRankingsChange,
  type ArticleProcessingLog,
  type NewArticleProcessingLog,
  articleRankingsChanges,
  articleProcessingLogs,
} from "@/lib/db/article-schema";
import { getDb } from "@/lib/db/connection";

type DbInstance = ReturnType<typeof getDb>;

export class ArticlesRankingService {
  private db: DbInstance;

  constructor() {
    this.db = getDb();
  }

  private ensureConnection(): void {
    if (!this.db) {
      this.db = getDb();
      if (!this.db) {
        throw new Error("Database connection not available");
      }
    }
  }

  /**
   * Save article ranking changes
   */
  async saveRankingChanges(changes: NewArticleRankingsChange[]): Promise<ArticleRankingsChange[]> {
    if (changes.length === 0) return [];

    // Ensure all required fields are properly set for each change
    const validatedChanges = changes.map((change) => ({
      ...change,
      // Ensure required fields are not null/undefined
      articleId: change.articleId,
      toolId: change.toolId || "unknown", // tool_id is required, provide fallback
      toolName: change.toolName || "Unknown Tool",
      metricChanges: change.metricChanges || {},
      // Convert numeric fields properly
      oldRank: change.oldRank ?? null,
      newRank: change.newRank ?? null,
      rankChange: change.rankChange ?? null,
      oldScore: change.oldScore || "0",
      newScore: change.newScore || "0",
      scoreChange: change.scoreChange || "0",
      changeType: change.changeType || "no_change",
      changeReason: change.changeReason || "",
      isApplied: change.isApplied ?? true,
      appliedAt: change.appliedAt || new Date(),
      rolledBack: change.rolledBack ?? false,
      rolledBackAt: change.rolledBackAt || null,
      createdAt: new Date(),
    }));

    try {
      const saved = await this.db
        ?.insert(articleRankingsChanges)
        .values(validatedChanges)
        .returning();
      return saved || [];
    } catch (error) {
      console.error("[ArticlesRepo] Error saving ranking changes:", error);
      if (error instanceof Error) {
        console.error("[ArticlesRepo] SQL Error details:", {
          message: error.message,
          changes: validatedChanges,
        });
      }
      throw error;
    }
  }

  /**
   * Get ranking changes for an article
   */
  async getArticleRankingChanges(articleId: string): Promise<ArticleRankingsChange[]> {
    const result = await this.db
      ?.select()
      .from(articleRankingsChanges)
      .where(eq(articleRankingsChanges.articleId, articleId))
      .orderBy(desc(articleRankingsChanges.createdAt));
    return result || [];
  }

  /**
   * Rollback ranking changes for an article
   */
  async rollbackArticleRankings(articleId: string): Promise<number> {
    const result = await this.db
      ?.update(articleRankingsChanges)
      .set({
        isApplied: false,
        rolledBack: true,
        rolledBackAt: new Date(),
      })
      .where(
        and(
          eq(articleRankingsChanges.articleId, articleId),
          eq(articleRankingsChanges.isApplied, true),
          eq(articleRankingsChanges.rolledBack, false)
        )
      );

    return result && "rowCount" in result && result.rowCount !== null ? result.rowCount : 0;
  }

  /**
   * Get recent ranking changes across all articles
   */
  async getRecentRankingChanges(limit = 50): Promise<ArticleRankingsChange[]> {
    const result = await this.db
      ?.select()
      .from(articleRankingsChanges)
      .where(eq(articleRankingsChanges.isApplied, true))
      .orderBy(desc(articleRankingsChanges.appliedAt))
      .limit(limit);
    return result || [];
  }

  /**
   * Create a processing log entry
   */
  async createProcessingLog(log: NewArticleProcessingLog): Promise<ArticleProcessingLog> {
    this.ensureConnection();
    if (!this.db) throw new Error("Database not connected");
    const result = await this.db.insert(articleProcessingLogs).values(log).returning();
    if (!result || result.length === 0) {
      throw new Error("Failed to create processing log");
    }
    const createdLog = result[0];
    if (!createdLog) {
      throw new Error("Failed to create processing log - no result returned");
    }
    return createdLog;
  }

  /**
   * Update a processing log entry
   */
  async updateProcessingLog(
    id: string,
    updates: Partial<ArticleProcessingLog>
  ): Promise<ArticleProcessingLog | null> {
    const result = await this.db
      ?.update(articleProcessingLogs)
      .set(updates)
      .where(eq(articleProcessingLogs.id, id))
      .returning();
    return result?.[0] || null;
  }

  /**
   * Get processing logs for an article
   */
  async getArticleProcessingLogs(articleId: string): Promise<ArticleProcessingLog[]> {
    const result = await this.db
      ?.select()
      .from(articleProcessingLogs)
      .where(eq(articleProcessingLogs.articleId, articleId))
      .orderBy(desc(articleProcessingLogs.createdAt));
    return result || [];
  }
}
