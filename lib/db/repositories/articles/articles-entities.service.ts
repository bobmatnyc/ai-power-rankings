/**
 * Articles Entities Service
 * Handles auto-creation of tools and companies from article processing
 */

import { eq } from "drizzle-orm";
import { companies, tools } from "@/lib/db/schema";
import { getDb } from "@/lib/db/connection";

type DbInstance = ReturnType<typeof getDb>;

export interface AutoToolInput {
  name: string;
  slug: string;
  category: string;
  companyId?: string;
}

export interface AutoToolResult {
  id: string;
  name: string;
  slug: string;
  category: string;
}

export interface AutoCompanyInput {
  name: string;
  slug: string;
  website?: string;
}

export interface AutoCompanyResult {
  id: string;
  name: string;
  slug: string;
}

export class ArticlesEntitiesService {
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
   * Create a new tool (auto-created from article)
   */
  async createAutoTool(
    toolData: AutoToolInput,
    articleId: string
  ): Promise<AutoToolResult> {
    this.ensureConnection();
    if (!this.db) throw new Error("Database not connected");

    const result = await this.db
      .insert(tools)
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
    return result[0] as AutoToolResult;
  }

  /**
   * Create a new company (auto-created from article)
   */
  async createAutoCompany(
    companyData: AutoCompanyInput,
    articleId: string
  ): Promise<AutoCompanyResult> {
    this.ensureConnection();
    if (!this.db) throw new Error("Database not connected");

    try {
      // Ensure slug is valid and unique
      const validSlug = companyData.slug
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      // Check if company already exists
      const existing = await this.db
        .select()
        .from(companies)
        .where(eq(companies.slug, validSlug))
        .limit(1);

      if (existing && existing.length > 0) {
        console.log(`[ArticlesRepo] Company ${validSlug} already exists, returning existing`);
        return existing[0] as AutoCompanyResult;
      }

      const result = await this.db
        .insert(companies)
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
      return result[0] as AutoCompanyResult;
    } catch (error) {
      console.error("[ArticlesRepo] Error creating company:", error);
      throw new Error(
        `Failed to create company ${companyData.name}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
}
