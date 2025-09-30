/**
 * Companies Repository
 * Handles data access for companies (JSON or PostgreSQL)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { asc, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../connection";
import { type Company, companies, type NewCompany } from "../schema";
import { BaseRepository, type QueryOptions } from "./base.repository";

interface CompanyData {
  id: string;
  slug: string;
  name: string;
  website?: string;
  founded?: string;
  size?: string;
  headquarters?: string;
  description?: string | Array<{ children?: Array<{ text: string }> }>;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown; // Additional fields from JSON
}

export class CompaniesRepository extends BaseRepository<CompanyData> {
  private jsonPath = path.join(process.cwd(), "data", "json", "companies", "companies.json");
  private jsonCache: { companies: CompanyData[] } | null = null;
  private lastCacheTime = 0;
  private CACHE_TTL = 5000; // 5 seconds cache

  /**
   * Get all companies
   */
  async findAll(options?: QueryOptions): Promise<CompanyData[]> {
    if (this.useDatabase) {
      return this.findAllFromDb(options);
    }
    return this.findAllFromJson(options);
  }

  /**
   * Find company by ID
   */
  async findById(id: string): Promise<CompanyData | null> {
    if (this.useDatabase) {
      return this.findByIdFromDb(id);
    }
    return this.findByIdFromJson(id);
  }

  /**
   * Find company by slug
   */
  override async findBySlug(slug: string): Promise<CompanyData | null> {
    if (this.useDatabase) {
      return this.findBySlugFromDb(slug);
    }
    return this.findBySlugFromJson(slug);
  }

  /**
   * Find multiple companies by IDs (batch loading)
   */
  async findByIds(ids: string[]): Promise<CompanyData[]> {
    if (this.useDatabase) {
      return this.findByIdsFromDb(ids);
    }
    return this.findByIdsFromJson(ids);
  }

  /**
   * Create new company
   */
  async create(data: Partial<CompanyData>): Promise<CompanyData> {
    if (this.useDatabase) {
      return this.createInDb(data);
    }
    return this.createInJson(data);
  }

  /**
   * Update company
   */
  async update(id: string, data: Partial<CompanyData>): Promise<CompanyData | null> {
    if (this.useDatabase) {
      return this.updateInDb(id, data);
    }
    return this.updateInJson(id, data);
  }

  /**
   * Delete company
   */
  async delete(id: string): Promise<boolean> {
    if (this.useDatabase) {
      return this.deleteFromDb(id);
    }
    return this.deleteFromJson(id);
  }

  /**
   * Count companies
   */
  async count(): Promise<number> {
    if (this.useDatabase) {
      return this.countInDb();
    }
    return this.countInJson();
  }

  /**
   * Search companies
   */
  async search(query: string): Promise<CompanyData[]> {
    if (this.useDatabase) {
      const db = getDb();
      if (!db) throw new Error("Database not connected");

      const results = await db
        .select()
        .from(companies)
        .where(
          sql`${companies.name} ILIKE ${`%${query}%`} OR
              ${companies.data}->>'description' ILIKE ${`%${query}%`} OR
              ${companies.data}->>'headquarters' ILIKE ${`%${query}%`}`
        )
        .orderBy(asc(companies.name));

      return this.mapDbCompaniesToData(results);
    }

    const allCompanies = await this.findAllFromJson();
    const lowerQuery = query.toLowerCase();
    return allCompanies.filter((company) => {
      // Check name
      if (company.name.toLowerCase().includes(lowerQuery)) {
        return true;
      }

      // Check description (handle both string and rich text array)
      if (company.description) {
        let descriptionText = "";
        if (typeof company.description === "string") {
          descriptionText = company.description;
        } else if (Array.isArray(company.description)) {
          // Extract text from rich text format
          descriptionText = company.description
            .map((block: { children?: Array<{ text: string }> }) =>
              block.children?.map((child) => child.text).join("")
            )
            .join(" ");
        }
        if (descriptionText.toLowerCase().includes(lowerQuery)) {
          return true;
        }
      }

      // Check headquarters
      if (company.headquarters?.toLowerCase().includes(lowerQuery)) {
        return true;
      }

      return false;
    });
  }

  /**
   * Get companies by size
   */
  async findBySize(size: string): Promise<CompanyData[]> {
    if (this.useDatabase) {
      const db = getDb();
      if (!db) throw new Error("Database not connected");

      const results = await db
        .select()
        .from(companies)
        .where(sql`${companies.data}->>'size' = ${size}`)
        .orderBy(asc(companies.name));

      return this.mapDbCompaniesToData(results);
    }

    const allCompanies = await this.findAllFromJson();
    return allCompanies.filter((company) => company.size === size);
  }

  // ============= Database Methods =============

  private async findAllFromDb(options?: QueryOptions): Promise<CompanyData[]> {
    const db = getDb();
    if (!db) throw new Error("Database not connected");

    // Build the query with proper typing
    let baseQuery = db.select().from(companies);
    let results: Company[];

    // Apply ordering and pagination based on options
    if (options?.orderBy) {
      // Type-safe column access - use proper column reference
      if (options.orderBy === "name") {
        baseQuery =
          options.orderDirection === "desc"
            ? (baseQuery.orderBy(desc(companies.name)) as typeof baseQuery)
            : (baseQuery.orderBy(asc(companies.name)) as typeof baseQuery);
      } else if (options.orderBy === "slug") {
        baseQuery =
          options.orderDirection === "desc"
            ? (baseQuery.orderBy(desc(companies.slug)) as typeof baseQuery)
            : (baseQuery.orderBy(asc(companies.slug)) as typeof baseQuery);
      } else if (options.orderBy === "createdAt") {
        baseQuery =
          options.orderDirection === "desc"
            ? (baseQuery.orderBy(desc(companies.createdAt)) as typeof baseQuery)
            : (baseQuery.orderBy(asc(companies.createdAt)) as typeof baseQuery);
      } else if (options.orderBy === "updatedAt") {
        baseQuery =
          options.orderDirection === "desc"
            ? (baseQuery.orderBy(desc(companies.updatedAt)) as typeof baseQuery)
            : (baseQuery.orderBy(asc(companies.updatedAt)) as typeof baseQuery);
      } else {
        // Default to name if unknown column
        baseQuery =
          options.orderDirection === "desc"
            ? (baseQuery.orderBy(desc(companies.name)) as typeof baseQuery)
            : (baseQuery.orderBy(asc(companies.name)) as typeof baseQuery);
      }
    }

    // Apply default ordering if no orderBy was specified
    if (!options?.orderBy) {
      baseQuery = baseQuery.orderBy(asc(companies.name)) as typeof baseQuery;
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

    return this.mapDbCompaniesToData(results);
  }

  private async findByIdFromDb(id: string): Promise<CompanyData | null> {
    const db = getDb();
    if (!db) throw new Error("Database not connected");

    const results = await db
      .select()
      .from(companies)
      .where(sql`${companies.data}->>'id' = ${id}`)
      .limit(1);

    const firstResult = results[0];
    return firstResult ? this.mapDbCompanyToData(firstResult) : null;
  }

  private async findBySlugFromDb(slug: string): Promise<CompanyData | null> {
    const db = getDb();
    if (!db) throw new Error("Database not connected");

    const results = await db.select().from(companies).where(eq(companies.slug, slug)).limit(1);

    const firstResult = results[0];
    return firstResult ? this.mapDbCompanyToData(firstResult) : null;
  }

  private async findByIdsFromDb(ids: string[]): Promise<CompanyData[]> {
    const db = getDb();
    if (!db) throw new Error("Database not connected");

    if (ids.length === 0) return [];

    // Use IN clause for batch loading - PostgreSQL array syntax
    const results = await db
      .select()
      .from(companies)
      .where(sql`${companies.data}->>'id' = ANY(ARRAY[${sql.raw(ids.map(id => `'${id}'`).join(','))}])`);

    return this.mapDbCompaniesToData(results);
  }

  private async createInDb(data: Partial<CompanyData>): Promise<CompanyData> {
    const db = getDb();
    if (!db) throw new Error("Database not connected");

    const { slug, name, ...rest } = data;

    // Validate required fields
    if (!slug || !name) {
      throw new Error("Company slug and name are required for creation");
    }

    const newCompany: NewCompany = {
      slug: slug,
      name: name,
      data: { id: data.id, ...rest },
    };

    const results = await db.insert(companies).values(newCompany).returning();
    const firstResult = results[0];
    if (!firstResult) throw new Error("Failed to create company");
    return this.mapDbCompanyToData(firstResult);
  }

  private async updateInDb(id: string, data: Partial<CompanyData>): Promise<CompanyData | null> {
    const db = getDb();
    if (!db) throw new Error("Database not connected");

    const existing = await this.findByIdFromDb(id);
    if (!existing) return null;

    const { slug, name, ...rest } = data;

    const updateData: Partial<Company> = {
      ...(slug && { slug }),
      ...(name && { name }),
      data: { ...existing, ...rest },
      updatedAt: new Date(),
    };

    const results = await db
      .update(companies)
      .set(updateData)
      .where(sql`${companies.data}->>'id' = ${id}`)
      .returning();

    const firstResult = results[0];
    return firstResult ? this.mapDbCompanyToData(firstResult) : null;
  }

  private async deleteFromDb(id: string): Promise<boolean> {
    const db = getDb();
    if (!db) throw new Error("Database not connected");

    await db.delete(companies).where(sql`${companies.data}->>'id' = ${id}`);

    return true; // Drizzle doesn't return affected rows for Neon
  }

  private async countInDb(): Promise<number> {
    const db = getDb();
    if (!db) throw new Error("Database not connected");

    const result = await db.select({ count: sql<number>`count(*)::int` }).from(companies);

    const firstResult = result[0];
    return firstResult ? firstResult.count : 0;
  }

  // ============= JSON Methods =============

  private loadJsonData(): { companies: CompanyData[] } {
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
      console.error("Error loading companies JSON:", error);
      return { companies: [] };
    }
  }

  private saveJsonData(data: { companies: CompanyData[] }): void {
    try {
      fs.writeFileSync(this.jsonPath, JSON.stringify(data, null, 2));
      this.jsonCache = data;
      this.lastCacheTime = Date.now();
    } catch (error) {
      console.error("Error saving companies JSON:", error);
      throw error;
    }
  }

  private async findAllFromJson(options?: QueryOptions): Promise<CompanyData[]> {
    const data = this.loadJsonData();
    let companies = data.companies || [];

    // Apply ordering
    if (options?.orderBy) {
      companies.sort((a, b) => {
        const aVal = a[options.orderBy!];
        const bVal = b[options.orderBy!];
        // Type-safe comparison
        let comparison = 0;
        if (typeof aVal === "string" && typeof bVal === "string") {
          comparison = aVal.localeCompare(bVal);
        } else if (typeof aVal === "number" && typeof bVal === "number") {
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
      companies = companies.slice(options.offset);
    }
    if (options?.limit) {
      companies = companies.slice(0, options.limit);
    }

    return companies;
  }

  private async findByIdFromJson(id: string): Promise<CompanyData | null> {
    const data = this.loadJsonData();
    return data.companies.find((company) => company.id === id) || null;
  }

  private async findBySlugFromJson(slug: string): Promise<CompanyData | null> {
    const data = this.loadJsonData();
    return data.companies.find((company) => company.slug === slug) || null;
  }

  private async findByIdsFromJson(ids: string[]): Promise<CompanyData[]> {
    if (ids.length === 0) return [];
    const data = this.loadJsonData();
    return data.companies.filter((company) => ids.includes(company.id));
  }

  private async createInJson(companyData: Partial<CompanyData>): Promise<CompanyData> {
    const data = this.loadJsonData();

    // Ensure required fields are present
    if (!companyData.slug || !companyData.name) {
      throw new Error("slug and name are required");
    }

    const newCompany: CompanyData = {
      id: companyData.id || String(Date.now()),
      slug: companyData.slug,
      name: companyData.name,
      created_at: companyData.created_at || new Date().toISOString(),
      updated_at: companyData.updated_at || new Date().toISOString(),
      ...companyData,
    };

    data.companies.push(newCompany);
    this.saveJsonData(data);
    return newCompany;
  }

  private async updateInJson(
    id: string,
    updateData: Partial<CompanyData>
  ): Promise<CompanyData | null> {
    const data = this.loadJsonData();
    const index = data.companies.findIndex((company) => company.id === id);

    if (index === -1) return null;

    const existingCompany = data.companies[index];
    if (!existingCompany) return null;

    // Ensure all required fields are present
    const updatedCompany: CompanyData = {
      ...existingCompany,
      ...updateData,
      updated_at: new Date().toISOString(),
    };
    data.companies[index] = updatedCompany;
    this.saveJsonData(data);
    return updatedCompany;
  }

  private async deleteFromJson(id: string): Promise<boolean> {
    const data = this.loadJsonData();
    const initialLength = data.companies.length;
    data.companies = data.companies.filter((company) => company.id !== id);

    if (data.companies.length < initialLength) {
      this.saveJsonData(data);
      return true;
    }
    return false;
  }

  private async countInJson(): Promise<number> {
    const data = this.loadJsonData();
    return data.companies.length;
  }

  // ============= Helper Methods =============

  private mapDbCompanyToData(dbCompany: Company): CompanyData {
    // Ensure data exists and spread it properly
    const companyData = (dbCompany.data as Record<string, unknown>) || {};

    return {
      // Use the id from the database record if not in data
      id: (companyData["id"] as string) || dbCompany.id,
      slug: dbCompany.slug,
      name: dbCompany.name,
      // Spread the additional data fields
      ...companyData,
      // Ensure dates are always present
      created_at: dbCompany.createdAt.toISOString(),
      updated_at: dbCompany.updatedAt.toISOString(),
    };
  }

  private mapDbCompaniesToData(dbCompanies: Company[]): CompanyData[] {
    return dbCompanies.map((company) => this.mapDbCompanyToData(company));
  }
}

// Export singleton instance
export const companiesRepository = new CompaniesRepository();
