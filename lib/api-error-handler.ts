import { NextResponse } from "next/server";

/**
 * API Error Handler Module
 *
 * Ensures all API routes return JSON errors instead of HTML error pages.
 * This is critical for fixing the runtime mismatch issue where Vercel
 * returns HTML error pages for unhandled exceptions.
 */

export interface APIErrorResponse {
  error: string;
  message: string;
  code?: string;
  details?: any;
  timestamp: string;
  runtime: string;
  debug?: any;
}

export interface APISuccessResponse<T = any> {
  status: "success";
  data: T;
  message?: string;
  timestamp: string;
  runtime: string;
}

/**
 * Detect current runtime environment
 */
export function detectRuntime(): string {
  // Check if we're in Edge Runtime using the global EdgeRuntime variable
  // @ts-expect-error - EdgeRuntime is a global only available in Edge Runtime
  return typeof globalThis.EdgeRuntime !== "undefined" ? "edge" : "nodejs";
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  error: unknown,
  message: string,
  status: number = 500,
  code?: string,
  debug?: any
): NextResponse {
  const errorResponse: APIErrorResponse = {
    error: error instanceof Error ? error.constructor.name : "UnknownError",
    message,
    code: code || `HTTP_${status}`,
    details: error instanceof Error ? error.message : String(error),
    timestamp: new Date().toISOString(),
    runtime: detectRuntime(),
    ...(debug && { debug }),
  };

  // Log error for monitoring
  console.error(`[API-ERROR-${status}]`, {
    ...errorResponse,
    stack: error instanceof Error ? error.stack : undefined,
  });

  return NextResponse.json(errorResponse, {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "X-Error-Handled": "true",
      "X-Runtime": detectRuntime(),
    },
  });
}

/**
 * Create a standardized success response
 */
export function createSuccessResponse<T>(
  data: T,
  message?: string,
  status: number = 200
): NextResponse {
  const successResponse: APISuccessResponse<T> = {
    status: "success",
    data,
    message,
    timestamp: new Date().toISOString(),
    runtime: detectRuntime(),
  };

  return NextResponse.json(successResponse, {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "X-Success": "true",
      "X-Runtime": detectRuntime(),
    },
  });
}

/**
 * Authentication error responses
 */
export function createAuthErrorResponse(message: string, code: string, debug?: any): NextResponse {
  return createErrorResponse(new Error("Authentication failed"), message, 401, code, debug);
}

export function createForbiddenResponse(message: string, code: string, debug?: any): NextResponse {
  return createErrorResponse(new Error("Access forbidden"), message, 403, code, debug);
}

export function createServiceUnavailableResponse(service: string, error: unknown): NextResponse {
  return createErrorResponse(
    error,
    `${service} service is temporarily unavailable. Please try again later.`,
    503,
    "SERVICE_UNAVAILABLE",
    { service }
  );
}

/**
 * Safe async wrapper that ensures JSON responses
 */
export async function safeAPIHandler<T>(
  handler: () => Promise<T>,
  errorMessage: string = "An internal error occurred"
): Promise<NextResponse> {
  try {
    const result = await handler();
    return createSuccessResponse(result);
  } catch (error) {
    return createErrorResponse(error, errorMessage);
  }
}

/**
 * Clerk auth wrapper with error handling
 */
export async function safeClerkAuth(
  authFn: () => Promise<any>,
  context: string = "authentication"
): Promise<{ success: boolean; data?: any; error?: NextResponse }> {
  try {
    const result = await authFn();
    return { success: true, data: result };
  } catch (error) {
    console.error(`[CLERK-AUTH-ERROR] ${context}:`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      runtime: detectRuntime(),
      timestamp: new Date().toISOString(),
    });

    return {
      success: false,
      error: createServiceUnavailableResponse("Authentication", error),
    };
  }
}

/**
 * Enhanced error boundary for API routes
 */
export function withErrorBoundary<T extends any[]>(handler: (...args: T) => Promise<NextResponse>) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      // Ultimate safety net - ensure we never return HTML
      console.error("[ERROR-BOUNDARY] Unhandled error in API route:", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        runtime: detectRuntime(),
        timestamp: new Date().toISOString(),
        args: args.map((arg) => (typeof arg === "object" ? "[object]" : String(arg))),
      });

      return createErrorResponse(
        error,
        "An unexpected error occurred while processing your request",
        500,
        "UNHANDLED_ERROR",
        { boundary: true }
      );
    }
  };
}

/**
 * Validate runtime environment
 */
export function validateRuntime(): { isValid: boolean; runtime: string; expected: string } {
  const runtime = detectRuntime();
  const expected = "nodejs";
  const isValid = runtime === expected;

  if (!isValid) {
    console.warn(`[RUNTIME-WARNING] Expected ${expected} runtime, got ${runtime}`);
  }

  return { isValid, runtime, expected };
}
