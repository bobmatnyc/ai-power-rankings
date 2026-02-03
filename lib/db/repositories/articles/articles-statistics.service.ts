/**
 * Articles Statistics Service
 * Handles statistics and impact analysis for articles
 */

import { desc, eq, sql as sqlTag } from "drizzle-orm";
import {
  type Article,
  type ArticleRankingsChange,
  type ArticleWithImpact,
  articleRankingsChanges,
  articles,
} from "@/lib/db/article-schema";
import { getDb } from "@/lib/db/connection";

type DbInstance = ReturnType<typeof getDb>;

export class ArticlesStatisticsService {
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
   * Get article by ID (internal helper)
   */
  private async getArticleById(id: string): Promise<Article | null> {
    if (!this.db) return null;
    const result = await this.db.select().from(articles).where(eq(articles.id, id)).limit(1);
    return result?.[0] || null;
  }

  /**
   * Get ranking changes for an article (internal helper)
   */
  private async getArticleRankingChanges(articleId: string): Promise<ArticleRankingsChange[]> {
    const result = await this.db
      ?.select()
      .from(articleRankingsChanges)
      .where(eq(articleRankingsChanges.articleId, articleId))
      .orderBy(desc(articleRankingsChanges.createdAt));
    return result || [];
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

    if (!this.db) {
      throw new Error("Database connection not available after ensureConnection()");
    }

    // Get basic counts
    const stats = await this.db
      .select({
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
}
