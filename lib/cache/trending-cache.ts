/**
 * Trending Cache Management
 *
 * WHY: Provides centralized cache invalidation for trending analysis data.
 * This is called when new articles are posted or rankings are updated to ensure
 * the trending page shows fresh data.
 *
 * DESIGN DECISION: Use pattern-based invalidation to clear all trending cache
 * variants (different time ranges) in a single operation.
 *
 * @fileoverview Cache invalidation utilities for trending rankings
 */

import cacheInstance, { invalidateCachePattern } from "@/lib/memory-cache";
import { loggers } from "@/lib/logger";

/**
 * Invalidate all trending cache entries.
 *
 * This clears cache for all time ranges (all, 3 months, 6 months, etc.)
 * Should be called when:
 * - New articles are posted that affect rankings
 * - Rankings are manually updated
 * - New ranking periods are added to the database
 *
 * @returns Number of cache entries invalidated
 */
export function invalidateTrendingCache(): number {
  try {
    // Invalidate all cache entries matching the "trending:" pattern
    const invalidated = invalidateCachePattern("^trending:");

    loggers.api.info("Trending cache invalidated", {
      entriesCleared: invalidated,
    });

    return invalidated;
  } catch (error) {
    loggers.api.error("Failed to invalidate trending cache", { error });
    return 0;
  }
}

/**
 * Invalidate trending cache for a specific time range.
 *
 * Use this for more granular cache invalidation if only specific
 * time ranges need to be cleared.
 *
 * @param timeRange - Time range to invalidate ('all' | number of months)
 * @returns True if cache entry was deleted
 */
export function invalidateTrendingCacheForRange(timeRange: number | "all"): boolean {
  try {
    const cacheKey = `trending:${timeRange}`;
    const deleted = cacheInstance.delete(cacheKey);

    loggers.api.debug("Trending cache invalidated for range", {
      timeRange,
      deleted,
    });

    return deleted;
  } catch (error) {
    loggers.api.error("Failed to invalidate trending cache for range", {
      timeRange,
      error,
    });
    return false;
  }
}

/**
 * Preload trending cache for common time ranges.
 *
 * This can be called after rankings are updated to warm the cache
 * and provide fast initial page loads.
 *
 * Note: This requires fetching data, so it should be done asynchronously
 * and not block the main request.
 */
export async function preloadTrendingCache(): Promise<void> {
  // This is a placeholder for future implementation
  // Would need to import and call the trending analysis logic
  loggers.api.debug("Trending cache preload requested (not yet implemented)");
}
