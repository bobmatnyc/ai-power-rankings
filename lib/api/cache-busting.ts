/**
 * Cache-busting utilities for API requests
 * Prevents aggressive mobile browser caching
 */

interface CacheBustOptions {
  timestamp?: boolean;
  userAgent?: boolean;
  randomSeed?: boolean;
}

/**
 * Generate cache-busting parameters for API requests
 */
export function generateCacheBustParams(options: CacheBustOptions = {}): string {
  const params = new URLSearchParams();

  // Always include timestamp for basic cache busting
  if (options.timestamp !== false) {
    params.set('cb', Date.now().toString());
  }

  // Add random seed for additional entropy
  if (options.randomSeed) {
    params.set('_r', Math.random().toString(36).substring(7));
  }

  // Add user agent hash for mobile-specific cache busting
  if (options.userAgent && typeof navigator !== 'undefined') {
    const uaHash = simpleHash(navigator.userAgent).toString(36);
    params.set('_ua', uaHash);
  }

  return params.toString();
}

/**
 * Add cache-busting to existing URL
 */
export function addCacheBusting(url: string, options?: CacheBustOptions): string {
  const separator = url.includes('?') ? '&' : '?';
  const cacheBustParams = generateCacheBustParams(options);
  return `${url}${separator}${cacheBustParams}`;
}

/**
 * Get cache-prevention headers for mobile browsers
 */
export function getCachePreventionHeaders(): Record<string, string> {
  return {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  };
}

/**
 * Enhanced fetch with automatic cache-busting
 */
export async function cacheBustFetch(
  url: string,
  options: RequestInit = {},
  cacheBustOptions?: CacheBustOptions
): Promise<Response> {
  const cacheBustedUrl = addCacheBusting(url, cacheBustOptions);

  const enhancedOptions: RequestInit = {
    ...options,
    headers: {
      ...getCachePreventionHeaders(),
      ...options.headers,
    }
  };

  return fetch(cacheBustedUrl, enhancedOptions);
}

/**
 * Simple hash function for user agent
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Check if request is from mobile browser
 */
export function isMobileUserAgent(userAgent: string): boolean {
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  return mobileRegex.test(userAgent);
}

/**
 * Generate mobile-specific cache headers
 */
export function getMobileCacheHeaders(userAgent?: string): Record<string, string> {
  const isMobile = userAgent ? isMobileUserAgent(userAgent) : false;

  if (isMobile) {
    return {
      'Cache-Control': 'no-cache, no-store, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Vary': 'User-Agent',
      'X-Mobile-Cache': 'disabled'
    };
  }

  return {
    'Cache-Control': 'public, max-age=0, must-revalidate',
    'Vary': 'User-Agent'
  };
}
