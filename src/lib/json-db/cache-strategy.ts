/**
 * Cache Strategy for JSON Data
 * Implements in-memory caching with TTL and LRU eviction
 */

import { loggers } from "../logger";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
}

interface CacheOptions {
  maxSize: number;
  ttl: number; // Time to live in milliseconds
  checkInterval: number; // Cleanup interval in milliseconds
}

export class CacheStrategy<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private options: CacheOptions;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(options: Partial<CacheOptions> = {}) {
    this.options = {
      maxSize: options.maxSize || 100,
      ttl: options.ttl || 60 * 60 * 1000, // 1 hour default
      checkInterval: options.checkInterval || 5 * 60 * 1000, // 5 minutes default
    };

    this.startCleanup();
  }

  /**
   * Get item from cache
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return null;
    }

    // Update access info
    entry.accessCount++;
    entry.lastAccessed = Date.now();

    return entry.data;
  }

  /**
   * Set item in cache
   */
  set(key: string, data: T): void {
    // Check cache size limit
    if (this.cache.size >= this.options.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      accessCount: 0,
      lastAccessed: Date.now(),
    });
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete item from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    loggers.cache.info("Cache cleared");
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    totalHits: number;
    totalMisses: number;
  } {
    let totalHits = 0;
    let totalAccess = 0;

    this.cache.forEach((entry) => {
      totalHits += entry.accessCount;
      totalAccess += entry.accessCount + 1; // +1 for initial set
    });

    return {
      size: this.cache.size,
      maxSize: this.options.maxSize,
      hitRate: totalAccess > 0 ? totalHits / totalAccess : 0,
      totalHits,
      totalMisses: totalAccess - totalHits,
    };
  }

  /**
   * Warm cache with data
   */
  warm(entries: Array<{ key: string; data: T }>): void {
    entries.forEach(({ key, data }) => {
      this.set(key, data);
    });

    loggers.cache.info(`Cache warmed with ${entries.length} entries`);
  }

  /**
   * Check if entry is expired
   */
  private isExpired(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp > this.options.ttl;
  }

  /**
   * Evict least recently used item
   */
  private evictLRU(): void {
    let lruKey: string | null = null;
    let lruTime = Date.now();

    this.cache.forEach((entry, key) => {
      if (entry.lastAccessed < lruTime) {
        lruTime = entry.lastAccessed;
        lruKey = key;
      }
    });

    if (lruKey) {
      this.cache.delete(lruKey);
      loggers.cache.debug(`Evicted LRU item: ${lruKey}`);
    }
  }

  /**
   * Start cleanup interval
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.options.checkInterval);
  }

  /**
   * Stop cleanup interval
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    let cleaned = 0;

    this.cache.forEach((entry, key) => {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        cleaned++;
      }
    });

    if (cleaned > 0) {
      loggers.cache.debug(`Cleaned up ${cleaned} expired entries`);
    }
  }
}

/**
 * Global cache instances for different data types
 */
export const toolsCache = new CacheStrategy<any>({
  maxSize: 500,
  ttl: 60 * 60 * 1000, // 1 hour
});

export const companiesCache = new CacheStrategy<any>({
  maxSize: 200,
  ttl: 60 * 60 * 1000, // 1 hour
});

export const rankingsCache = new CacheStrategy<any>({
  maxSize: 50,
  ttl: 30 * 60 * 1000, // 30 minutes
});

export const newsCache = new CacheStrategy<any>({
  maxSize: 1000,
  ttl: 15 * 60 * 1000, // 15 minutes
});
