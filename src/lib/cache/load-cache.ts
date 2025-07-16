import fallbackNewsData from "@/data/cache/news.json";
// Import fallback data from filesystem
import fallbackRankingsData from "@/data/cache/rankings.json";
import fallbackToolsData from "@/data/cache/tools.json";
import { loggers } from "@/lib/logger";
import type { CacheType } from "./cache-manager";
import { CacheManager } from "./cache-manager";

const fallbackData: Record<CacheType, any> = {
  rankings: fallbackRankingsData,
  tools: fallbackToolsData,
  news: fallbackNewsData,
};

/**
 * Load cache data with fallback chain:
 * 1. Try blob storage (if available in production)
 * 2. Try filesystem cache via cache manager
 * 3. Fall back to imported JSON files
 */
export async function loadCacheWithFallback(type: CacheType): Promise<any> {
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

  // Fall back to imported JSON
  loggers.api.debug(`Using fallback ${type} data from imported JSON`);
  return fallbackData[type];
}
