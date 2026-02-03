/**
 * Articles Query Repository
 * Handles search and filter operations for articles
 */

import { and, desc, eq, sql as sqlTag } from "drizzle-orm";
import {
  type Article,
  articles,
} from "@/lib/db/article-schema";
import { getDb } from "@/lib/db/connection";

type DbInstance = ReturnType<typeof getDb>;

export class ArticlesQueryRepository {
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
   * Get articles that mention a specific tool by name
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
   * Get articles that mention a specific company by name
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
   * Find articles that mention a specific tool by ID
   */
  async findByToolMention(toolId: string): Promise<Article[]> {
    this.ensureConnection();
    if (!this.db) throw new Error("Database not connected");

    const result = await this.db
      .select()
      .from(articles)
      .where(sqlTag`${articles.toolMentions}::jsonb @> ${JSON.stringify([toolId])}::jsonb`)
      .orderBy(desc(articles.publishedDate));

    return result || [];
  }
}
