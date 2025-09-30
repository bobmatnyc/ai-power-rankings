/**
 * Simple health check endpoint that requires no authentication
 * This bypasses all authentication middleware and should always work
 */

import { NextResponse } from "next/server";

/**
 * GET /api/health
 * Simple health check - no authentication required
 */
export async function GET() {
  return NextResponse.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    runtime: process.env["NEXT_RUNTIME"] || "nodejs",
    message: "Health check successful - API is working",
  });
}
