import { NextResponse } from "next/server";
import { getAuth } from "./auth-helper";

/**
 * Check if the current user is authenticated with Clerk
 * For admin routes, we check if the user has a valid Clerk session
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    console.log("[clerk-auth] Checking authentication...");
    const { userId } = await getAuth();
    console.log("[clerk-auth] UserId:", userId);
    return !!userId;
  } catch (error) {
    console.error("[clerk-auth] Error in isAuthenticated:", error);
    console.error("[clerk-auth] Error stack:", error instanceof Error ? error.stack : "No stack");
    // Re-throw the error so the caller can handle it
    throw error;
  }
}

/**
 * Get the current authenticated user ID
 */
export async function getAuthenticatedUserId(): Promise<string | null> {
  try {
    const { userId } = await getAuth();
    return userId;
  } catch (error) {
    console.error("[clerk-auth] Error in getAuthenticatedUserId:", error);
    return null;
  }
}

/**
 * Returns an unauthorized response for protected routes
 */
export function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized - Please sign in" }, { status: 401 });
}

/**
 * Middleware wrapper for protected API routes
 * Usage: return withAuth(async () => { ... your route logic ... })
 */
export async function withAuth<T>(
  handler: () => Promise<NextResponse<T>>
): Promise<NextResponse<T | { error: string }>> {
  try {
    const authenticated = await isAuthenticated();

    if (!authenticated) {
      return unauthorizedResponse();
    }

    return handler();
  } catch (error) {
    console.error("[clerk-auth] Error in withAuth:", error);
    return NextResponse.json(
      {
        error: "Authentication check failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
