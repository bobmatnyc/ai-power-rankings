import { NextResponse } from "next/server";

/**
 * GET /api/test-basic
 * Ultra-minimal test - no imports except NextResponse
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    time: Date.now(),
    env_use_db: process.env["USE_DATABASE"] || "missing",
    env_db_exists: !!process.env["DATABASE_URL"],
  });
}
