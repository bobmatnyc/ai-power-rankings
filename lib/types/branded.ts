/**
 * Branded Types System
 * Provides type-safe identifiers and brand-based validation
 */

/**
 * Base brand type for creating nominal types
 */
export type Brand<K, T> = K & { readonly __brand: T };

// ==================== Core Entity IDs ====================

export type ToolId = Brand<string, "ToolId">;
export type UserId = Brand<string, "UserId">;
export type ArticleId = Brand<string, "ArticleId">;
export type CompanyId = Brand<string, "CompanyId">;
export type RankingId = Brand<string, "RankingId">;
export type ProcessingLogId = Brand<string, "ProcessingLogId">;
export type CategoryId = Brand<string, "CategoryId">;

// ==================== Helper Creation Functions ====================

export function toToolId(id: string): ToolId {
  if (!id || typeof id !== "string") {
    throw new Error("ToolId must be a non-empty string");
  }
  return id as ToolId;
}

export function toUserId(id: string): UserId {
  if (!id || typeof id !== "string") {
    throw new Error("UserId must be a non-empty string");
  }
  return id as UserId;
}

export function toArticleId(id: string): ArticleId {
  if (!id || typeof id !== "string") {
    throw new Error("ArticleId must be a non-empty string");
  }
  return id as ArticleId;
}

export function toCompanyId(id: string): CompanyId {
  if (!id || typeof id !== "string") {
    throw new Error("CompanyId must be a non-empty string");
  }
  return id as CompanyId;
}

export function toRankingId(id: string): RankingId {
  if (!id || typeof id !== "string") {
    throw new Error("RankingId must be a non-empty string");
  }
  return id as RankingId;
}

export function toProcessingLogId(id: string): ProcessingLogId {
  if (!id || typeof id !== "string") {
    throw new Error("ProcessingLogId must be a non-empty string");
  }
  return id as ProcessingLogId;
}

export function toCategoryId(id: string): CategoryId {
  if (!id || typeof id !== "string") {
    throw new Error("CategoryId must be a non-empty string");
  }
  return id as CategoryId;
}

// ==================== Type Guards ====================

export function isToolId(value: unknown): value is ToolId {
  return typeof value === "string" && value.length > 0;
}

export function isUserId(value: unknown): value is UserId {
  return typeof value === "string" && value.length > 0;
}

export function isArticleId(value: unknown): value is ArticleId {
  return typeof value === "string" && value.length > 0;
}

export function isCompanyId(value: unknown): value is CompanyId {
  return typeof value === "string" && value.length > 0;
}

export function isRankingId(value: unknown): value is RankingId {
  return typeof value === "string" && value.length > 0;
}

export function isProcessingLogId(value: unknown): value is ProcessingLogId {
  return typeof value === "string" && value.length > 0;
}

export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === "string" && value.length > 0;
}

// ==================== Collection Types ====================

export type BrandedIdMap<T extends Brand<string, any>, V> = Map<T, V>;
export type BrandedIdSet<T extends Brand<string, any>> = Set<T>;
export type BrandedIdArray<T extends Brand<string, any>> = readonly T[];

// ==================== Utility Functions ====================

/**
 * Safe converter that returns undefined for invalid inputs
 */
export function safeToToolId(value: unknown): ToolId | undefined {
  return isToolId(value) ? (value as ToolId) : undefined;
}

export function safeToUserId(value: unknown): UserId | undefined {
  return isUserId(value) ? (value as UserId) : undefined;
}

export function safeToArticleId(value: unknown): ArticleId | undefined {
  return isArticleId(value) ? (value as ArticleId) : undefined;
}

export function safeToCompanyId(value: unknown): CompanyId | undefined {
  return isCompanyId(value) ? (value as CompanyId) : undefined;
}

export function safeToRankingId(value: unknown): RankingId | undefined {
  return isRankingId(value) ? (value as RankingId) : undefined;
}

export function safeToProcessingLogId(value: unknown): ProcessingLogId | undefined {
  return isProcessingLogId(value) ? (value as ProcessingLogId) : undefined;
}

export function safeToCategoryId(value: unknown): CategoryId | undefined {
  return isCategoryId(value) ? (value as CategoryId) : undefined;
}

// ==================== Array Helpers ====================

/**
 * Convert array of strings to array of branded IDs, filtering out invalid entries
 */
export function toToolIdArray(values: unknown[]): ToolId[] {
  return values.filter(isToolId).map((value) => value as ToolId);
}

export function toUserIdArray(values: unknown[]): UserId[] {
  return values.filter(isUserId).map((value) => value as UserId);
}

export function toArticleIdArray(values: unknown[]): ArticleId[] {
  return values.filter(isArticleId).map((value) => value as ArticleId);
}

export function toCompanyIdArray(values: unknown[]): CompanyId[] {
  return values.filter(isCompanyId).map((value) => value as CompanyId);
}

// ==================== Debug Utilities ====================

/**
 * Extract the underlying string value from a branded type (for debugging)
 */
export function unwrapBrand<T extends Brand<string, any>>(branded: T): string {
  return branded as string;
}

/**
 * Type-safe comparison for branded types
 */
export function compareBrandedIds<T extends Brand<string, any>>(a: T, b: T): boolean {
  return (a as string) === (b as string);
}

// ==================== Export Type Assertions ====================

/**
 * Type assertion utilities for migration from any types
 * Use these temporarily when migrating from 'any' to branded types
 */
export const assertions = {
  asToolId: (value: any): ToolId => {
    if (typeof value === "string" && value.length > 0) {
      return value as ToolId;
    }
    throw new Error(`Invalid ToolId: ${value}`);
  },

  asUserId: (value: any): UserId => {
    if (typeof value === "string" && value.length > 0) {
      return value as UserId;
    }
    throw new Error(`Invalid UserId: ${value}`);
  },

  asArticleId: (value: any): ArticleId => {
    if (typeof value === "string" && value.length > 0) {
      return value as ArticleId;
    }
    throw new Error(`Invalid ArticleId: ${value}`);
  },

  asCompanyId: (value: any): CompanyId => {
    if (typeof value === "string" && value.length > 0) {
      return value as CompanyId;
    }
    throw new Error(`Invalid CompanyId: ${value}`);
  },
} as const;
