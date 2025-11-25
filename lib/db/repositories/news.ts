/**
 * News Database Repository
 * Handles all database operations for news articles
 * Now queries the articles table which contains the actual data
 */

import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { getDb } from "../connection";
import { articles, type Article } from "../article-schema";

// Type for the news article format expected by the frontend
interface NewsArticle {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  content: string;
  source: string | null;
  sourceUrl: string | null;
  publishedAt: Date;
  toolMentions?: any;
  importanceScore?: number | null;
  tags?: string[] | null;
  category?: string | null;
}

export class NewsRepository {
  /**
   * Map article from articles table to news format
   */
  private mapArticleToNews(article: Article): NewsArticle {
    const content = article.contentMarkdown || article.content || "";
    return {
      id: article.id,
      slug: article.slug,
      title: article.title,
      summary: article.summary,
      content,
      source: article.sourceName,
      sourceUrl: article.sourceUrl,
      publishedAt: article.publishedDate || article.createdAt,
      toolMentions: article.toolMentions,
      importanceScore: article.importanceScore,
      tags: article.tags,
      category: article.category,
    };
  }

  /**
   * Get all active news articles
   */
  async getAll() {
    const db = getDb();
    if (!db) {
      console.warn("Database not configured, returning empty array");
      return [];
    }

    try {
      const results = await db
        .select()
        .from(articles)
        .where(eq(articles.status, "active"))
        .orderBy(desc(articles.publishedDate));

      return results.map((article) => this.mapArticleToNews(article));
    } catch (error) {
      console.error("Error fetching news articles:", error);
      return [];
    }
  }

  /**
   * Get news articles with pagination
   */
  async getPaginated(limit: number = 20, offset: number = 0) {
    const db = getDb();
    if (!db) {
      return { articles: [], total: 0, hasMore: false };
    }

    try {
      // Get paginated articles
      const results = await db
        .select()
        .from(articles)
        .where(eq(articles.status, "active"))
        .orderBy(desc(articles.publishedDate))
        .limit(limit)
        .offset(offset);

      // Get total count of active articles
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(articles)
        .where(eq(articles.status, "active"));

      const total = Number(countResult[0]?.count || 0);
      const hasMore = offset + limit < total;

      return {
        articles: results.map((article) => this.mapArticleToNews(article)),
        total,
        hasMore
      };
    } catch (error) {
      console.error("Error fetching paginated news:", error);
      return { articles: [], total: 0, hasMore: false };
    }
  }

  /**
   * Get news article by slug
   */
  async getBySlug(slug: string) {
    const db = getDb();
    if (!db) return null;

    try {
      const results = await db
        .select()
        .from(articles)
        .where(and(
          eq(articles.slug, slug),
          eq(articles.status, "active")
        ))
        .limit(1);

      return results[0] ? this.mapArticleToNews(results[0]) : null;
    } catch (error) {
      console.error("Error fetching news by slug:", error);
      return null;
    }
  }

  /**
   * Get news articles by date range
   */
  async getByDateRange(startDate: Date, endDate: Date) {
    const db = getDb();
    if (!db) return [];

    try {
      const results = await db
        .select()
        .from(articles)
        .where(and(
          eq(articles.status, "active"),
          gte(articles.publishedDate, startDate),
          lte(articles.publishedDate, endDate)
        ))
        .orderBy(desc(articles.publishedDate));

      return results.map(this.mapArticleToNews);
    } catch (error) {
      console.error("Error fetching news by date range:", error);
      return [];
    }
  }

  /**
   * Get news for current month
   */
  async getCurrentMonth() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    return this.getByDateRange(startOfMonth, endOfMonth);
  }

  /**
   * Get news for last month
   */
  async getLastMonth() {
    const now = new Date();
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    return this.getByDateRange(startOfLastMonth, endOfLastMonth);
  }

  /**
   * Get recent active articles
   */
  async getRecent(limit: number = 10) {
    const db = getDb();
    if (!db) return [];

    try {
      const results = await db
        .select()
        .from(articles)
        .where(eq(articles.status, "active"))
        .orderBy(desc(articles.publishedDate))
        .limit(limit);

      return results.map(this.mapArticleToNews);
    } catch (error) {
      console.error("Error fetching recent news:", error);
      return [];
    }
  }

  /**
   * Calculate average tool mentions per article
   */
  async getAverageToolMentions() {
    const allArticles = await this.getAll();

    if (allArticles.length === 0) return 0;

    const totalMentions = allArticles.reduce((sum, article) => {
      const mentions = Array.isArray(article.toolMentions)
        ? (article.toolMentions as any[]).length
        : 0;
      return sum + mentions;
    }, 0);

    return totalMentions / allArticles.length;
  }

  /**
   * Search news articles by tool name
   */
  async searchByToolName(toolName: string, limit: number = 10) {
    const db = getDb();
    if (!db) return [];

    try {
      // Search in toolMentions JSONB array for the tool name
      const results = await db
        .select()
        .from(articles)
        .where(
          and(
            eq(articles.status, "active"),
            sql`${articles.toolMentions}::jsonb @> ${JSON.stringify([{ name: toolName }])}::jsonb OR
                ${articles.toolMentions}::jsonb @> ${JSON.stringify([toolName])}::jsonb OR
                ${articles.title} ILIKE ${`%${toolName}%`}`
          )
        )
        .orderBy(desc(articles.publishedDate))
        .limit(limit);

      return results.map((article) => this.mapArticleToNews(article));
    } catch (error) {
      console.error("Error searching news by tool name:", error);
      return [];
    }
  }

  /**
   * Get article statistics
   */
  async getStatistics() {
    const [total, currentMonth, lastMonth, avgMentions] = await Promise.all([
      this.getAll().then((articles) => articles.length),
      this.getCurrentMonth().then((articles) => articles.length),
      this.getLastMonth().then((articles) => articles.length),
      this.getAverageToolMentions(),
    ]);

    return {
      total,
      currentMonth,
      lastMonth,
      averageToolMentions: Math.round(avgMentions * 10) / 10, // Round to 1 decimal
    };
  }

  // Note: Create, update, and delete operations should be performed
  // through the articles table directly, not through this news repository
  // which is designed for read-only access to active articles
}

// Export singleton instance
export const newsRepository = new NewsRepository();
