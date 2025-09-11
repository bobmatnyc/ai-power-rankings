/**
 * Base Repository Pattern
 * Provides abstraction layer for data access (JSON or PostgreSQL)
 */

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
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
    this.useDatabase = process.env["USE_DATABASE"] === "true";
  }

  abstract findAll(options?: QueryOptions): Promise<T[]>;
  abstract findById(id: string): Promise<T | null>;
  abstract create(data: Partial<T>): Promise<T>;
  abstract update(id: string, data: Partial<T>): Promise<T | null>;
  abstract delete(id: string): Promise<boolean>;
  abstract count(): Promise<number>;
  
  // Optional methods
  async findBySlug?(slug: string): Promise<T | null> {
    throw new Error('findBySlug not implemented');
  }
}