import { clerkMiddleware } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Create the Clerk middleware handler for non-API routes only
const clerkHandler = clerkMiddleware((auth, req) => {
  // All non-API auth logic would go here
  // For now, just pass through
  return NextResponse.next();
});

// Main middleware that completely bypasses Clerk for API routes
export default function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // CRITICAL: For API routes, return IMMEDIATELY without invoking Clerk at all
  // This prevents Clerk from seeing cookies and trying to validate them
  if (pathname.startsWith("/api")) {
    const response = NextResponse.next();

    // Add CORS headers for API routes
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    return response;
  }

  // Only use Clerk middleware for non-API routes
  return clerkHandler(request);
}

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    // Include API routes in matcher (required for middleware to run)
    '/(api|trpc)(.*)',
  ],
};