/**
 * Tools Repository
 * Handles data access for AI tools (JSON or PostgreSQL)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { asc, desc, eq, sql } from "drizzle-orm";
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
  [key: string]: unknown; // Additional fields from JSON
}

export class ToolsRepository extends BaseRepository<ToolData> {
  private jsonPath = path.join(process.cwd(), "data", "json", "tools", "tools.json");
  private jsonCache: { tools: ToolData[] } | null = null;
  private lastCacheTime = 0;
  private CACHE_TTL = 5000; // 5 seconds cache

  /**
   * Get all tools
   */
  async findAll(options?: QueryOptions): Promise<ToolData[]> {
    if (this.useDatabase) {
      return this.findAllFromDb(options);
    }
    return this.findAllFromJson(options);
  }

  /**
   * Find tool by ID
   */
  async findById(id: string): Promise<ToolData | null> {
    if (this.useDatabase) {
      return this.findByIdFromDb(id);
    }
    return this.findByIdFromJson(id);
  }

  /**
   * Find tool by slug
   */
  override async findBySlug(slug: string): Promise<ToolData | null> {
    if (this.useDatabase) {
      return this.findBySlugFromDb(slug);
    }
    return this.findBySlugFromJson(slug);
  }

  /**
   * Create new tool
   */
  async create(data: Partial<ToolData>): Promise<ToolData> {
    if (this.useDatabase) {
      return this.createInDb(data);
    }
    return this.createInJson(data);
  }

  /**
   * Update tool
   */
  async update(id: string, data: Partial<ToolData>): Promise<ToolData | null> {
    if (this.useDatabase) {
      return this.updateInDb(id, data);
    }
    return this.updateInJson(id, data);
  }

  /**
   * Delete tool
   */
  async delete(id: string): Promise<boolean> {
    if (this.useDatabase) {
      return this.deleteFromDb(id);
    }
    return this.deleteFromJson(id);
  }

  /**
   * Count tools
   */
  async count(): Promise<number> {
    if (this.useDatabase) {
      return this.countInDb();
    }
    return this.countInJson();
  }

  /**
   * Find tools by category
   */
  async findByCategory(category: string): Promise<ToolData[]> {
    if (this.useDatabase) {
      const db = getDb();
      if (!db) throw new Error("Database not connected");

      const results = await db
        .select()
        .from(tools)
        .where(eq(tools.category, category))
        .orderBy(desc(tools.createdAt));

      return this.mapDbToolsToData(results);
    }

    const allTools = await this.findAllFromJson();
    return allTools.filter((tool) => tool.category === category);
  }

  /**
   * Search tools
   */
  async search(query: string): Promise<ToolData[]> {
    if (this.useDatabase) {
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

    const allTools = await this.findAllFromJson();
    const lowerQuery = query.toLowerCase();
    return allTools.filter(
      (tool) => {
        const hasNameMatch = tool.name.toLowerCase().includes(lowerQuery);
        // Use bracket notation for index signature access
        const description = tool["description"] as string | undefined;
        const hasDescriptionMatch = description?.toLowerCase().includes(lowerQuery) || false;
        return hasNameMatch || hasDescriptionMatch;
      }
    );
  }

  // ============= Database Methods =============

  private async findAllFromDb(options?: QueryOptions): Promise<ToolData[]> {
    const db = getDb();
    if (!db) throw new Error("Database not connected");

    // Build the query with proper typing
    const baseQuery = db.select().from(tools);
    let results: Tool[];

    // Apply ordering and pagination based on options
    if (options?.orderBy) {
      // Type-safe column access - use proper column reference
      let orderedQuery;
      if (options.orderBy === 'name') {
        orderedQuery = options.orderDirection === "desc"
          ? baseQuery.orderBy(desc(tools.name))
          : baseQuery.orderBy(asc(tools.name));
      } else if (options.orderBy === 'slug') {
        orderedQuery = options.orderDirection === "desc"
          ? baseQuery.orderBy(desc(tools.slug))
          : baseQuery.orderBy(asc(tools.slug));
      } else if (options.orderBy === 'category') {
        orderedQuery = options.orderDirection === "desc"
          ? baseQuery.orderBy(desc(tools.category))
          : baseQuery.orderBy(asc(tools.category));
      } else if (options.orderBy === 'status') {
        orderedQuery = options.orderDirection === "desc"
          ? baseQuery.orderBy(desc(tools.status))
          : baseQuery.orderBy(asc(tools.status));
      } else if (options.orderBy === 'createdAt') {
        orderedQuery = options.orderDirection === "desc"
          ? baseQuery.orderBy(desc(tools.createdAt))
          : baseQuery.orderBy(asc(tools.createdAt));
      } else if (options.orderBy === 'updatedAt') {
        orderedQuery = options.orderDirection === "desc"
          ? baseQuery.orderBy(desc(tools.updatedAt))
          : baseQuery.orderBy(asc(tools.updatedAt));
      } else {
        // Default to createdAt if unknown column
        orderedQuery = options.orderDirection === "desc"
          ? baseQuery.orderBy(desc(tools.createdAt))
          : baseQuery.orderBy(asc(tools.createdAt));
      }
      
      // Apply pagination if needed
      if (options?.limit && options?.offset) {
        results = await orderedQuery.limit(options.limit).offset(options.offset);
      } else if (options?.limit) {
        results = await orderedQuery.limit(options.limit);
      } else if (options?.offset) {
        results = await orderedQuery.offset(options.offset);
      } else {
        results = await orderedQuery;
      }
    } else {
      const orderedQuery = baseQuery.orderBy(desc(tools.createdAt));
      
      // Apply pagination if needed
      if (options?.limit && options?.offset) {
        results = await orderedQuery.limit(options.limit).offset(options.offset);
      } else if (options?.limit) {
        results = await orderedQuery.limit(options.limit);
      } else if (options?.offset) {
        results = await orderedQuery.offset(options.offset);
      } else {
        results = await orderedQuery;
      }
    }

    return this.mapDbToolsToData(results);
  }

  private async findByIdFromDb(id: string): Promise<ToolData | null> {
    const db = getDb();
    if (!db) throw new Error("Database not connected");

    const results = await db.select().from(tools).where(sql`${tools.data}->>'id' = ${id}`).limit(1);

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

  // ============= JSON Methods =============

  private loadJsonData(): { tools: ToolData[] } {
    const now = Date.now();
    if (this.jsonCache && now - this.lastCacheTime < this.CACHE_TTL) {
      return this.jsonCache;
    }

    try {
      const content = fs.readFileSync(this.jsonPath, "utf-8");
      this.jsonCache = JSON.parse(content);
      this.lastCacheTime = now;
      return this.jsonCache!;
    } catch (error) {
      console.error("Error loading tools JSON:", error);
      return { tools: [] };
    }
  }

  private saveJsonData(data: { tools: ToolData[] }): void {
    try {
      fs.writeFileSync(this.jsonPath, JSON.stringify(data, null, 2));
      this.jsonCache = data;
      this.lastCacheTime = Date.now();
    } catch (error) {
      console.error("Error saving tools JSON:", error);
      throw error;
    }
  }

  private async findAllFromJson(options?: QueryOptions): Promise<ToolData[]> {
    const data = this.loadJsonData();
    let tools = data.tools || [];

    // Apply ordering
    if (options?.orderBy) {
      tools.sort((a, b) => {
        const aVal = a[options.orderBy!];
        const bVal = b[options.orderBy!];
        // Type-safe comparison
        let comparison = 0;
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          comparison = aVal.localeCompare(bVal);
        } else if (typeof aVal === 'number' && typeof bVal === 'number') {
          comparison = aVal - bVal;
        } else if (aVal instanceof Date && bVal instanceof Date) {
          comparison = aVal.getTime() - bVal.getTime();
        } else {
          // Fallback to string comparison
          comparison = String(aVal).localeCompare(String(bVal));
        }
        return options.orderDirection === "desc" ? -comparison : comparison;
      });
    }

    // Apply pagination
    if (options?.offset) {
      tools = tools.slice(options.offset);
    }
    if (options?.limit) {
      tools = tools.slice(0, options.limit);
    }

    return tools;
  }

  private async findByIdFromJson(id: string): Promise<ToolData | null> {
    const data = this.loadJsonData();
    return data.tools.find((tool) => tool.id === id) || null;
  }

  private async findBySlugFromJson(slug: string): Promise<ToolData | null> {
    const data = this.loadJsonData();
    return data.tools.find((tool) => tool.slug === slug) || null;
  }

  private async createInJson(toolData: Partial<ToolData>): Promise<ToolData> {
    const data = this.loadJsonData();
    
    // Ensure required fields are present
    if (!toolData.slug || !toolData.name) {
      throw new Error("slug and name are required");
    }
    
    const newTool: ToolData = {
      id: toolData.id || String(Date.now()),
      slug: toolData.slug,
      name: toolData.name,
      category: toolData.category || "uncategorized",
      status: toolData.status || "active",
      company_id: toolData.company_id,
      ...toolData,
    };

    data.tools.push(newTool);
    this.saveJsonData(data);
    return newTool;
  }

  private async updateInJson(id: string, updateData: Partial<ToolData>): Promise<ToolData | null> {
    const data = this.loadJsonData();
    const index = data.tools.findIndex((tool) => tool.id === id);

    if (index === -1) return null;

    const existingTool = data.tools[index];
    if (!existingTool) return null;
    
    // Ensure all required fields are present
    const updatedTool: ToolData = { 
      ...existingTool,
      ...updateData 
    };
    data.tools[index] = updatedTool;
    this.saveJsonData(data);
    return updatedTool;
  }

  private async deleteFromJson(id: string): Promise<boolean> {
    const data = this.loadJsonData();
    const initialLength = data.tools.length;
    data.tools = data.tools.filter((tool) => tool.id !== id);

    if (data.tools.length < initialLength) {
      this.saveJsonData(data);
      return true;
    }
    return false;
  }

  private async countInJson(): Promise<number> {
    const data = this.loadJsonData();
    return data.tools.length;
  }

  // ============= Helper Methods =============

  private mapDbToolToData(dbTool: Tool): ToolData {
    const toolData = dbTool.data as Record<string, unknown>;
    return {
      id: (toolData["id"] as string) || dbTool.id,
      slug: dbTool.slug,
      name: dbTool.name,
      category: dbTool.category,
      status: dbTool.status,
      company_id: dbTool.companyId || undefined,
      ...toolData,
    };
  }

  private mapDbToolsToData(dbTools: Tool[]): ToolData[] {
    return dbTools.map((tool) => this.mapDbToolToData(tool));
  }
}

// Export singleton instance
export const toolsRepository = new ToolsRepository();
