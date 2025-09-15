import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function isAdminAuthenticated(request?: Request): Promise<boolean> {
  // Check if running in local development
  // Auto-detect based on NODE_ENV or request host
  const isLocalDev = () => {
    // First check NODE_ENV
    if (process.env["NODE_ENV"] === "development") {
      return true;
    }

    // If request is provided, check the host
    if (request) {
      const host = request.headers.get("host") || "";
      return (
        host.includes("localhost") ||
        host.includes("127.0.0.1") ||
        host.includes(":3002") || // AI Power Rankings dev port
        host.includes(":3001") || // Alternative dev port
        host.includes(":3000")    // Default Next.js dev port
      );
    }

    return false;
  };

  // In local development, bypass auth for easier development
  // Can still be disabled by setting FORCE_AUTH_IN_DEV=true
  if (isLocalDev() && process.env["FORCE_AUTH_IN_DEV"] !== "true") {
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
 * Usage: return withAdminAuth(async () => { ... your route logic ... }, request)
 */
export async function withAdminAuth<T>(
  handler: () => Promise<NextResponse<T>>,
  request?: Request
): Promise<NextResponse<T | { error: string }>> {
  if (!(await isAdminAuthenticated(request))) {
    return unauthorizedResponse();
  }

  return handler();
}
