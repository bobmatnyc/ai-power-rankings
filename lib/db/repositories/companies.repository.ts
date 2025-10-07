/**
 * Companies Repository
 * Handles data access for companies from PostgreSQL database
 */

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
  [key: string]: unknown; // Additional fields preserved from original data structure
}

export class CompaniesRepository extends BaseRepository<CompanyData> {

  /**
   * Get all companies
   */
  async findAll(options?: QueryOptions): Promise<CompanyData[]> {
    return this.findAllFromDb(options);
  }

  /**
   * Find company by ID
   */
  async findById(id: string): Promise<CompanyData | null> {
    return this.findByIdFromDb(id);
  }

  /**
   * Find company by slug
   */
  override async findBySlug(slug: string): Promise<CompanyData | null> {
    return this.findBySlugFromDb(slug);
  }

  /**
   * Find multiple companies by IDs (batch loading)
   */
  async findByIds(ids: string[]): Promise<CompanyData[]> {
    return this.findByIdsFromDb(ids);
  }

  /**
   * Create new company
   */
  async create(data: Partial<CompanyData>): Promise<CompanyData> {
    return this.createInDb(data);
  }

  /**
   * Update company
   */
  async update(id: string, data: Partial<CompanyData>): Promise<CompanyData | null> {
    return this.updateInDb(id, data);
  }

  /**
   * Delete company
   */
  async delete(id: string): Promise<boolean> {
    return this.deleteFromDb(id);
  }

  /**
   * Count companies
   */
  async count(): Promise<number> {
    return this.countInDb();
  }

  /**
   * Search companies
   */
  async search(query: string): Promise<CompanyData[]> {
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

  /**
   * Get companies by size
   */
  async findBySize(size: string): Promise<CompanyData[]> {
    const db = getDb();
    if (!db) throw new Error("Database not connected");

    const results = await db
      .select()
      .from(companies)
      .where(sql`${companies.data}->>'size' = ${size}`)
      .orderBy(asc(companies.name));

    return this.mapDbCompaniesToData(results);
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
