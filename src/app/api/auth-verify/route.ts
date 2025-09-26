import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";

/**
 * GET /api/auth-verify
 * Simple authentication verification endpoint
 * Returns current user status and admin access
 */
export async function GET() {
  try {
    console.log("[Auth Verify] Starting authentication check");

    // Get the current user
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
    const isAdmin = user.publicMetadata?.isAdmin === true;

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
        publicMetadata: user.publicMetadata,
        checkResult: `publicMetadata.isAdmin === true: ${isAdmin}`,
      },
      timestamp: new Date().toISOString(),
      message: isAdmin ? "✅ You have admin access" : "❌ You do NOT have admin access",
    });
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
