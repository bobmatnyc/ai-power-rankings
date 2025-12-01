/**
 * Centralized Cache Invalidation Service
 *
 * Provides a unified interface for invalidating Next.js caches and in-memory caches
 * when data mutations occur. Coordinates between:
 * - Next.js ISR cache (revalidatePath, revalidateTag)
 * - In-memory cache (memory-cache.ts)
 *
 * Usage:
 *   import { invalidateArticleCache } from '@/lib/cache/invalidation.service'
 *   await invalidateArticleCache()
 */

import { revalidatePath, revalidateTag } from 'next/cache';
import { invalidateCachePattern } from '@/lib/memory-cache';

/**
 * Cache tags for fine-grained invalidation
 */
export const CACHE_TAGS = {
  TOOLS: 'tools',
  RANKINGS: 'rankings',
  NEWS: 'news',
  ARTICLES: 'articles',
  WHATS_NEW: 'whats-new',
} as const;

/**
 * Paths that need revalidation on data changes
 */
export const CACHE_PATHS = {
  HOME: '/',
  TOOLS: '/tools',
  RANKINGS: '/rankings',
  NEWS: '/news',
  WHATS_NEW: '/whats-new',
} as const;

export type CacheTag = typeof CACHE_TAGS[keyof typeof CACHE_TAGS];
export type CachePath = typeof CACHE_PATHS[keyof typeof CACHE_PATHS];

/**
 * Invalidation result for tracking and debugging
 */
export interface InvalidationResult {
  success: boolean;
  pathsRevalidated: string[];
  tagsRevalidated: string[];
  memoryCacheCleared: string[];
  errors: string[];
}

/**
 * Invalidate all caches related to articles
 *
 * Triggered by:
 * - Article creation (ingest)
 * - Article updates (PATCH)
 * - Article deletion (DELETE)
 * - Article recalculation (recalculate rankings)
 *
 * Invalidates:
 * - All article-related pages (news, whats-new, homepage)
 * - All ranking pages (since articles affect rankings)
 * - Tools pages (since rankings affect tool display)
 * - In-memory article and ranking caches
 */
export async function invalidateArticleCache(): Promise<InvalidationResult> {
  const result: InvalidationResult = {
    success: true,
    pathsRevalidated: [],
    tagsRevalidated: [],
    memoryCacheCleared: [],
    errors: [],
  };

  try {
    // Revalidate all language variants of affected paths
    const pathsToRevalidate = [
      CACHE_PATHS.HOME,
      CACHE_PATHS.TOOLS,
      CACHE_PATHS.RANKINGS,
      CACHE_PATHS.NEWS,
      CACHE_PATHS.WHATS_NEW,
    ];

    for (const path of pathsToRevalidate) {
      try {
        // Revalidate the path layout (affects all [lang] variants)
        revalidatePath(path, 'layout');
        result.pathsRevalidated.push(path);
      } catch (error) {
        const message = `Failed to revalidate path ${path}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`[Cache Invalidation] ${message}`);
        result.errors.push(message);
        result.success = false;
      }
    }

    // Revalidate cache tags
    const tagsToRevalidate = [
      CACHE_TAGS.ARTICLES,
      CACHE_TAGS.NEWS,
      CACHE_TAGS.RANKINGS,
      CACHE_TAGS.TOOLS,
      CACHE_TAGS.WHATS_NEW,
    ];

    for (const tag of tagsToRevalidate) {
      try {
        revalidateTag(tag);
        result.tagsRevalidated.push(tag);
      } catch (error) {
        const message = `Failed to revalidate tag ${tag}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`[Cache Invalidation] ${message}`);
        result.errors.push(message);
        result.success = false;
      }
    }

    // Clear in-memory caches
    const memoryPatterns = [
      '^articles:',
      '^news:',
      '^rankings:',
      '^whats-new:',
    ];

    for (const pattern of memoryPatterns) {
      try {
        const cleared = invalidateCachePattern(pattern);
        result.memoryCacheCleared.push(`${pattern} (${cleared} entries)`);
      } catch (error) {
        const message = `Failed to clear memory cache pattern ${pattern}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`[Cache Invalidation] ${message}`);
        result.errors.push(message);
        result.success = false;
      }
    }

    console.log('[Cache Invalidation] Article cache invalidated:', {
      paths: result.pathsRevalidated.length,
      tags: result.tagsRevalidated.length,
      memoryCache: result.memoryCacheCleared.length,
      errors: result.errors.length,
    });

    return result;
  } catch (error) {
    console.error('[Cache Invalidation] Critical error:', error);
    result.success = false;
    result.errors.push(`Critical error: ${error instanceof Error ? error.message : String(error)}`);
    return result;
  }
}

/**
 * Invalidate all caches related to rankings
 *
 * Triggered by:
 * - Rankings commit (new ranking period)
 * - Rankings recalculation
 * - Tool score updates
 *
 * Invalidates:
 * - All ranking pages
 * - Homepage (shows top rankings)
 * - Tools pages (show rankings)
 * - In-memory ranking and tool caches
 */
export async function invalidateRankingsCache(): Promise<InvalidationResult> {
  const result: InvalidationResult = {
    success: true,
    pathsRevalidated: [],
    tagsRevalidated: [],
    memoryCacheCleared: [],
    errors: [],
  };

  try {
    // Revalidate all language variants of affected paths
    const pathsToRevalidate = [
      CACHE_PATHS.HOME,
      CACHE_PATHS.RANKINGS,
      CACHE_PATHS.TOOLS,
    ];

    for (const path of pathsToRevalidate) {
      try {
        revalidatePath(path, 'layout');
        result.pathsRevalidated.push(path);
      } catch (error) {
        const message = `Failed to revalidate path ${path}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`[Cache Invalidation] ${message}`);
        result.errors.push(message);
        result.success = false;
      }
    }

    // Revalidate cache tags
    const tagsToRevalidate = [
      CACHE_TAGS.RANKINGS,
      CACHE_TAGS.TOOLS,
    ];

    for (const tag of tagsToRevalidate) {
      try {
        revalidateTag(tag);
        result.tagsRevalidated.push(tag);
      } catch (error) {
        const message = `Failed to revalidate tag ${tag}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`[Cache Invalidation] ${message}`);
        result.errors.push(message);
        result.success = false;
      }
    }

    // Clear in-memory caches
    const memoryPatterns = [
      '^rankings:',
      '^tools:',
    ];

    for (const pattern of memoryPatterns) {
      try {
        const cleared = invalidateCachePattern(pattern);
        result.memoryCacheCleared.push(`${pattern} (${cleared} entries)`);
      } catch (error) {
        const message = `Failed to clear memory cache pattern ${pattern}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`[Cache Invalidation] ${message}`);
        result.errors.push(message);
        result.success = false;
      }
    }

    console.log('[Cache Invalidation] Rankings cache invalidated:', {
      paths: result.pathsRevalidated.length,
      tags: result.tagsRevalidated.length,
      memoryCache: result.memoryCacheCleared.length,
      errors: result.errors.length,
    });

    return result;
  } catch (error) {
    console.error('[Cache Invalidation] Critical error:', error);
    result.success = false;
    result.errors.push(`Critical error: ${error instanceof Error ? error.message : String(error)}`);
    return result;
  }
}

/**
 * Invalidate specific paths and tags
 *
 * For custom invalidation scenarios
 */
export async function invalidateCache(
  paths: string[],
  tags: string[],
  memoryCachePatterns: string[] = []
): Promise<InvalidationResult> {
  const result: InvalidationResult = {
    success: true,
    pathsRevalidated: [],
    tagsRevalidated: [],
    memoryCacheCleared: [],
    errors: [],
  };

  try {
    // Revalidate paths
    for (const path of paths) {
      try {
        revalidatePath(path, 'layout');
        result.pathsRevalidated.push(path);
      } catch (error) {
        const message = `Failed to revalidate path ${path}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`[Cache Invalidation] ${message}`);
        result.errors.push(message);
        result.success = false;
      }
    }

    // Revalidate tags
    for (const tag of tags) {
      try {
        revalidateTag(tag);
        result.tagsRevalidated.push(tag);
      } catch (error) {
        const message = `Failed to revalidate tag ${tag}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`[Cache Invalidation] ${message}`);
        result.errors.push(message);
        result.success = false;
      }
    }

    // Clear in-memory caches
    for (const pattern of memoryCachePatterns) {
      try {
        const cleared = invalidateCachePattern(pattern);
        result.memoryCacheCleared.push(`${pattern} (${cleared} entries)`);
      } catch (error) {
        const message = `Failed to clear memory cache pattern ${pattern}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`[Cache Invalidation] ${message}`);
        result.errors.push(message);
        result.success = false;
      }
    }

    console.log('[Cache Invalidation] Custom cache invalidation:', {
      paths: result.pathsRevalidated.length,
      tags: result.tagsRevalidated.length,
      memoryCache: result.memoryCacheCleared.length,
      errors: result.errors.length,
    });

    return result;
  } catch (error) {
    console.error('[Cache Invalidation] Critical error:', error);
    result.success = false;
    result.errors.push(`Critical error: ${error instanceof Error ? error.message : String(error)}`);
    return result;
  }
}

/**
 * Invalidate all caches
 *
 * Nuclear option for when you need to clear everything
 * Use sparingly - prefer specific invalidation when possible
 */
export async function invalidateAllCaches(): Promise<InvalidationResult> {
  const result: InvalidationResult = {
    success: true,
    pathsRevalidated: [],
    tagsRevalidated: [],
    memoryCacheCleared: [],
    errors: [],
  };

  try {
    // Revalidate all paths
    const allPaths = Object.values(CACHE_PATHS);
    for (const path of allPaths) {
      try {
        revalidatePath(path, 'layout');
        result.pathsRevalidated.push(path);
      } catch (error) {
        const message = `Failed to revalidate path ${path}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`[Cache Invalidation] ${message}`);
        result.errors.push(message);
        result.success = false;
      }
    }

    // Revalidate all tags
    const allTags = Object.values(CACHE_TAGS);
    for (const tag of allTags) {
      try {
        revalidateTag(tag);
        result.tagsRevalidated.push(tag);
      } catch (error) {
        const message = `Failed to revalidate tag ${tag}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`[Cache Invalidation] ${message}`);
        result.errors.push(message);
        result.success = false;
      }
    }

    // Clear all in-memory cache
    try {
      const cleared = invalidateCachePattern('.*'); // Match everything
      result.memoryCacheCleared.push(`all (${cleared} entries)`);
    } catch (error) {
      const message = `Failed to clear all memory cache: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`[Cache Invalidation] ${message}`);
      result.errors.push(message);
      result.success = false;
    }

    console.log('[Cache Invalidation] All caches invalidated:', {
      paths: result.pathsRevalidated.length,
      tags: result.tagsRevalidated.length,
      memoryCache: result.memoryCacheCleared.length,
      errors: result.errors.length,
    });

    return result;
  } catch (error) {
    console.error('[Cache Invalidation] Critical error:', error);
    result.success = false;
    result.errors.push(`Critical error: ${error instanceof Error ? error.message : String(error)}`);
    return result;
  }
}
