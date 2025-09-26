import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Force Node.js runtime
export const runtime = "nodejs";

export async function GET() {
  try {
    console.log("[test-minimal] Starting - checking if auth is available");
    console.log("[test-minimal] auth function type:", typeof auth);
    console.log(
      "[test-minimal] process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY exists:",
      !!process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"]
    );
    console.log(
      "[test-minimal] process.env.CLERK_SECRET_KEY exists:",
      !!process.env["CLERK_SECRET_KEY"]
    );

    // Try to call auth with error handling
    let authResult: Awaited<ReturnType<typeof auth>> | undefined;
    try {
      console.log("[test-minimal] About to call auth()...");
      authResult = await auth();
      console.log("[test-minimal] auth() returned:", JSON.stringify(authResult));
    } catch (authError) {
      console.error("[test-minimal] auth() threw error:", authError);
      console.error("[test-minimal] Error name:", authError instanceof Error ? authError.constructor.name : typeof authError);
      console.error("[test-minimal] Error stack:", authError instanceof Error ? authError.stack : undefined);

      // Return the error details as JSON
      return NextResponse.json({
        success: false,
        error: "auth_failed",
        errorType: authError instanceof Error ? authError.constructor.name : "Unknown",
        message: authError instanceof Error ? authError.message : String(authError),
        stack: process.env["NODE_ENV"] === "development" && authError instanceof Error ? authError.stack : undefined,
      });
    }

    // Return success with auth details
    return NextResponse.json({
      success: true,
      hasAuth: !!authResult,
      userId: authResult?.userId || null,
      sessionId: authResult?.sessionId || null,
      timestamp: new Date().toISOString(),
    });
  } catch (outerError) {
    console.error("[test-minimal] Outer error:", outerError);
    return NextResponse.json(
      {
        success: false,
        error: "outer_error",
        message: outerError instanceof Error ? outerError.message : String(outerError),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
