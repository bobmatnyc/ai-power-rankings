/**
 * Base Repository Pattern
 * Provides abstraction layer for data access (JSON or PostgreSQL)
 */

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: "asc" | "desc";
}

export interface Repository<T> {
  findAll(options?: QueryOptions): Promise<T[]>;
  findById(id: string): Promise<T | null>;
  findBySlug?(slug: string): Promise<T | null>;
  create(data: Partial<T>): Promise<T>;
  update(id: string, data: Partial<T>): Promise<T | null>;
  delete(id: string): Promise<boolean>;
  count(): Promise<number>;
}

export abstract class BaseRepository<T> implements Repository<T> {
  protected useDatabase: boolean;

  constructor() {
    // Use database if either USE_DATABASE is true or DATABASE_URL is present
    // This ensures we prioritize database over JSON when a database connection is available
    this.useDatabase =
      process.env["USE_DATABASE"] === "true" ||
      Boolean(process.env["DATABASE_URL"]);
  }

  abstract findAll(options?: QueryOptions): Promise<T[]>;
  abstract findById(id: string): Promise<T | null>;
  abstract create(data: Partial<T>): Promise<T>;
  abstract update(id: string, data: Partial<T>): Promise<T | null>;
  abstract delete(id: string): Promise<boolean>;
  abstract count(): Promise<number>;

  // Optional methods
  async findBySlug?(_slug: string): Promise<T | null> {
    throw new Error("findBySlug not implemented");
  }
}
