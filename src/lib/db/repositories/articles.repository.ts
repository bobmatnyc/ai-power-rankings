/**
 * Articles Repository
 * Handles all database operations for articles and rankings management
 */

import { eq, desc, and, sql as sqlTag } from "drizzle-orm";
import { getDb } from "@/lib/db/connection";
import {
  articles,
  articleRankingsChanges,
  articleProcessingLogs,
  type Article,
  type NewArticle,
  type ArticleRankingsChange,
  type NewArticleRankingsChange,
  type ArticleProcessingLog,
  type NewArticleProcessingLog,
  type ArticleWithImpact,
} from "@/lib/db/article-schema";
import { tools, companies } from "@/lib/db/schema";

export class ArticlesRepository {
  private db: ReturnType<typeof getDb>;

  constructor() {
    this.db = getDb();
    if (!this.db) {
      throw new Error("Database connection not available");
    }
  }

  /**
   * Create a new article
   */
  async createArticle(article: NewArticle): Promise<Article> {
    const [created] = await this.db?.insert(articles).values(article).returning();
    return created;
  }

  /**
   * Get article by ID
   */
  async getArticleById(id: string): Promise<Article | null> {
    const [article] = await this.db?.select()
      .from(articles)
      .where(eq(articles.id, id))
      .limit(1);
    return article || null;
  }

  /**
   * Get article by slug
   */
  async getArticleBySlug(slug: string): Promise<Article | null> {
    const [article] = await this.db?.select()
      .from(articles)
      .where(eq(articles.slug, slug))
      .limit(1);
    return article || null;
  }

  /**
   * Get all articles with optional filtering
   */
  async getArticles(options?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<Article[]> {
    let query = this.db?.select().from(articles);

    if (options?.status) {
      query = query.where(eq(articles.status, options.status));
    }

    query = query.orderBy(desc(articles.publishedDate));

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.offset(options.offset);
    }

    return await query;
  }

  /**
   * Update an article
   */
  async updateArticle(id: string, updates: Partial<Article>): Promise<Article | null> {
    const [updated] = await this.db?.update(articles)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(articles.id, id))
      .returning();
    return updated || null;
  }

  /**
   * Delete an article (soft delete by default)
   */
  async deleteArticle(id: string, hard = false): Promise<boolean> {
    if (hard) {
      const result = await this.db?.delete(articles).where(eq(articles.id, id));
      return result.rowCount > 0;
    } else {
      const [updated] = await this.db?.update(articles)
        .set({
          status: "deleted",
          updatedAt: new Date(),
        })
        .where(eq(articles.id, id))
        .returning();
      return !!updated;
    }
  }

  /**
   * Get article with impact statistics
   */
  async getArticleWithImpact(id: string): Promise<ArticleWithImpact | null> {
    const article = await this.getArticleById(id);
    if (!article) return null;

    // Get impact statistics
    const changes = await this.getArticleRankingChanges(id);

    const impact = {
      toolsAffected: new Set(changes.map((c) => c.toolId)).size,
      companiesMentioned: (article.companyMentions as any[])?.length || 0,
      avgRankChange:
        changes.reduce((sum, c) => sum + (c.rankChange || 0), 0) / (changes.length || 1),
      avgScoreChange:
        changes.reduce((sum, c) => sum + (c.scoreChange || 0), 0) / (changes.length || 1),
      toolsImproved: changes.filter((c) => c.changeType === "increase").length,
      toolsDeclined: changes.filter((c) => c.changeType === "decrease").length,
      newToolsAdded: changes.filter((c) => c.changeType === "new_entry").length,
    };

    return {
      ...article,
      impact,
    };
  }

  /**
   * Save article ranking changes
   */
  async saveRankingChanges(changes: NewArticleRankingsChange[]): Promise<ArticleRankingsChange[]> {
    if (changes.length === 0) return [];
    const saved = await this.db?.insert(articleRankingsChanges).values(changes).returning();
    return saved;
  }

  /**
   * Get ranking changes for an article
   */
  async getArticleRankingChanges(articleId: string): Promise<ArticleRankingsChange[]> {
    return await this.db?.select()
      .from(articleRankingsChanges)
      .where(eq(articleRankingsChanges.articleId, articleId))
      .orderBy(desc(articleRankingsChanges.createdAt));
  }

  /**
   * Rollback ranking changes for an article
   */
  async rollbackArticleRankings(articleId: string): Promise<number> {
    const result = await this.db?.update(articleRankingsChanges)
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

    return result.rowCount;
  }

  /**
   * Create a processing log entry
   */
  async createProcessingLog(log: NewArticleProcessingLog): Promise<ArticleProcessingLog> {
    const [created] = await this.db?.insert(articleProcessingLogs).values(log).returning();
    return created;
  }

  /**
   * Update a processing log entry
   */
  async updateProcessingLog(
    id: string,
    updates: Partial<ArticleProcessingLog>
  ): Promise<ArticleProcessingLog | null> {
    const [updated] = await this.db?.update(articleProcessingLogs)
      .set(updates)
      .where(eq(articleProcessingLogs.id, id))
      .returning();
    return updated || null;
  }

  /**
   * Get processing logs for an article
   */
  async getArticleProcessingLogs(articleId: string): Promise<ArticleProcessingLog[]> {
    return await this.db?.select()
      .from(articleProcessingLogs)
      .where(eq(articleProcessingLogs.articleId, articleId))
      .orderBy(desc(articleProcessingLogs.createdAt));
  }

  /**
   * Create a new tool (auto-created from article)
   */
  async createAutoTool(
    toolData: {
      name: string;
      slug: string;
      category: string;
      companyId?: string;
    },
    articleId: string
  ): Promise<any> {
    const [created] = await this.db?.insert(tools)
      .values({
        name: toolData.name,
        slug: toolData.slug,
        category: toolData.category,
        companyId: toolData.companyId,
        status: "active",
        data: {
          autoCreated: true,
          createdByArticleId: articleId,
          firstMentionedDate: new Date().toISOString(),
        },
      })
      .returning();
    return created;
  }

  /**
   * Create a new company (auto-created from article)
   */
  async createAutoCompany(
    companyData: {
      name: string;
      slug: string;
      website?: string;
    },
    articleId: string
  ): Promise<any> {
    const [created] = await this.db?.insert(companies)
      .values({
        name: companyData.name,
        slug: companyData.slug,
        data: {
          website: companyData.website,
          autoCreated: true,
          createdByArticleId: articleId,
          firstMentionedDate: new Date().toISOString(),
        },
      })
      .returning();
    return created;
  }

  /**
   * Get articles that mention a specific tool
   */
  async getArticlesByToolMention(toolName: string): Promise<Article[]> {
    // Use JSONB containment operator
    return await this.db?.select()
      .from(articles)
      .where(
        sqlTag`${articles.toolMentions} @> ${JSON.stringify([{ tool: toolName }])}`
      )
      .orderBy(desc(articles.publishedDate));
  }

  /**
   * Get articles that mention a specific company
   */
  async getArticlesByCompanyMention(companyName: string): Promise<Article[]> {
    // Use JSONB containment operator
    return await this.db?.select()
      .from(articles)
      .where(
        sqlTag`${articles.companyMentions} @> ${JSON.stringify([{ company: companyName }])}`
      )
      .orderBy(desc(articles.publishedDate));
  }

  /**
   * Get articles by importance score threshold
   */
  async getImportantArticles(minScore = 7): Promise<Article[]> {
    return await this.db?.select()
      .from(articles)
      .where(
        and(
          eq(articles.status, "active"),
          sqlTag`${articles.importanceScore} >= ${minScore}`
        )
      )
      .orderBy(desc(articles.importanceScore), desc(articles.publishedDate));
  }

  /**
   * Search articles by tags
   */
  async searchArticlesByTags(tags: string[]): Promise<Article[]> {
    // Use array overlap operator
    return await this.db?.select()
      .from(articles)
      .where(
        sqlTag`${articles.tags} && ARRAY[${tags.map((t) => `'${t}'`).join(",")}]::text[]`
      )
      .orderBy(desc(articles.publishedDate));
  }

  /**
   * Get article statistics
   */
  async getArticleStats(): Promise<{
    total: number;
    active: number;
    deleted: number;
    totalToolMentions: number;
    averageImportance: number;
  }> {
    const stats = await this.db?.select({
        total: sqlTag`COUNT(*)`.as("total"),
        active: sqlTag`COUNT(CASE WHEN status = 'active' THEN 1 END)`.as("active"),
        deleted: sqlTag`COUNT(CASE WHEN status = 'deleted' THEN 1 END)`.as("deleted"),
        avgImportance: sqlTag`AVG(importance_score)`.as("avgImportance"),
      })
      .from(articles);

    // Get tool mentions count
    const toolMentions = await this.db?.select({
        count: sqlTag`COUNT(*)`.as("count"),
      })
      .from(articleRankingsChanges);

    return {
      total: Number(stats[0]?.total || 0),
      active: Number(stats[0]?.active || 0),
      deleted: Number(stats[0]?.deleted || 0),
      totalToolMentions: Number(toolMentions[0]?.count || 0),
      averageImportance: Number(stats[0]?.avgImportance || 0),
    };
  }

  /**
   * Get recent ranking changes across all articles
   */
  async getRecentRankingChanges(limit = 50): Promise<ArticleRankingsChange[]> {
    return await this.db?.select()
      .from(articleRankingsChanges)
      .where(eq(articleRankingsChanges.isApplied, true))
      .orderBy(desc(articleRankingsChanges.appliedAt))
      .limit(limit);
  }

  /**
   * Check if an article slug exists
   */
  async slugExists(slug: string): Promise<boolean> {
    const [result] = await this.db?.select({ count: sqlTag`COUNT(*)`.as("count") })
      .from(articles)
      .where(eq(articles.slug, slug));
    return Number(result?.count || 0) > 0;
  }

  /**
   * Generate a unique slug for an article
   */
  async generateUniqueSlug(title: string): Promise<string> {
    const baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    let slug = baseSlug;
    let counter = 1;

    while (await this.slugExists(slug)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }
}