// Fallback data - these will be loaded dynamically if needed
// The cache files no longer exist in the project structure
import { loggers } from "@/lib/logger";
import type { CacheType } from "./cache-manager";
import { CacheManager } from "./cache-manager";

// Empty fallback data since cache files no longer exist
const fallbackData: Record<CacheType, unknown> = {
  rankings: [],
  tools: [],
  news: [],
};

/**
 * Load cache data with fallback chain:
 * 1. Try blob storage (if available in production)
 * 2. Try filesystem cache via cache manager
 * 3. Fall back to imported JSON files
 */
export async function loadCacheWithFallback(type: CacheType): Promise<unknown> {
  const cacheManager = new CacheManager();

  try {
    // Try to get from cache manager (blob or filesystem)
    const cachedData = await cacheManager.get(type);
    if (cachedData) {
      loggers.api.debug(`Loaded ${type} from cache manager`);
      return cachedData;
    }
  } catch (error) {
    loggers.api.error(`Failed to load ${type} from cache manager`, { error });
  }

  // Return empty fallback since cache files no longer exist
  loggers.api.warn(`No cache available for ${type}, returning empty data`);
  return fallbackData[type];
}
