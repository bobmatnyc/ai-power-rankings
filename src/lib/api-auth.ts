/**
 * API Route Authentication Utilities
 *
 * These utilities handle authentication directly in API routes to avoid
 * Edge Runtime conflicts with Clerk middleware.
 *
 * API routes run in Node.js runtime and handle their own authentication.
 */

import { NextResponse } from "next/server";

/**
 * Require authentication for an API route
 * Returns the userId if authenticated, or an error response if not
 */
export async function requireAuth() {
  try {
    // Dynamically import Clerk auth to ensure it's loaded in server context
    const { auth } = await import("@clerk/nextjs/server");
    const { userId } = await auth();

    if (!userId) {
      return {
        error: NextResponse.json(
          {
            error: "Unauthorized",
            message: "Authentication required",
            code: "AUTH_REQUIRED",
          },
          { status: 401 }
        ),
      };
    }

    return { userId, error: null };
  } catch (error) {
    console.error("[API Auth] Authentication check failed:", error);
    return {
      error: NextResponse.json(
        {
          error: "Authentication failed",
          message: error instanceof Error ? error.message : "Unknown error",
          code: "AUTH_ERROR",
        },
        { status: 500 }
      ),
    };
  }
}

/**
 * Require admin privileges for an API route
 * Returns the userId and user if admin, or an error response if not
 */
export async function requireAdmin() {
  try {
    // Dynamically import Clerk functions to ensure they're loaded in server context
    const { auth, currentUser } = await import("@clerk/nextjs/server");
    const { userId } = await auth();

    if (!userId) {
      return {
        error: NextResponse.json(
          {
            error: "Unauthorized",
            message: "Authentication required",
            code: "AUTH_REQUIRED",
          },
          { status: 401 }
        ),
      };
    }

    const user = await currentUser();

    if (!user) {
      return {
        error: NextResponse.json(
          {
            error: "User not found",
            message: "Unable to retrieve user information",
            code: "USER_NOT_FOUND",
          },
          { status: 404 }
        ),
      };
    }

    const isAdmin = user.publicMetadata?.isAdmin === true;

    if (!isAdmin) {
      return {
        error: NextResponse.json(
          {
            error: "Forbidden",
            message: "Admin privileges required",
            code: "ADMIN_REQUIRED",
            userId,
          },
          { status: 403 }
        ),
      };
    }

    return { userId, user, error: null };
  } catch (error) {
    console.error("[API Auth] Admin check failed:", error);
    return {
      error: NextResponse.json(
        {
          error: "Authentication failed",
          message: error instanceof Error ? error.message : "Unknown error",
          code: "AUTH_ERROR",
        },
        { status: 500 }
      ),
    };
  }
}

/**
 * Optional authentication - returns userId if authenticated, null if not
 * Never returns an error response
 */
export async function optionalAuth() {
  try {
    // Dynamically import Clerk auth to ensure it's loaded in server context
    const { auth } = await import("@clerk/nextjs/server");
    const { userId } = await auth();
    return { userId, error: null };
  } catch (error) {
    console.error("[API Auth] Optional auth check failed:", error);
    return { userId: null, error: null };
  }
}
