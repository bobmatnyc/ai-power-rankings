/**
 * In-Memory Cache for API Responses
 * Provides fast server-side caching to reduce database queries
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly maxSize = 100; // Maximum number of cache entries
  private readonly defaultTTL = 60000; // Default TTL: 1 minute

  constructor() {
    // Start cleanup interval
    this.startCleanup();
  }

  /**
   * Get item from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (Date.now() > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set item in cache
   */
  set<T>(key: string, data: T, ttl?: number): void {
    // Enforce max size by removing oldest entries
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
    });
  }

  /**
   * Delete item from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Invalidate cache entries by pattern
   */
  invalidatePattern(pattern: string): number {
    let deleted = 0;
    const regex = new RegExp(pattern);

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        deleted++;
      }
    }

    return deleted;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: 0, // Would need to track hits/misses for this
    };
  }

  /**
   * Start periodic cleanup of expired entries
   */
  private startCleanup(): void {
    // Clean up every 5 minutes
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.cache.entries()) {
        if (now > entry.timestamp + entry.ttl) {
          this.cache.delete(key);
        }
      }
    }, 300000); // 5 minutes

    // Ensure cleanup is stopped on process exit
    if (typeof process !== "undefined") {
      process.on("exit", () => this.stopCleanup());
    }
  }

  /**
   * Stop cleanup interval
   */
  private stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Create singleton instance
const cacheInstance = new MemoryCache();

// Cache TTL configurations for different endpoints
export const CACHE_TTL = {
  tools: 300000, // 5 minutes
  rankings: 60000, // 1 minute
  news: 180000, // 3 minutes
  companies: 600000, // 10 minutes
  toolDetail: 120000, // 2 minutes
  scoring: 60000, // 1 minute
} as const;

/**
 * Get cached data or fetch from source
 */
export async function getCachedOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl?: number
): Promise<T> {
  // Check cache first
  const cached = cacheInstance.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Fetch data
  const data = await fetcher();

  // Store in cache
  cacheInstance.set(key, data, ttl);

  return data;
}

/**
 * Invalidate cache for specific key
 */
export function invalidateCache(key: string): boolean {
  return cacheInstance.delete(key);
}

/**
 * Invalidate cache by pattern
 */
export function invalidateCachePattern(pattern: string): number {
  return cacheInstance.invalidatePattern(pattern);
}

/**
 * Clear all cache
 */
export function clearCache(): void {
  cacheInstance.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return cacheInstance.getStats();
}

export default cacheInstance;