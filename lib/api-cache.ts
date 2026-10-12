/**
 * API Response Caching Middleware
 * Implements HTTP caching headers for optimal performance
 */

import { NextResponse } from "next/server";

interface CacheConfig {
  maxAge?: number; // seconds
  sMaxAge?: number; // CDN cache
  staleWhileRevalidate?: number;
  mustRevalidate?: boolean;
  private?: boolean;
}

const DEFAULT_CACHE_CONFIG: Record<string, CacheConfig> = {
  // Public data - cache aggressively
  "/api/tools": {
    maxAge: 300, // 5 minutes browser cache
    sMaxAge: 3600, // 1 hour CDN cache
    staleWhileRevalidate: 86400, // 24 hours stale
  },
  "/api/rankings": {
    maxAge: 0, // No browser cache - always fetch fresh
    sMaxAge: 300, // 5 minutes CDN cache (reduced from 1 hour)
    staleWhileRevalidate: 600, // 10 minutes stale (reduced from 24 hours)
    mustRevalidate: true, // Force revalidation
  },
  // #152: `max-age=0`, `must-revalidate` and the `no-cache` the old per-UA
  // branch appended kept the edge from storing a single response. With no
  // `max-age` the browser has no freshness lifetime of its own, so it still
  // asks the edge every time; only the edge holds the 5-minute copy.
  "/api/news": {
    sMaxAge: 300, // 5 minutes CDN cache
    staleWhileRevalidate: 1800, // 30 minutes stale
  },
  "/api/companies": {
    maxAge: 600, // 10 minutes
    sMaxAge: 7200, // 2 hours CDN
    staleWhileRevalidate: 86400,
  },

  // Admin endpoints - no public caching
  "/api/admin": {
    private: true,
    mustRevalidate: true,
  },
};

export function setCacheHeaders(
  response: NextResponse,
  pathname: string,
  customConfig?: CacheConfig
): NextResponse {
  // Find matching config
  let config = customConfig;

  if (!config) {
    // Check exact match first
    config = DEFAULT_CACHE_CONFIG[pathname];

    // Check prefix match
    if (!config) {
      for (const [path, pathConfig] of Object.entries(DEFAULT_CACHE_CONFIG)) {
        if (pathname.startsWith(path)) {
          config = pathConfig;
          break;
        }
      }
    }
  }

  // No config found, use safe defaults
  if (!config) {
    config = {
      maxAge: 60,
      mustRevalidate: true,
    };
  }

  // Build cache-control header
  const directives: string[] = [];

  if (config.private) {
    directives.push("private");
  } else {
    directives.push("public");
  }

  if (config.maxAge !== undefined) {
    directives.push(`max-age=${config.maxAge}`);
  }

  if (config.sMaxAge !== undefined) {
    directives.push(`s-maxage=${config.sMaxAge}`);
  }

  if (config.staleWhileRevalidate !== undefined) {
    directives.push(`stale-while-revalidate=${config.staleWhileRevalidate}`);
  }

  if (config.mustRevalidate) {
    directives.push("must-revalidate");
  }

  // #152: the `/api/news*` branch that sat here appended `no-cache` for every
  // client (and `no-store, private` for mobile ones) plus `Vary: User-Agent`,
  // so the edge never stored a news response. The body carries nothing
  // per-client, so one public copy serves every User-Agent.

  // Set headers
  response.headers.set("Cache-Control", directives.join(", "));

  // #152: no ETag. The old one hashed `JSON.stringify(response.body)`, a
  // ReadableStream that always stringifies to "{}", so every response carried
  // the same ETag; once the edge caches, a matching If-None-Match would get a
  // 304 for content that has changed.

  // Add performance headers
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Response-Source", "json-db");

  // #152: `X-Vercel-Cache` is Vercel's own report of a cache hit; the app set
  // it to "MISS" on every response, which made a hit indistinguishable.
  response.headers.set("CDN-Cache-Control", directives.join(", "));

  // Add timestamp header for debugging
  response.headers.set("X-Response-Time", new Date().toISOString());
  response.headers.set("X-Last-Modified", new Date().toUTCString());

  return response;
}

/**
 * Check if request has valid ETag
 */
export function checkETag(request: Request, currentETag: string): boolean {
  const ifNoneMatch = request.headers.get("If-None-Match");
  return ifNoneMatch === currentETag;
}

/**
 * Create cached JSON response
 */
export function cachedJsonResponse(
  data: unknown,
  pathname: string,
  status: number = 200,
  customConfig?: CacheConfig
): NextResponse {
  // #152: no `request` parameter; the header no longer varies by User-Agent.
  const response = NextResponse.json(data, { status });
  return setCacheHeaders(response, pathname, customConfig);
}

/**
 * A JSON response no cache may store.
 *
 * Why: An error or a per-request body served under a route's public
 * `s-maxage` would be kept by the edge and handed to every later caller (#152).
 * What: `NextResponse.json(data, { status })` with `Cache-Control: no-store`.
 * Test: `tests/unit/news-route-fail-closed.test.ts`.
 */
export function uncachedJsonResponse(data: unknown, status: number): NextResponse {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Create 304 Not Modified response
 */
export function notModifiedResponse(): NextResponse {
  return new NextResponse(null, { status: 304 });
}
