/**
 * API utilities for consistent error handling and response formatting
 */

import { NextResponse } from "next/server";
import { loggers } from "@/lib/logger";

export interface ApiError {
  error: string;
  details?: unknown;
  timestamp: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
  cached?: boolean;
}

/**
 * Wrap API handlers with error handling and consistent response format
 */
export async function withApiErrorHandler<T>(
  handler: () => Promise<T>
): Promise<NextResponse<ApiResponse<T>>> {
  try {
    const data = await handler();
    return NextResponse.json({ data });
  } catch (error) {
    loggers.api.error("API handler error", { error });

    const errorResponse: ApiError = {
      error: error instanceof Error ? error.message : "An unexpected error occurred",
      timestamp: new Date().toISOString(),
    };

    if (process.env["NODE_ENV"] === "development") {
      errorResponse.details = error;
    }

    return NextResponse.json({ error: errorResponse }, { status: 500 });
  }
}

/**
 * Add caching headers to response
 */
export function withCaching(
  response: NextResponse,
  options: {
    maxAge?: number;
    sMaxAge?: number;
    staleWhileRevalidate?: number;
  } = {}
) {
  const { maxAge = 0, sMaxAge = 300, staleWhileRevalidate = 1800 } = options;

  const cacheControl = [
    `max-age=${maxAge}`,
    `s-maxage=${sMaxAge}`,
    `stale-while-revalidate=${staleWhileRevalidate}`,
  ].join(", ");

  response.headers.set("Cache-Control", cacheControl);
  return response;
}

/**
 * Create a cached response with proper headers
 */
export function cachedResponse<T>(
  data: T,
  cacheOptions?: Parameters<typeof withCaching>[1]
): NextResponse<ApiResponse<T>> {
  const response = NextResponse.json<ApiResponse<T>>({ data, cached: true });
  return withCaching(response, cacheOptions) as NextResponse<ApiResponse<T>>;
}
