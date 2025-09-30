import { NextResponse } from "next/server";

/**
 * GET /api/admin/env-test
 * Minimal test - just check environment variables, no auth
 */
export async function GET() {
  try {
    // No auth check - just return env info
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      env: {
        NODE_ENV: process.env["NODE_ENV"] || "not-set",
        USE_DATABASE: process.env["USE_DATABASE"] || "not-set",
        DATABASE_URL_EXISTS: !!process.env["DATABASE_URL"],
        DATABASE_URL_LENGTH: process.env["DATABASE_URL"]?.length || 0,
        VERCEL: process.env["VERCEL"] || "not-set",
        VERCEL_ENV: process.env["VERCEL_ENV"] || "not-set",
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        type: error instanceof Error ? error.constructor.name : "Unknown",
      },
      { status: 500 }
    );
  }
}
