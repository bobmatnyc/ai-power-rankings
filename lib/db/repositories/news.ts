/**
 * News Database Repository
 * Handles all database operations for news articles
 */

import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "../index";
import { type NewNewsArticle, news } from "../schema";

export class NewsRepository {
  /**
   * Get all news articles
   */
  async getAll() {
    if (!db) {
      console.warn("Database not configured, returning empty array");
      return [];
    }

    try {
      const articles = await db.select().from(news).orderBy(desc(news.publishedAt));

      return articles;
    } catch (error) {
      console.error("Error fetching news articles:", error);
      return [];
    }
  }

  /**
   * Get news articles with pagination
   */
  async getPaginated(limit: number = 20, offset: number = 0) {
    if (!db) {
      return { articles: [], total: 0, hasMore: false };
    }

    try {
      // Get paginated articles
      const articles = await db
        .select()
        .from(news)
        .orderBy(desc(news.publishedAt))
        .limit(limit)
        .offset(offset);

      // Get total count
      const countResult = await db.select({ count: sql<number>`count(*)` }).from(news);

      const total = Number(countResult[0]?.count || 0);
      const hasMore = offset + limit < total;

      return { articles, total, hasMore };
    } catch (error) {
      console.error("Error fetching paginated news:", error);
      return { articles: [], total: 0, hasMore: false };
    }
  }

  /**
   * Get news article by slug
   */
  async getBySlug(slug: string) {
    if (!db) return null;

    try {
      const results = await db.select().from(news).where(eq(news.slug, slug)).limit(1);

      return results[0] || null;
    } catch (error) {
      console.error("Error fetching news by slug:", error);
      return null;
    }
  }

  /**
   * Get news articles by date range
   */
  async getByDateRange(startDate: Date, endDate: Date) {
    if (!db) return [];

    try {
      const articles = await db
        .select()
        .from(news)
        .where(and(gte(news.publishedAt, startDate), lte(news.publishedAt, endDate)))
        .orderBy(desc(news.publishedAt));

      return articles;
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
   * Calculate average tool mentions per article
   */
  async getAverageToolMentions() {
    const allArticles = await this.getAll();

    if (allArticles.length === 0) return 0;

    const totalMentions = allArticles.reduce((sum, article) => {
      const mentions = Array.isArray(article.toolMentions)
        ? (article.toolMentions as string[]).length
        : 0;
      return sum + mentions;
    }, 0);

    return totalMentions / allArticles.length;
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

  /**
   * Create a new article
   */
  async create(articleData: NewNewsArticle) {
    if (!db) {
      throw new Error("Database not configured");
    }

    try {
      const result = await db
        .insert(news)
        .values({
          ...articleData,
          slug: articleData.slug || this.generateSlug(articleData.title),
          publishedAt: articleData.publishedAt || new Date(),
          data: articleData.data || {},
          toolMentions: articleData.toolMentions || [],
        })
        .returning();

      return result[0];
    } catch (error) {
      console.error("Error creating news article:", error);
      throw error;
    }
  }

  /**
   * Update an article
   */
  async update(slug: string, updates: Partial<NewNewsArticle>) {
    if (!db) {
      throw new Error("Database not configured");
    }

    try {
      const result = await db
        .update(news)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(news.slug, slug))
        .returning();

      return result[0];
    } catch (error) {
      console.error("Error updating news article:", error);
      throw error;
    }
  }

  /**
   * Delete an article
   */
  async delete(slug: string) {
    if (!db) {
      throw new Error("Database not configured");
    }

    try {
      const result = await db.delete(news).where(eq(news.slug, slug)).returning();

      return result[0];
    } catch (error) {
      console.error("Error deleting news article:", error);
      throw error;
    }
  }

  /**
   * Generate slug from title
   */
  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .substring(0, 100);
  }
}

// Export singleton instance
export const newsRepository = new NewsRepository();
