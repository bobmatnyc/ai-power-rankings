import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";

// Force Node.js runtime instead of Edge Runtime
export const runtime = "nodejs";

/**
 * Test endpoint that tests auth() and currentUser() separately
 * This helps identify which function is causing the 500 error
 */
export async function GET() {
  try {
    console.log("[CRITICAL] test-user endpoint called");

    // Step 1: Test auth()
    console.log("[CRITICAL] Step 1: Testing auth()...");
    let authResult;
    try {
      authResult = await auth();
      console.log("[CRITICAL] auth() success - userId:", authResult?.userId);
    } catch (authError) {
      console.error("[CRITICAL] auth() failed:", authError);
      return NextResponse.json(
        {
          error: "auth() failed",
          message: authError instanceof Error ? authError.message : String(authError),
          stage: "auth",
          timestamp: new Date().toISOString()
        },
        { status: 500 }
      );
    }

    // If no userId, return early
    if (!authResult?.userId) {
      return NextResponse.json({
        status: "not_authenticated",
        message: "No userId from auth()",
        timestamp: new Date().toISOString()
      });
    }

    // Step 2: Test currentUser()
    console.log("[CRITICAL] Step 2: Testing currentUser()...");
    let user;
    try {
      user = await currentUser();
      console.log("[CRITICAL] currentUser() success - id:", user?.id);
      console.log("[CRITICAL] User email:", user?.emailAddresses?.[0]?.emailAddress);
      console.log("[CRITICAL] User metadata:", user?.publicMetadata);
    } catch (userError) {
      console.error("[CRITICAL] currentUser() failed:", userError);
      console.error("[CRITICAL] User error type:", typeof userError);
      console.error("[CRITICAL] User error constructor:", userError?.constructor?.name);
      console.error("[CRITICAL] User error message:", userError instanceof Error ? userError.message : String(userError));
      console.error("[CRITICAL] User error stack:", userError instanceof Error ? userError.stack : "No stack");

      return NextResponse.json(
        {
          error: "currentUser() failed",
          message: userError instanceof Error ? userError.message : String(userError),
          authWorked: true,
          authUserId: authResult.userId,
          stage: "currentUser",
          timestamp: new Date().toISOString()
        },
        { status: 500 }
      );
    }

    // Success response
    return NextResponse.json({
      status: "ok",
      message: "Both auth() and currentUser() working",
      authUserId: authResult.userId,
      currentUserId: user?.id,
      email: user?.emailAddresses?.[0]?.emailAddress,
      publicMetadata: user?.publicMetadata,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("[CRITICAL] test-user endpoint outer error:", error);
    console.error("[CRITICAL] Error type:", typeof error);
    console.error("[CRITICAL] Error constructor:", error?.constructor?.name);
    console.error("[CRITICAL] Error message:", error instanceof Error ? error.message : String(error));
    console.error("[CRITICAL] Error stack:", error instanceof Error ? error.stack : "No stack");

    return NextResponse.json(
      {
        error: "test-user endpoint failed",
        message: error instanceof Error ? error.message : String(error),
        stage: "outer",
        timestamp: new Date().toISOString()
      },
      {
        status: 500
      }
    );
  }
}