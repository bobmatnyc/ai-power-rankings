import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

// Force Node.js runtime instead of Edge Runtime
export const runtime = "nodejs";

/**
 * Test endpoint that ONLY uses Clerk auth() function without currentUser()
 * This isolates whether the issue is with auth() or currentUser()
 */
export async function GET() {
  try {
    console.log("[CRITICAL] test-auth endpoint called");

    // Check if auth is disabled first
    const isAuthDisabled = process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";
    console.log("[CRITICAL] Auth disabled:", isAuthDisabled);

    if (isAuthDisabled) {
      return NextResponse.json({
        status: "ok",
        message: "Auth is disabled - skipping Clerk",
        authDisabled: true,
        timestamp: new Date().toISOString()
      });
    }

    // Check environment variables
    const hasClerkKey = !!process.env["CLERK_SECRET_KEY"];
    const clerkKeyLength = process.env["CLERK_SECRET_KEY"]?.length || 0;

    console.log("[CRITICAL] Has Clerk key:", hasClerkKey);
    console.log("[CRITICAL] Clerk key length:", clerkKeyLength);

    if (!hasClerkKey) {
      return NextResponse.json(
        {
          error: "Missing Clerk configuration",
          message: "CLERK_SECRET_KEY environment variable is not set",
          timestamp: new Date().toISOString()
        },
        { status: 500 }
      );
    }

    // Now try ONLY the auth() call
    console.log("[CRITICAL] Attempting Clerk auth() call...");

    let authResult;
    try {
      authResult = await auth();
      console.log("[CRITICAL] Clerk auth() successful!");
      console.log("[CRITICAL] Auth result keys:", Object.keys(authResult || {}));
      console.log("[CRITICAL] UserId:", authResult?.userId);
      console.log("[CRITICAL] SessionId exists:", !!authResult?.sessionId);
    } catch (authError) {
      console.error("[CRITICAL] Clerk auth() failed:", authError);
      console.error("[CRITICAL] Auth error type:", typeof authError);
      console.error("[CRITICAL] Auth error constructor:", authError?.constructor?.name);
      console.error("[CRITICAL] Auth error message:", authError instanceof Error ? authError.message : String(authError));
      console.error("[CRITICAL] Auth error stack:", authError instanceof Error ? authError.stack : "No stack");

      return NextResponse.json(
        {
          error: "Clerk auth() failed",
          message: authError instanceof Error ? authError.message : String(authError),
          type: typeof authError,
          constructor: authError?.constructor?.name || "unknown",
          stack: authError instanceof Error ? authError.stack : undefined,
          timestamp: new Date().toISOString(),
          stage: "auth_call"
        },
        { status: 500 }
      );
    }

    // Success response
    const response = {
      status: "ok",
      message: "Clerk auth() working",
      hasUserId: !!authResult?.userId,
      hasSessionId: !!authResult?.sessionId,
      userId: authResult?.userId || null,
      authKeys: Object.keys(authResult || {}),
      timestamp: new Date().toISOString(),
      stage: "auth_success"
    };

    console.log("[CRITICAL] test-auth returning success response");
    return NextResponse.json(response, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache"
      }
    });

  } catch (error) {
    console.error("[CRITICAL] test-auth endpoint outer error:", error);
    console.error("[CRITICAL] Error type:", typeof error);
    console.error("[CRITICAL] Error constructor:", error?.constructor?.name);
    console.error("[CRITICAL] Error message:", error instanceof Error ? error.message : String(error));
    console.error("[CRITICAL] Error stack:", error instanceof Error ? error.stack : "No stack");

    return NextResponse.json(
      {
        error: "test-auth endpoint failed",
        message: error instanceof Error ? error.message : String(error),
        type: typeof error,
        constructor: error?.constructor?.name || "unknown",
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
        stage: "outer_catch"
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