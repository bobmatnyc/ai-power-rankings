import { NextResponse } from "next/server";

// Force Node.js runtime
export const runtime = "nodejs";

export async function GET() {
  try {
    console.log("[test-import] Starting import test");

    // Test different import methods
    // Using flexible type for test results
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: Record<string, any> = {
      timestamp: new Date().toISOString(),
      imports: {},
    };

    // Try dynamic import
    try {
      console.log("[test-import] Attempting dynamic import...");
      const clerkModule = await import("@clerk/nextjs/server");
      results["imports"]["dynamic"] = {
        success: true,
        hasAuth: !!clerkModule.auth,
        hasClerkMiddleware: !!clerkModule.clerkMiddleware,
        exports: Object.keys(clerkModule),
      };

      // Try to use the dynamically imported auth
      if (clerkModule.auth) {
        try {
          const authResult = await clerkModule.auth();
          results["authCall"] = {
            success: true,
            userId: authResult?.userId || null,
            sessionId: authResult?.sessionId || null,
          };
        } catch (authError) {
          results["authCall"] = {
            success: false,
            error: authError instanceof Error ? authError.message : String(authError),
            errorType: authError instanceof Error ? authError.constructor.name : typeof authError,
          };
        }
      }
    } catch (importError) {
      results["imports"]["dynamic"] = {
        success: false,
        error: importError instanceof Error ? importError.message : String(importError),
      };
    }

    // Check environment variables
    results["env"] = {
      hasPublishableKey: !!process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"],
      hasSecretKey: !!process.env["CLERK_SECRET_KEY"],
      nodeEnv: process.env["NODE_ENV"],
      hasAuthDisabled: process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true",
    };

    return NextResponse.json(results);
  } catch (error) {
    console.error("[test-import] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
