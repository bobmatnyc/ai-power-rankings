import { NextResponse } from "next/server";

// Force Node.js runtime instead of Edge Runtime
export const runtime = "nodejs";

/**
 * Basic test endpoint with NO authentication or external dependencies
 * This tests if the basic API route functionality works in production
 */
export async function GET() {
  try {
    console.log("[CRITICAL] test-basic endpoint called");

    // Check environment variables without exposing sensitive data
    const hasClerkKey = !!process.env["CLERK_SECRET_KEY"];
    const hasNextAuth = !!process.env["NEXT_PUBLIC_DISABLE_AUTH"];
    const nodeEnv = process.env["NODE_ENV"];

    console.log("[CRITICAL] Environment check - hasClerkKey:", hasClerkKey);
    console.log("[CRITICAL] Environment check - hasNextAuth:", hasNextAuth);
    console.log("[CRITICAL] Environment check - nodeEnv:", nodeEnv);

    const response = {
      status: "ok",
      message: "Basic API route is working",
      timestamp: new Date().toISOString(),
      runtime: "nodejs",
      environment: nodeEnv,
      hasClerkKey,
      hasNextAuth,
      test: "This endpoint bypasses ALL authentication and external dependencies"
    };

    console.log("[CRITICAL] test-basic returning success response");
    return NextResponse.json(response, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache"
      }
    });

  } catch (error) {
    console.error("[CRITICAL] test-basic endpoint error:", error);
    console.error("[CRITICAL] Error type:", typeof error);
    console.error("[CRITICAL] Error constructor:", error?.constructor?.name);
    console.error("[CRITICAL] Error message:", error instanceof Error ? error.message : String(error));
    console.error("[CRITICAL] Error stack:", error instanceof Error ? error.stack : "No stack");

    return NextResponse.json(
      {
        error: "test-basic endpoint failed",
        message: error instanceof Error ? error.message : String(error),
        type: typeof error,
        constructor: error?.constructor?.name || "unknown",
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      },
      {
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  }
}