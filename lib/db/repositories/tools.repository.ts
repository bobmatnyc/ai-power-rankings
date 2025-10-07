/**
 * Tools Repository
 * Handles data access for AI tools from PostgreSQL database
 */

import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../connection";
import { type NewTool, type Tool, tools } from "../schema";
import { BaseRepository, type QueryOptions } from "./base.repository";

interface ToolData {
  id: string;
  slug: string;
  name: string;
  category: string;
  status: string;
  company_id?: string;
  info?: Record<string, unknown>;
  tags?: string[];
  created_at?: string;
  updated_at?: string;
  baseline_score?: Record<string, number>;
  delta_score?: Record<string, number>;
  current_score?: Record<string, number>;
  score_updated_at?: string;
  [key: string]: unknown; // Additional fields preserved from original data structure
}

export class ToolsRepository extends BaseRepository<ToolData> {
  constructor() {
    super();
  }

  /**
   * Get all tools
   */
  async findAll(options?: QueryOptions): Promise<ToolData[]> {
    return this.findAllFromDb(options);
  }

  /**
   * Find tool by ID
   */
  async findById(id: string): Promise<ToolData | null> {
    return this.findByIdFromDb(id);
  }

  /**
   * Find tool by slug
   */
  override async findBySlug(slug: string): Promise<ToolData | null> {
    return this.findBySlugFromDb(slug);
  }

  /**
   * Find multiple tools by IDs efficiently (single query)
   * Used to avoid N+1 query problems
   */
  async findByIds(ids: string[]): Promise<ToolData[]> {
    if (ids.length === 0) return [];

    const db = getDb();
    if (!db) throw new Error("Database connection not available");

    try {
      // Try to find by database UUID first
      const results = await db.select().from(tools).where(inArray(tools.id, ids));

      // For any IDs not found by UUID, try finding by data.id
      const foundIds = new Set(results.map((r) => r.id));
      const missingIds = ids.filter((id) => !foundIds.has(id));

      if (missingIds.length > 0) {
        // Use OR conditions for legacy data.id lookups
        const legacyResults = await db
          .select()
          .from(tools)
          .where(
            sql`${tools.data}->>'id' IN (${sql.raw(missingIds.map((id) => `'${id}'`).join(","))})`
          );
        results.push(...legacyResults);
      }

      return this.mapDbToolsToData(results);
    } catch (error) {
      console.error("Error in findByIds:", error);
      throw error;
    }
  }

  /**
   * Create new tool
   */
  async create(data: Partial<ToolData>): Promise<ToolData> {
    return this.createInDb(data);
  }

  /**
   * Update tool
   */
  async update(id: string, data: Partial<ToolData>): Promise<ToolData | null> {
    return this.updateInDb(id, data);
  }

  /**
   * Delete tool
   */
  async delete(id: string): Promise<boolean> {
    return this.deleteFromDb(id);
  }

  /**
   * Delete tool by ID (alias for delete)
   */
  async deleteById(id: string): Promise<boolean> {
    return this.delete(id);
  }

  /**
   * Get tool by ID (alias for findById)
   */
  async getById(id: string): Promise<ToolData | null> {
    return this.findById(id);
  }

  /**
   * Count tools
   */
  async count(): Promise<number> {
    return this.countInDb();
  }

  /**
   * Find tools by status
   */
  async findByStatus(status: string): Promise<ToolData[]> {
    const db = getDb();
    if (!db) throw new Error("Database not connected");

    const result = await db
      .select()
      .from(tools)
      .where(eq(tools.status, status))
      .orderBy(desc(tools.createdAt));

    return this.mapDbToolsToData(result);
  }

  /**
   * Find tools by category
   */
  async findByCategory(category: string): Promise<ToolData[]> {
    const db = getDb();
    if (!db) throw new Error("Database not connected");

    const results = await db
      .select()
      .from(tools)
      .where(eq(tools.category, category))
      .orderBy(desc(tools.createdAt));

    return this.mapDbToolsToData(results);
  }

  /**
   * Search tools
   */
  async search(query: string): Promise<ToolData[]> {
    const db = getDb();
    if (!db) throw new Error("Database not connected");

    const results = await db
      .select()
      .from(tools)
      .where(
        sql`${tools.name} ILIKE ${`%${query}%`} OR
            ${tools.data}->>'description' ILIKE ${`%${query}%`}`
      )
      .orderBy(desc(tools.createdAt));

    return this.mapDbToolsToData(results);
  }

  /**
   * Get tool with scoring data
   */
  async findByIdWithScores(id: string): Promise<ToolData | null> {
    const db = getDb();
    if (!db) throw new Error("Database not connected");

    const results = await db
      .select()
      .from(tools)
      .where(sql`${tools.data}->>'id' = ${id}`)
      .limit(1);

    const firstResult = results[0];
    return firstResult ? this.mapDbToolToDataWithScores(firstResult) : null;
  }

  /**
   * Update tool scoring data
   */
  async updateScoring(
    id: string,
    scoringData: {
      baseline_score?: Record<string, number>;
      delta_score?: Record<string, number>;
      current_score?: Record<string, number>;
    }
  ): Promise<ToolData | null> {
    const db = getDb();
    if (!db) throw new Error("Database not connected");

    const updateData: Partial<Tool> = {
      baselineScore: scoringData.baseline_score,
      deltaScore: scoringData.delta_score,
      currentScore: scoringData.current_score,
      scoreUpdatedAt: new Date(),
      updatedAt: new Date(),
    };

    const results = await db
      .update(tools)
      .set(updateData)
      .where(sql`${tools.data}->>'id' = ${id}`)
      .returning();

    const firstResult = results[0];
    return firstResult ? this.mapDbToolToDataWithScores(firstResult) : null;
  }

  // ============= Database Methods =============

  private async findAllFromDb(options?: QueryOptions): Promise<ToolData[]> {
    const db = getDb();
    if (!db) throw new Error("Database not connected");

    // Build the query with proper typing
    let baseQuery = db.select().from(tools);
    let results: Tool[];

    // Apply ordering and pagination based on options
    if (options?.orderBy) {
      // Type-safe column access - use proper column reference
      if (options.orderBy === "name") {
        baseQuery =
          options.orderDirection === "desc"
            ? (baseQuery.orderBy(desc(tools.name)) as typeof baseQuery)
            : (baseQuery.orderBy(asc(tools.name)) as typeof baseQuery);
      } else if (options.orderBy === "slug") {
        baseQuery =
          options.orderDirection === "desc"
            ? (baseQuery.orderBy(desc(tools.slug)) as typeof baseQuery)
            : (baseQuery.orderBy(asc(tools.slug)) as typeof baseQuery);
      } else if (options.orderBy === "category") {
        baseQuery =
          options.orderDirection === "desc"
            ? (baseQuery.orderBy(desc(tools.category)) as typeof baseQuery)
            : (baseQuery.orderBy(asc(tools.category)) as typeof baseQuery);
      } else if (options.orderBy === "status") {
        baseQuery =
          options.orderDirection === "desc"
            ? (baseQuery.orderBy(desc(tools.status)) as typeof baseQuery)
            : (baseQuery.orderBy(asc(tools.status)) as typeof baseQuery);
      } else if (options.orderBy === "createdAt") {
        baseQuery =
          options.orderDirection === "desc"
            ? (baseQuery.orderBy(desc(tools.createdAt)) as typeof baseQuery)
            : (baseQuery.orderBy(asc(tools.createdAt)) as typeof baseQuery);
      } else if (options.orderBy === "updatedAt") {
        baseQuery =
          options.orderDirection === "desc"
            ? (baseQuery.orderBy(desc(tools.updatedAt)) as typeof baseQuery)
            : (baseQuery.orderBy(asc(tools.updatedAt)) as typeof baseQuery);
      } else {
        // Default to createdAt if unknown column
        baseQuery =
          options.orderDirection === "desc"
            ? (baseQuery.orderBy(desc(tools.createdAt)) as typeof baseQuery)
            : (baseQuery.orderBy(asc(tools.createdAt)) as typeof baseQuery);
      }
    }

    // Apply default ordering if no orderBy was specified
    if (!options?.orderBy) {
      baseQuery = baseQuery.orderBy(desc(tools.createdAt)) as typeof baseQuery;
    }

    // Apply pagination if needed
    if (options?.limit && options?.offset) {
      results = await baseQuery.limit(options.limit).offset(options.offset);
    } else if (options?.limit) {
      results = await baseQuery.limit(options.limit);
    } else if (options?.offset) {
      results = await baseQuery.offset(options.offset);
    } else {
      results = await baseQuery;
    }

    return this.mapDbToolsToData(results);
  }

  private async findByIdFromDb(id: string): Promise<ToolData | null> {
    const db = getDb();
    if (!db) throw new Error("Database not connected");

    // Try to find by database UUID first
    let results = await db.select().from(tools).where(eq(tools.id, id)).limit(1);

    // Fallback to finding by data.id for legacy compatibility
    if (results.length === 0) {
      results = await db.select().from(tools).where(sql`${tools.data}->>'id' = ${id}`).limit(1);
    }

    const firstResult = results[0];
    return firstResult ? this.mapDbToolToData(firstResult) : null;
  }

  private async findBySlugFromDb(slug: string): Promise<ToolData | null> {
    const db = getDb();
    if (!db) throw new Error("Database not connected");

    const results = await db.select().from(tools).where(eq(tools.slug, slug)).limit(1);

    const firstResult = results[0];
    return firstResult ? this.mapDbToolToData(firstResult) : null;
  }

  private async createInDb(data: Partial<ToolData>): Promise<ToolData> {
    const db = getDb();
    if (!db) throw new Error("Database not connected");

    const { slug, name, category, status, company_id, ...rest } = data;

    // Validate required fields
    if (!slug || !name) {
      throw new Error("Tool slug and name are required for creation");
    }

    const newTool: NewTool = {
      slug: slug,
      name: name,
      category: category || "uncategorized",
      status: status || "active",
      companyId: company_id,
      data: { id: data.id, ...rest },
    };

    const results = await db.insert(tools).values(newTool).returning();
    const firstResult = results[0];
    if (!firstResult) throw new Error("Failed to create tool");
    return this.mapDbToolToData(firstResult);
  }

  private async updateInDb(id: string, data: Partial<ToolData>): Promise<ToolData | null> {
    const db = getDb();
    if (!db) throw new Error("Database not connected");

    const existing = await this.findByIdFromDb(id);
    if (!existing) return null;

    const { slug, name, category, status, company_id, ...rest } = data;

    const updateData: Partial<Tool> = {
      ...(slug && { slug }),
      ...(name && { name }),
      ...(category && { category }),
      ...(status && { status }),
      ...(company_id && { companyId: company_id }),
      data: { ...existing, ...rest },
      updatedAt: new Date(),
    };

    const results = await db
      .update(tools)
      .set(updateData)
      .where(sql`${tools.data}->>'id' = ${id}`)
      .returning();

    const firstResult = results[0];
    return firstResult ? this.mapDbToolToData(firstResult) : null;
  }

  private async deleteFromDb(id: string): Promise<boolean> {
    const db = getDb();
    if (!db) throw new Error("Database not connected");

    await db.delete(tools).where(sql`${tools.data}->>'id' = ${id}`);

    return true; // Drizzle doesn't return affected rows for Neon
  }

  private async countInDb(): Promise<number> {
    const db = getDb();
    if (!db) throw new Error("Database not connected");

    const result = await db.select({ count: sql<number>`count(*)::int` }).from(tools);

    const firstResult = result[0];
    return firstResult ? firstResult.count : 0;
  }

  // ============= Helper Methods =============

  private mapDbToolToData(dbTool: Tool): ToolData {
    const toolData = dbTool.data as Record<string, unknown>;

    // Extract specific fields from data JSONB
    const info = toolData["info"] as Record<string, unknown> | undefined;
    const tags = toolData["tags"] as string[] | undefined;

    return {
      id: (toolData["id"] as string) || dbTool.id.toString(),
      slug: dbTool.slug,
      name: dbTool.name,
      category: dbTool.category,
      status: dbTool.status,
      company_id: dbTool.companyId || undefined,
      info: info,
      tags: tags || [],
      created_at: dbTool.createdAt.toISOString(),
      updated_at: dbTool.updatedAt.toISOString(),
      ...toolData,
    };
  }

  private mapDbToolToDataWithScores(dbTool: Tool): ToolData {
    const baseData = this.mapDbToolToData(dbTool);

    // Add scoring data if available
    return {
      ...baseData,
      baseline_score: (dbTool.baselineScore as Record<string, number>) || {},
      delta_score: (dbTool.deltaScore as Record<string, number>) || {},
      current_score: (dbTool.currentScore as Record<string, number>) || {},
      score_updated_at: dbTool.scoreUpdatedAt?.toISOString(),
    };
  }

  private mapDbToolsToData(dbTools: Tool[]): ToolData[] {
    return dbTools.map((tool) => this.mapDbToolToData(tool));
  }
}

// Export singleton instance
export const toolsRepository = new ToolsRepository();
