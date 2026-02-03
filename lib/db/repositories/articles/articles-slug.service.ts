/**
 * Articles Slug Service
 * Handles slug generation and uniqueness checking for articles
 */

import { eq, sql as sqlTag } from "drizzle-orm";
import { articles } from "@/lib/db/article-schema";
import { getDb } from "@/lib/db/connection";

type DbInstance = ReturnType<typeof getDb>;

export class ArticlesSlugService {
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
