import { clerkMiddleware } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Use Clerk middleware but with explicit bypasses
export default clerkMiddleware((auth, req) => {
  const pathname = req.nextUrl.pathname;

  // For API routes, don't do ANY authentication
  // Just return next() immediately
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // For static files and Next.js internals, skip
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // For protected page routes, use auth protection
  if (pathname.includes("/admin") || pathname.includes("/dashboard")) {
    // Only protect if not in test pages
    if (!pathname.includes("test") && !pathname.includes("diagnostics")) {
      // Let Clerk handle the protection for these routes
      // But don't call auth().protect() as it might fail
      // Just check if user exists
      const { userId } = auth();
      if (!userId && process.env.NODE_ENV === "production") {
        // Redirect to sign-in
        return NextResponse.redirect(new URL("/sign-in", req.url));
      }
    }
  }

  return NextResponse.next();
}, {
  // Key configuration: Tell Clerk to ignore certain paths
  ignoredRoutes: [
    "/api/(.*)",
    "/_next/(.*)",
    "/favicon.ico",
    "/robots.txt",
    "/sitemap.xml"
  ],
  debug: false, // Disable debug mode to prevent verbose logging
});

export const config = {
  matcher: [
    // Include everything except static files
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};