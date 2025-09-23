/**
 * Articles Repository
 * Handles all database operations for articles and rankings management
 */

import { and, desc, eq, sql as sqlTag } from "drizzle-orm";
import {
  type Article,
  type ArticleProcessingLog,
  type ArticleRankingsChange,
  type ArticleWithImpact,
  articleProcessingLogs,
  articleRankingsChanges,
  articles,
  type NewArticle,
  type NewArticleProcessingLog,
  type NewArticleRankingsChange,
} from "@/lib/db/article-schema";
import { getDb } from "@/lib/db/connection";
import { companies, tools } from "@/lib/db/schema";

export class ArticlesRepository {
  private db: ReturnType<typeof getDb>;

  constructor() {
    this.db = getDb();
    // Don't throw in constructor - check in each method instead
    // This allows the class to be instantiated even if DB is temporarily unavailable
  }

  private ensureConnection() {
    if (!this.db) {
      // Try to get connection again in case it wasn't available at construction time
      this.db = getDb();
      if (!this.db) {
        throw new Error("Database connection not available");
      }
    }
  }

  /**
   * Create a new article
   */
  async createArticle(article: NewArticle): Promise<Article> {
    if (!this.db) throw new Error("Database not connected");

    // Validate and sanitize data before insert
    const validateAndSanitize = (value: any, fieldName: string, maxLength?: number): any => {
      if (typeof value === "string" && maxLength && value.length > maxLength) {
        console.warn(
          `[ArticlesRepo] Truncating ${fieldName} from ${value.length} to ${maxLength} characters`
        );
        return value.substring(0, maxLength);
      }
      return value;
    };

    // Validate ingestion type against allowed values
    const validIngestionTypes = ["url", "text", "file"];
    const ingestionType = article.ingestionType || "text";
    if (!validIngestionTypes.includes(ingestionType)) {
      console.warn(
        `[ArticlesRepo] Invalid ingestion type '${ingestionType}', defaulting to 'text'`
      );
      article.ingestionType = "text";
    }

    // Ensure JSON fields are properly formatted
    const articleData = {
      ...article,
      // Validate string fields with database constraints
      slug: validateAndSanitize(article.slug, "slug", 255),
      title: validateAndSanitize(article.title || "Untitled", "title", 500),
      summary: validateAndSanitize(article.summary || "", "summary", undefined), // text field, no limit
      content: validateAndSanitize(article.content || "", "content", undefined), // text field, no limit

      // Ingestion metadata
      ingestionType: validateAndSanitize(article.ingestionType, "ingestionType", 20),
      sourceUrl: validateAndSanitize(article.sourceUrl, "sourceUrl", 1000),
      sourceName: validateAndSanitize(article.sourceName, "sourceName", 255),
      fileName: validateAndSanitize(article.fileName, "fileName", 255),
      fileType: validateAndSanitize(article.fileType, "fileType", 50),

      // Ensure arrays are properly formatted
      tags: Array.isArray(article.tags) ? article.tags : [],

      // Category and author
      category: validateAndSanitize(article.category, "category", 100),
      author: validateAndSanitize(article.author, "author", 255),
      ingestedBy: validateAndSanitize(article.ingestedBy || "admin", "ingestedBy", 255),

      // Ensure JSON fields are properly formatted (already JSONB in schema, pass as-is)
      // But validate they are arrays/objects, not strings
      toolMentions: (() => {
        if (!article.toolMentions) return [];
        if (Array.isArray(article.toolMentions)) return article.toolMentions;
        if (typeof article.toolMentions === "string") {
          try {
            const parsed = JSON.parse(article.toolMentions);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            console.error(
              "[ArticlesRepo] Invalid toolMentions JSON string, defaulting to empty array"
            );
            return [];
          }
        }
        return [];
      })(),

      companyMentions: (() => {
        if (!article.companyMentions) return [];
        if (Array.isArray(article.companyMentions)) return article.companyMentions;
        if (typeof article.companyMentions === "string") {
          try {
            const parsed = JSON.parse(article.companyMentions);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            console.error(
              "[ArticlesRepo] Invalid companyMentions JSON string, defaulting to empty array"
            );
            return [];
          }
        }
        return [];
      })(),

      rankingsSnapshot: (() => {
        if (!article.rankingsSnapshot) return null;
        if (typeof article.rankingsSnapshot === "object") return article.rankingsSnapshot;
        if (typeof article.rankingsSnapshot === "string") {
          try {
            return JSON.parse(article.rankingsSnapshot);
          } catch {
            console.error(
              "[ArticlesRepo] Invalid rankingsSnapshot JSON string, defaulting to null"
            );
            return null;
          }
        }
        return null;
      })(),

      // Ensure numeric fields have proper defaults
      importanceScore: (() => {
        const score = article.importanceScore ?? 5;
        // Ensure it's within valid range (1-10)
        if (score < 1) return 1;
        if (score > 10) return 10;
        return score;
      })(),

      sentimentScore: (() => {
        const score = article.sentimentScore || "0";
        // Ensure it's a valid decimal string
        const numScore = parseFloat(score.toString());
        if (Number.isNaN(numScore)) return "0.00";
        // Clamp to valid range (-1 to 1)
        if (numScore < -1) return "-1.00";
        if (numScore > 1) return "1.00";
        return numScore.toFixed(2);
      })(),

      // Status field
      status: validateAndSanitize(article.status || "active", "status", 20),

      // Ensure timestamps are properly formatted
      publishedDate: article.publishedDate || new Date(),
      ingestedAt: article.ingestedAt || new Date(),
      processedAt: article.processedAt || null,
      createdAt: new Date(),
      updatedAt: new Date(),

      // Boolean field
      isProcessed: article.isProcessed ?? false,
    };

    // Log the data being inserted for debugging
    console.log("[ArticlesRepo] Creating article with data:", {
      slug: articleData.slug,
      title: `${articleData.title?.substring(0, 50)}...`,
      contentLength: articleData.content?.length,
      toolMentionsCount: articleData.toolMentions?.length,
      companyMentionsCount: articleData.companyMentions?.length,
      importanceScore: articleData.importanceScore,
      sentimentScore: articleData.sentimentScore,
    });

    try {
      const result = await this.db.insert(articles).values(articleData).returning();
      if (!result || result.length === 0) {
        throw new Error("Failed to create article - no rows returned from insert");
      }
      const createdArticle = result[0];
      if (!createdArticle) {
        throw new Error("Failed to create article - no result returned");
      }

      console.log(`[ArticlesRepo] Successfully created article with ID: ${createdArticle.id}`);
      return createdArticle;
    } catch (error) {
      console.error("[ArticlesRepo] Error creating article:", error);

      if (error instanceof Error) {
        // Enhanced error logging for better debugging
        const errorDetails: any = {
          message: error.message,
          name: error.name,
        };

        // Check for specific database errors
        if (error.message.includes("violates check constraint")) {
          errorDetails.type = "CHECK_CONSTRAINT_VIOLATION";
          errorDetails.hint = "One or more field values do not meet database constraints";
        } else if (error.message.includes("value too long")) {
          errorDetails.type = "FIELD_TOO_LONG";
          errorDetails.hint = "One or more text fields exceed maximum length";
        } else if (error.message.includes("invalid input syntax")) {
          errorDetails.type = "INVALID_DATA_TYPE";
          errorDetails.hint = "Data type mismatch for one or more fields";
        } else if (error.message.includes("duplicate key")) {
          errorDetails.type = "DUPLICATE_KEY";
          errorDetails.hint = "Article with this slug already exists";
        } else if (error.message.includes("not-null constraint")) {
          errorDetails.type = "NULL_CONSTRAINT";
          errorDetails.hint = "Required field is missing or null";
        }

        console.error("[ArticlesRepo] Detailed error info:", errorDetails);
        console.error("[ArticlesRepo] Failed data sample:", {
          slug: articleData.slug,
          title: articleData.title?.substring(0, 100),
          tagsCount: articleData.tags?.length,
          toolMentionsType: typeof articleData.toolMentions,
          companyMentionsType: typeof articleData.companyMentions,
          rankingsSnapshotType: typeof articleData.rankingsSnapshot,
        });

        // Throw a more informative error
        const enhancedError = new Error(
          `Database insert failed: ${errorDetails.type || "UNKNOWN_ERROR"}. ${errorDetails.hint || error.message}`
        );
        (enhancedError as any).originalError = error;
        (enhancedError as any).errorDetails = errorDetails;
        throw enhancedError;
      }

      throw error;
    }
  }

  /**
   * Get article by ID
   */
  async getArticleById(id: string): Promise<Article | null> {
    if (!this.db) return null;
    const result = await this.db.select().from(articles).where(eq(articles.id, id)).limit(1);
    return result?.[0] || null;
  }

  /**
   * Get article by slug
   */
  async getArticleBySlug(slug: string): Promise<Article | null> {
    if (!this.db) return null;
    const result = await this.db.select().from(articles).where(eq(articles.slug, slug)).limit(1);
    return result?.[0] || null;
  }

  /**
   * Get all articles with optional filtering
   */
  async getArticles(options?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<Article[]> {
    this.ensureConnection();

    let query = this.db.select().from(articles).orderBy(desc(articles.publishedDate));

    if (options?.status) {
      query = query.where(eq(articles.status, options.status)) as typeof query;
    }

    if (options?.limit) {
      query = query.limit(options.limit) as typeof query;
    }

    if (options?.offset) {
      query = query.offset(options.offset) as typeof query;
    }

    const result = await query;
    return result || [];
  }

  /**
   * Update an article
   */
  async updateArticle(id: string, updates: Partial<Article>): Promise<Article | null> {
    const result = await this.db
      ?.update(articles)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(articles.id, id))
      .returning();
    return result?.[0] || null;
  }

  /**
   * Delete an article (soft delete by default)
   */
  async deleteArticle(id: string, hard = false): Promise<boolean> {
    if (hard) {
      const result = await this.db?.delete(articles).where(eq(articles.id, id));
      return result && "rowCount" in result ? result.rowCount > 0 : false;
    } else {
      const result = await this.db
        ?.update(articles)
        .set({
          status: "deleted",
          updatedAt: new Date(),
        })
        .where(eq(articles.id, id))
        .returning();
      return (result?.length ?? 0) > 0;
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
      companiesMentioned: Array.isArray(article.companyMentions)
        ? article.companyMentions.length
        : 0,
      avgRankChange:
        changes.reduce((sum, c) => sum + (c.rankChange || 0), 0) / (changes.length || 1),
      avgScoreChange:
        changes.reduce((sum, c) => sum + Number(c.scoreChange || 0), 0) / (changes.length || 1),
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

    return result && "rowCount" in result ? result.rowCount : 0;
  }

  /**
   * Create a processing log entry
   */
  async createProcessingLog(log: NewArticleProcessingLog): Promise<ArticleProcessingLog> {
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
  ): Promise<{ id: string; name: string; slug: string; category: string }> {
    const result = await this.db
      ?.insert(tools)
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
    if (!result || result.length === 0) {
      throw new Error("Failed to create tool");
    }
    return result[0] as { id: string; name: string; slug: string; category: string };
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
  ): Promise<{ id: string; name: string; slug: string }> {
    try {
      // Ensure slug is valid and unique
      const validSlug = companyData.slug
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      // Check if company already exists
      const existing = await this.db
        ?.select()
        .from(companies)
        .where(eq(companies.slug, validSlug))
        .limit(1);

      if (existing && existing.length > 0) {
        console.log(`[ArticlesRepo] Company ${validSlug} already exists, returning existing`);
        return existing[0] as { id: string; name: string; slug: string };
      }

      const result = await this.db
        ?.insert(companies)
        .values({
          slug: validSlug,
          name: companyData.name,
          data: {
            website: companyData.website || null,
            autoCreated: true,
            createdByArticleId: articleId,
            firstMentionedDate: new Date().toISOString(),
          },
        })
        .returning();

      if (!result || result.length === 0) {
        throw new Error(`Failed to create company: ${companyData.name}`);
      }

      console.log(`[ArticlesRepo] Created new company: ${validSlug}`);
      return result[0] as { id: string; name: string; slug: string };
    } catch (error) {
      console.error("[ArticlesRepo] Error creating company:", error);
      throw new Error(
        `Failed to create company ${companyData.name}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Get articles that mention a specific tool
   */
  async getArticlesByToolMention(toolName: string): Promise<Article[]> {
    // Use JSONB containment operator
    const result = await this.db
      ?.select()
      .from(articles)
      .where(sqlTag`${articles.toolMentions} @> ${JSON.stringify([{ tool: toolName }])}`)
      .orderBy(desc(articles.publishedDate));
    return result || [];
  }

  /**
   * Get articles that mention a specific company
   */
  async getArticlesByCompanyMention(companyName: string): Promise<Article[]> {
    // Use JSONB containment operator
    const result = await this.db
      ?.select()
      .from(articles)
      .where(sqlTag`${articles.companyMentions} @> ${JSON.stringify([{ company: companyName }])}`)
      .orderBy(desc(articles.publishedDate));
    return result || [];
  }

  /**
   * Get articles by importance score threshold
   */
  async getImportantArticles(minScore = 7): Promise<Article[]> {
    const result = await this.db
      ?.select()
      .from(articles)
      .where(and(eq(articles.status, "active"), sqlTag`${articles.importanceScore} >= ${minScore}`))
      .orderBy(desc(articles.importanceScore), desc(articles.publishedDate));
    return result || [];
  }

  /**
   * Search articles by tags
   */
  async searchArticlesByTags(tags: string[]): Promise<Article[]> {
    // Use array overlap operator
    const result = await this.db
      ?.select()
      .from(articles)
      .where(sqlTag`${articles.tags} && ARRAY[${tags.map((t) => `'${t}'`).join(",")}]::text[]`)
      .orderBy(desc(articles.publishedDate));
    return result || [];
  }

  /**
   * Get article statistics
   */
  async getArticleStats(): Promise<{
    totalArticles: number;
    articlesThisMonth: number;
    articlesLastMonth: number;
    averageToolMentions: number;
    topCategories: Array<{ category: string; count: number }>;
  }> {
    this.ensureConnection();

    // Get basic counts
    const stats = await this.db
      ?.select({
        total: sqlTag`COUNT(*)`.as("total"),
        active: sqlTag`COUNT(CASE WHEN status = 'active' THEN 1 END)`.as("active"),
      })
      .from(articles);

    const firstStat = stats?.[0];
    const totalArticles = firstStat ? Number(firstStat.total || 0) : 0;

    // Calculate current month and last month dates
    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    // Get articles for this month
    const thisMonthStats = await this.db
      ?.select({
        count: sqlTag`COUNT(*)`.as("count"),
      })
      .from(articles)
      .where(sqlTag`${articles.createdAt} >= ${startOfThisMonth}`);

    const articlesThisMonth = thisMonthStats?.[0] ? Number(thisMonthStats[0].count || 0) : 0;

    // Get articles for last month
    const lastMonthStats = await this.db
      ?.select({
        count: sqlTag`COUNT(*)`.as("count"),
      })
      .from(articles)
      .where(
        sqlTag`${articles.createdAt} >= ${startOfLastMonth} AND ${articles.createdAt} <= ${endOfLastMonth}`
      );

    const articlesLastMonth = lastMonthStats?.[0] ? Number(lastMonthStats[0].count || 0) : 0;

    // Calculate average tool mentions per article
    // First, get all articles with their tool mentions
    const articlesWithMentions = await this.db
      ?.select({
        toolMentions: articles.toolMentions,
      })
      .from(articles)
      .where(eq(articles.status, "active"));

    let totalMentions = 0;
    let articlesWithTools = 0;

    if (articlesWithMentions) {
      for (const article of articlesWithMentions) {
        if (article.toolMentions && Array.isArray(article.toolMentions)) {
          const mentionCount = article.toolMentions.length;
          if (mentionCount > 0) {
            totalMentions += mentionCount;
            articlesWithTools++;
          }
        }
      }
    }

    const averageToolMentions = articlesWithTools > 0 ? totalMentions / articlesWithTools : 0;

    // Get top categories
    const categoryStats = await this.db
      ?.select({
        category: articles.category,
        count: sqlTag`COUNT(*)`.as("count"),
      })
      .from(articles)
      .where(eq(articles.status, "active"))
      .groupBy(articles.category)
      .orderBy(sqlTag`COUNT(*) DESC`)
      .limit(5);

    const topCategories =
      categoryStats?.map((cat) => ({
        category: cat.category || "Uncategorized",
        count: Number(cat.count || 0),
      })) || [];

    return {
      totalArticles,
      articlesThisMonth,
      articlesLastMonth,
      averageToolMentions,
      topCategories,
    };
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
   * Check if an article slug exists
   */
  async slugExists(slug: string): Promise<boolean> {
    const result = await this.db
      ?.select({ count: sqlTag`COUNT(*)`.as("count") })
      .from(articles)
      .where(eq(articles.slug, slug));
    const firstResult = result?.[0];
    return firstResult ? Number(firstResult.count || 0) > 0 : false;
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
