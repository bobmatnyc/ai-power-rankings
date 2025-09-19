import { getAuth } from "./auth-helper";
import { NextResponse } from "next/server";

/**
 * Check if the current user is authenticated with Clerk
 * For admin routes, we check if the user has a valid Clerk session
 */
export async function isAuthenticated(): Promise<boolean> {
  const { userId } = await getAuth();
  return !!userId;
}

/**
 * Get the current authenticated user ID
 */
export async function getAuthenticatedUserId(): Promise<string | null> {
  const { userId } = await getAuth();
  return userId;
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
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    return unauthorizedResponse();
  }

  return handler();
}