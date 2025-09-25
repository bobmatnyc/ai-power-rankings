import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// This endpoint does NOT use Clerk at all - just returns success
export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: "This endpoint works without any Clerk imports",
    timestamp: new Date().toISOString(),
    runtime: process.env.NEXT_RUNTIME || "nodejs",
    cookies: request.cookies.getAll().map(c => ({
      name: c.name,
      hasValue: !!c.value
    }))
  });
}