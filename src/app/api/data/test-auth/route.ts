import { NextResponse } from "next/server";
import { isAuthenticatedManual, getUserInfoManual } from "@/lib/manual-auth";

/**
 * Test authentication endpoint using manual cookie approach
 * This bypasses Clerk's middleware to avoid HTML error responses
 */
export async function GET() {
  try {
    console.log("[test-auth] Starting authentication test");

    // Test manual authentication approach
    const isAuth = await isAuthenticatedManual();
    console.log("[test-auth] Manual authentication result:", isAuth);

    let userInfo = null;
    if (isAuth) {
      try {
        userInfo = await getUserInfoManual();
        console.log("[test-auth] User info retrieved:", userInfo);
      } catch (userError) {
        console.error("[test-auth] Error getting user info:", userError);
      }
    }

    const response = {
      authenticated: isAuth,
      user: userInfo,
      timestamp: new Date().toISOString(),
      method: "manual-cookie-auth",
      authDisabled: process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true",
      nodeEnv: process.env["NODE_ENV"],
      message: isAuth ? "Authentication successful" : "Authentication failed",
    };

    console.log("[test-auth] Returning authentication test result");

    return NextResponse.json(response, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("[test-auth] Error in authentication test:", error);

    const errorResponse = {
      error: "Authentication test failed",
      message: error instanceof Error ? error.message : "Unknown error",
      authenticated: false,
      timestamp: new Date().toISOString(),
      stack:
        process.env["NODE_ENV"] === "development" && error instanceof Error
          ? error.stack
          : undefined,
    };

    return NextResponse.json(errorResponse, {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}

// Use Node.js runtime
export const runtime = "nodejs";
