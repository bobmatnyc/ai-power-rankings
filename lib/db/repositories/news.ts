/**
 * News Database Repository
 * Handles all database operations for news articles
 * Now queries the articles table which contains the actual data
 */

import { and, desc, eq, getTableColumns, gte, lte, type SQL, sql } from "drizzle-orm";
import { getDb } from "../connection";
import { articles, type Article } from "../article-schema";
import { type NewsEventType, newsEventTypeSql } from "../news-event-type";

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

/** A news article plus the classification the database computed for it. */
export interface ClassifiedNewsArticle extends NewsArticle {
  eventType: NewsEventType;
}

/** The filters `/api/news` accepts, every one of which is applied in SQL. */
export interface NewsFilters {
  /**
   * Compared against the derived `event_type`; omitted or null means every
   * type. An unrecognised value matches nothing, which is what the old
   * in-memory `item.event_type === filter` did with one.
   */
  eventType?: string | null;
}

export interface PaginatedNewsOptions extends NewsFilters {
  limit?: number;
  offset?: number;
}

export class NewsRepository {
  /**
   * Map article from articles table to news format
   */
  private mapArticleToNews(article: Article): NewsArticle {
    return {
      id: article.id,
      slug: article.slug,
      title: article.title,
      summary: article.summary,
      content: article.content,
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
   * The WHERE shared by `getPaginatedFiltered` and `countFiltered`.
   *
   * Why: A page and its total must be drawn from the same predicate, or `total`
   * describes a different set than `news` does (#140).
   * What: Always `status = 'active'`, plus the derived-`event_type` equality
   * when a classification was asked for.
   * Test: `lib/db/repositories/news.test.ts`.
   */
  private filterWhere(filters: NewsFilters): SQL | undefined {
    const conditions: SQL[] = [eq(articles.status, "active")];

    if (filters.eventType) {
      conditions.push(sql`${newsEventTypeSql()} = ${filters.eventType}`);
    }

    return and(...conditions);
  }

  /**
   * Count every active article matching `filters`.
   *
   * Why: `/api/news` reported `total` as the length of the rows it had already
   * fetched, which capped it at the size of the in-memory pool (#140).
   * What: `COUNT(*)` under the same predicate `getPaginatedFiltered` pages over.
   * Test: `lib/db/repositories/news.test.ts`.
   */
  async countFiltered(filters: NewsFilters = {}): Promise<number> {
    const db = getDb();
    if (!db) return 0;

    try {
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(articles)
        .where(this.filterWhere(filters));

      return Number(countResult[0]?.count || 0);
    } catch (error) {
      console.error("Error counting filtered news:", error);
      return 0;
    }
  }

  /**
   * One page of active articles, filtered, ordered, limited and offset in SQL.
   *
   * Why: `getPaginated(limit * 3, 0)` plus an in-memory `.slice(offset, ...)`
   * could not reach past the pool, so `?limit=100&offset=300` returned nothing
   * (#140). `event_type` was the reason the pool existed; it is a SQL
   * expression now, so nothing is left to filter after the fetch.
   * What: Adds `event_type` to the projection, applies `filters` in the WHERE,
   * and pairs the rows with a real `COUNT(*)`. `id` breaks `published_date`
   * ties so a row cannot repeat on one page and vanish from the next.
   * Test: `lib/db/repositories/news.test.ts`,
   * `tests/unit/news-route-pagination.test.ts`.
   */
  async getPaginatedFiltered(options: PaginatedNewsOptions = {}): Promise<{
    articles: ClassifiedNewsArticle[];
    total: number;
    hasMore: boolean;
  }> {
    const limit = options.limit ?? 20;
    const offset = options.offset ?? 0;
    const filters: NewsFilters = { eventType: options.eventType ?? null };

    const db = getDb();
    if (!db) {
      return { articles: [], total: 0, hasMore: false };
    }

    try {
      const results = await db
        .select({ ...getTableColumns(articles), eventType: newsEventTypeSql() })
        .from(articles)
        .where(this.filterWhere(filters))
        .orderBy(desc(articles.publishedDate), desc(articles.id))
        .limit(limit)
        .offset(offset);

      const total = await this.countFiltered(filters);

      return {
        articles: results.map((row) => ({
          ...this.mapArticleToNews(row),
          eventType: row.eventType,
        })),
        total,
        hasMore: offset + results.length < total,
      };
    } catch (error) {
      console.error("Error fetching filtered paginated news:", error);
      return { articles: [], total: 0, hasMore: false };
    }
  }

  /**
   * The `limit` newest active articles published within the last `days`.
   *
   * Why: `/api/news/recent` fetched the top 100 and filtered by `days` in
   * memory, so a window holding more than 100 articles was silently truncated
   * to whatever fell inside the first 100 (#140).
   * What: Puts the lower bound in the WHERE and the bound in the LIMIT, both
   * over `COALESCE(published_date, created_at)` — the same fallback the route
   * ordered by when it did this in JavaScript.
   * Test: `lib/db/repositories/news.test.ts`.
   */
  async getRecentWithin(options: { days: number; limit: number }) {
    const { days, limit } = options;

    const db = getDb();
    if (!db) return [];

    const effectiveDate = sql`coalesce(${articles.publishedDate}, ${articles.createdAt})`;

    try {
      const results = await db
        .select()
        .from(articles)
        .where(
          and(
            eq(articles.status, "active"),
            sql`${effectiveDate} >= now() - make_interval(days => ${days}::int)`
          )
        )
        .orderBy(sql`${effectiveDate} desc`, desc(articles.id))
        .limit(limit);

      return results.map((article) => this.mapArticleToNews(article));
    } catch (error) {
      console.error("Error fetching recent news within window:", error);
      return [];
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
