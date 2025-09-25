/**
 * Test endpoint to validate API route authentication bypass
 * This endpoint uses the new api-auth utilities instead of middleware
 */

import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAuth, optionalAuth } from "@/lib/api-auth";

/**
 * GET /api/admin/bypass-test
 * Test the bypass authentication mechanism
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") || "admin";

  try {
    switch (mode) {
      case "admin": {
        // Test admin authentication
        const authResult = await requireAdmin();
        if (authResult.error) {
          return authResult.error;
        }

        const { userId, user } = authResult;

        return NextResponse.json({
          success: true,
          mode: "admin",
          userId,
          user: {
            id: user.id,
            email: user.emailAddresses[0]?.emailAddress,
            firstName: user.firstName,
            lastName: user.lastName,
            isAdmin: user.publicMetadata?.isAdmin === true,
          },
          runtime: process.env["NEXT_RUNTIME"] || "nodejs",
          timestamp: new Date().toISOString(),
        });
      }

      case "auth": {
        // Test basic authentication
        const authResult = await requireAuth();
        if (authResult.error) {
          return authResult.error;
        }

        const { userId } = authResult;

        return NextResponse.json({
          success: true,
          mode: "auth",
          userId,
          runtime: process.env["NEXT_RUNTIME"] || "nodejs",
          timestamp: new Date().toISOString(),
        });
      }

      case "optional": {
        // Test optional authentication
        const authResult = await optionalAuth();
        const { userId } = authResult;

        return NextResponse.json({
          success: true,
          mode: "optional",
          authenticated: !!userId,
          userId: userId || null,
          runtime: process.env["NEXT_RUNTIME"] || "nodejs",
          timestamp: new Date().toISOString(),
        });
      }

      case "public": {
        // Test public access (no auth)
        return NextResponse.json({
          success: true,
          mode: "public",
          message: "This endpoint works without authentication",
          runtime: process.env["NEXT_RUNTIME"] || "nodejs",
          timestamp: new Date().toISOString(),
        });
      }

      default:
        return NextResponse.json(
          {
            error: "Invalid mode",
            message: `Unknown mode: ${mode}. Use admin, auth, optional, or public`,
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("[Bypass Test] Unexpected error:", error);
    return NextResponse.json(
      {
        error: "Unexpected error",
        message: error instanceof Error ? error.message : "Unknown error",
        runtime: process.env["NEXT_RUNTIME"] || "nodejs",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/bypass-test
 * Test POST requests with authentication
 */
export async function POST(request: NextRequest) {
  // Check admin authentication
  const authResult = await requireAdmin();
  if (authResult.error) {
    return authResult.error;
  }

  const { userId, user } = authResult;

  try {
    const body = await request.json();

    return NextResponse.json({
      success: true,
      method: "POST",
      userId,
      userEmail: user.emailAddresses[0]?.emailAddress,
      isAdmin: user.publicMetadata?.isAdmin === true,
      receivedData: body,
      runtime: process.env["NEXT_RUNTIME"] || "nodejs",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Invalid request body",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 }
    );
  }
}