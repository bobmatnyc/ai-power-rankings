import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function isAdminAuthenticated(): Promise<boolean> {
  // In development, bypass auth if ENABLE_DEV_MODE is set
  if (process.env["NODE_ENV"] === "development" && process.env["ENABLE_DEV_MODE"] === "true") {
    return true;
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("admin-session");

  // Check if session token exists
  return !!sessionToken?.value;
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete("admin-session");
}

/**
 * Returns an unauthorized response for admin routes
 */
export function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/**
 * Middleware wrapper for admin routes
 * Usage: return withAdminAuth(async () => { ... your route logic ... })
 */
export async function withAdminAuth<T>(
  handler: () => Promise<NextResponse<T>>
): Promise<NextResponse<T | { error: string }>> {
  if (!(await isAdminAuthenticated())) {
    return unauthorizedResponse();
  }

  return handler();
}
