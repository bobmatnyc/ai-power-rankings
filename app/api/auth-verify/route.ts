import { NextResponse } from "next/server";

/**
 * GET /api/auth-verify
 * Simple authentication verification endpoint
 * Returns current user status and admin access
 */
export async function GET() {
  try {
    console.log("[Auth Verify] Starting authentication check");

    // Check if auth is disabled
    const isAuthDisabled =
      process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true" ||
      !process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"] ||
      !process.env["CLERK_SECRET_KEY"];

    if (isAuthDisabled) {
      console.log("[Auth Verify] Auth is disabled");
      return NextResponse.json({
        authenticated: false,
        message: "Authentication is disabled",
        authDisabled: true,
        timestamp: new Date().toISOString(),
      });
    }

    // Try to get the current user using dynamic import
    try {
      const clerkModule = await import("@clerk/nextjs/server");
      if (!clerkModule || typeof clerkModule.currentUser !== "function") {
        console.warn("[Auth Verify] Clerk module not properly loaded");
        return NextResponse.json({
          authenticated: false,
          message: "Authentication service unavailable",
          timestamp: new Date().toISOString(),
        });
      }

      const { currentUser } = clerkModule;
      const user = await currentUser();

      if (!user) {
        console.log("[Auth Verify] No user found - not signed in");
        return NextResponse.json({
          authenticated: false,
          message: "Not signed in",
          timestamp: new Date().toISOString(),
        });
      }

      console.log("[Auth Verify] User found:", {
        id: user.id,
        email: user.emailAddresses?.[0]?.emailAddress,
        publicMetadata: user.publicMetadata,
      });

      // Check admin status
      const isAdmin = user.privateMetadata?.isAdmin === true;

      return NextResponse.json({
        authenticated: true,
        user: {
          id: user.id,
          email: user.emailAddresses?.[0]?.emailAddress || "No email",
          firstName: user.firstName,
          lastName: user.lastName,
        },
        admin: {
          hasAccess: isAdmin,
          privateMetadata: user.privateMetadata,
          checkResult: `privateMetadata.isAdmin === true: ${isAdmin}`,
        },
        timestamp: new Date().toISOString(),
        message: isAdmin ? "✅ You have admin access" : "❌ You do NOT have admin access",
      });
    } catch (moduleError) {
      console.error("[Auth Verify] Module import error:", moduleError);

      // If module import fails, return appropriate response
      if (moduleError instanceof Error && moduleError.message.includes("Cannot find module")) {
        return NextResponse.json({
          authenticated: false,
          message: "Clerk authentication not available",
          authDisabled: true,
          timestamp: new Date().toISOString(),
        });
      }

      throw moduleError; // Re-throw if it's a different error
    }
  } catch (error) {
    console.error("[Auth Verify] Error:", error);
    return NextResponse.json(
      {
        error: "Authentication check failed",
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}