/**
 * API Response Caching Middleware
 * Implements HTTP caching headers for optimal performance
 */

import { NextResponse } from "next/server";
import { getMobileCacheHeaders, isMobileUserAgent } from "@/lib/api/cache-busting";

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
  "/api/news": {
    maxAge: 0, // No browser cache for mobile compatibility
    sMaxAge: 300, // 5 minutes CDN cache (reduced for fresh content)
    staleWhileRevalidate: 1800, // 30 minutes stale (reduced from 12 hours)
    mustRevalidate: true, // Force revalidation on mobile
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
  customConfig?: CacheConfig,
  request?: Request
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

  // Enhanced mobile-specific cache prevention for news endpoint
  if (pathname.startsWith("/api/news")) {
    const userAgent = request?.headers.get("User-Agent") || "";
    const isMobile = isMobileUserAgent(userAgent);

    if (isMobile) {
      // Very aggressive cache prevention for mobile
      directives.push("no-cache", "no-store", "private");
      response.headers.set("Pragma", "no-cache");
      response.headers.set("Expires", "0");
      response.headers.set("X-Mobile-Cache", "disabled");
    } else {
      // Less aggressive for desktop but still prevent stale data
      directives.push("no-cache");
    }

    response.headers.set("Vary", "User-Agent");
  }

  // Set headers
  response.headers.set("Cache-Control", directives.join(", "));

  // Add ETag for conditional requests
  const data = response.body;
  if (data) {
    const etag = generateETag(JSON.stringify(data));
    response.headers.set("ETag", etag);
  }

  // Add performance headers
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Response-Source", "json-db");

  // Add Vercel Edge Cache headers for better cache control
  response.headers.set("X-Vercel-Cache", "MISS");
  response.headers.set("CDN-Cache-Control", directives.join(", "));

  // Add timestamp header for debugging
  response.headers.set("X-Response-Time", new Date().toISOString());
  response.headers.set("X-Last-Modified", new Date().toUTCString());

  return response;
}

/**
 * Generate ETag for content
 */
function generateETag(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `"${Math.abs(hash).toString(36)}"`;
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
  customConfig?: CacheConfig,
  request?: Request
): NextResponse {
  const response = NextResponse.json(data, { status });
  return setCacheHeaders(response, pathname, customConfig, request);
}

/**
 * Create 304 Not Modified response
 */
export function notModifiedResponse(): NextResponse {
  return new NextResponse(null, { status: 304 });
}
