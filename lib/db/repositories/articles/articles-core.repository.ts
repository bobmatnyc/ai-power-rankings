/**
 * Articles Core Repository
 * Handles CRUD operations for articles
 */

import { revalidatePath } from "next/cache";
import { desc, eq } from "drizzle-orm";
import {
  type Article,
  type NewArticle,
  articles,
} from "@/lib/db/article-schema";
import { getDb } from "@/lib/db/connection";

type DbInstance = ReturnType<typeof getDb>;

/**
 * Validates and sanitizes a string field, truncating if necessary
 */
function validateAndSanitize(value: unknown, fieldName: string, maxLength?: number): unknown {
  if (typeof value === "string" && maxLength && value.length > maxLength) {
    console.warn(
      `[ArticlesRepo] Truncating ${fieldName} from ${value.length} to ${maxLength} characters`
    );
    return value.substring(0, maxLength);
  }
  return value;
}

/**
 * Ensures a valid JSON array from various input types
 */
function ensureJsonArray(value: unknown, fieldName: string): unknown[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      console.error(
        `[ArticlesRepo] Invalid ${fieldName} JSON string, defaulting to empty array`
      );
      return [];
    }
  }
  return [];
}

/**
 * Ensures a valid JSON object from various input types
 */
function ensureJsonObject(value: unknown, fieldName: string): object | null {
  if (!value) return null;
  if (typeof value === "object" && value !== null) return value as object;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      console.error(
        `[ArticlesRepo] Invalid ${fieldName} JSON string, defaulting to null`
      );
      return null;
    }
  }
  return null;
}

export class ArticlesCoreRepository {
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
   * Create a new article
   */
  async createArticle(article: NewArticle): Promise<Article> {
    this.ensureConnection();

    if (!this.db) throw new Error("Database not connected");

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
      slug: validateAndSanitize(article.slug, "slug", 255) as string,
      title: validateAndSanitize(article.title || "Untitled", "title", 500) as string,
      summary: validateAndSanitize(article.summary || "", "summary", undefined) as string,
      content: validateAndSanitize(article.content || "", "content", undefined) as string,

      // Ingestion metadata
      ingestionType: validateAndSanitize(article.ingestionType, "ingestionType", 20) as string,
      sourceUrl: validateAndSanitize(article.sourceUrl, "sourceUrl", 1000) as string | undefined,
      sourceName: validateAndSanitize(article.sourceName, "sourceName", 255) as string | undefined,
      fileName: validateAndSanitize(article.fileName, "fileName", 255) as string | undefined,
      fileType: validateAndSanitize(article.fileType, "fileType", 50) as string | undefined,

      // Ensure arrays are properly formatted
      tags: Array.isArray(article.tags) ? article.tags : [],

      // Category and author
      category: validateAndSanitize(article.category, "category", 100) as string | undefined,
      author: validateAndSanitize(article.author, "author", 255) as string | undefined,
      ingestedBy: validateAndSanitize(article.ingestedBy || "admin", "ingestedBy", 255) as string,

      // Ensure JSON fields are properly formatted
      toolMentions: ensureJsonArray(article.toolMentions, "toolMentions"),
      companyMentions: ensureJsonArray(article.companyMentions, "companyMentions"),
      rankingsSnapshot: ensureJsonObject(article.rankingsSnapshot, "rankingsSnapshot"),

      // Ensure numeric fields have proper defaults
      importanceScore: (() => {
        const score = article.importanceScore ?? 5;
        if (score < 1) return 1;
        if (score > 10) return 10;
        return score;
      })(),

      sentimentScore: (() => {
        const score = article.sentimentScore || "0";
        const numScore = parseFloat(score.toString());
        if (Number.isNaN(numScore)) return "0.00";
        if (numScore < -1) return "-1.00";
        if (numScore > 1) return "1.00";
        return numScore.toFixed(2);
      })(),

      // Status field
      status: validateAndSanitize(article.status || "active", "status", 20) as string,

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
      toolMentionsCount: Array.isArray(articleData.toolMentions) ? articleData.toolMentions.length : 0,
      companyMentionsCount: Array.isArray(articleData.companyMentions) ? articleData.companyMentions.length : 0,
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

      // Invalidate cache for news feeds when a published article is created
      if (createdArticle.status === "active" && createdArticle.publishedDate) {
        revalidatePath('/api/whats-new', 'layout');
        revalidatePath('/api/news', 'layout');
        console.log(`[ArticlesRepo] Cache invalidated for article: ${createdArticle.id}`);
      }

      return createdArticle;
    } catch (error) {
      console.error("[ArticlesRepo] Error creating article:", error);

      if (error instanceof Error) {
        const errorDetails: Record<string, unknown> = {
          message: error.message,
          name: error.name,
        };

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

        const enhancedError = new Error(
          `Database insert failed: ${errorDetails.type || "UNKNOWN_ERROR"}. ${errorDetails.hint || error.message}`
        );
        (enhancedError as Error & { originalError?: Error; errorDetails?: Record<string, unknown> }).originalError = error;
        (enhancedError as Error & { originalError?: Error; errorDetails?: Record<string, unknown> }).errorDetails = errorDetails;
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
   * Find article by ID (alias for getArticleById)
   */
  async findById(id: string): Promise<Article | null> {
    return this.getArticleById(id);
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

    if (!this.db) {
      throw new Error("Database connection not available after ensureConnection()");
    }

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
   * Find all articles (alias for getArticles without options)
   */
  async findAll(): Promise<Article[]> {
    return this.getArticles();
  }

  /**
   * Find articles by status
   */
  async findByStatus(status: string): Promise<Article[]> {
    return this.getArticles({ status });
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
    this.ensureConnection();

    if (!this.db) {
      throw new Error("Database connection not available after ensureConnection()");
    }

    if (hard) {
      const result = await this.db.delete(articles).where(eq(articles.id, id));
      return result && "rowCount" in result && result.rowCount !== null ? result.rowCount > 0 : false;
    } else {
      const result = await this.db
        .update(articles)
        .set({
          status: "deleted",
          updatedAt: new Date(),
        })
        .where(eq(articles.id, id))
        .returning();
      return (result?.length ?? 0) > 0;
    }
  }
}
