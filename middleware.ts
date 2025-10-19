import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Quick Win #4: Only log in development to save 10-30ms TTFB in production
const isDevelopment = process.env.NODE_ENV === 'development';

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/(.*)/sign-in(.*)",
  "/(.*)/sign-up(.*)",
  "/api/public(.*)",
  "/api/health(.*)",
  "/api/rankings(.*)",
  "/api/tools(.*)",
  "/api/news(.*)",
  "/api/og(.*)",
  "/(.*)/news(.*)",
  "/(.*)/rankings(.*)",
  "/(.*)/tools(.*)",
  "/(.*)/about(.*)",
  "/(.*)/methodology(.*)",
  "/(.*)/trending(.*)",
  "/(.*)/privacy(.*)",
  "/(.*)/terms(.*)",
  "/(.*)/contact(.*)",
]);

// Define protected routes that require authentication
const isProtectedRoute = createRouteMatcher([
  "/(.*)/admin(.*)",
  "/(.*)/dashboard(.*)",
  "/api/admin(.*)",
]);

export default clerkMiddleware(async (auth, req: NextRequest) => {
  // Check if auth is disabled for development/testing
  if (process.env.NEXT_PUBLIC_DISABLE_AUTH === "true") {
    // SECURITY: Prevent auth bypass in production
    if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
      console.error("[SECURITY] Auth bypass attempted in production environment - BLOCKING");
      return NextResponse.json(
        { error: "Security violation: Authentication cannot be disabled in production" },
        { status: 403 }
      );
    }

    if (isDevelopment) {
      console.log("[middleware] Auth disabled in development, skipping checks");
    }
    return NextResponse.next();
  }

  const pathname = req.nextUrl.pathname;
  if (isDevelopment) {
    console.log("[middleware] Processing request:", pathname);
  }

  // Allow public routes without authentication check
  if (isPublicRoute(req)) {
    if (isDevelopment) {
      console.log("[middleware] Public route, allowing access:", pathname);
    }
    return NextResponse.next();
  }

  // Use await with auth() to properly read the session
  const authData = await auth();
  const { userId, sessionId } = authData;

  if (isDevelopment) {
    console.log("[middleware] Auth data:", {
      pathname,
      userId: userId || "null",
      sessionId: sessionId || "null",
      isProtectedRoute: isProtectedRoute(req),
      headers: {
        cookie: req.headers.get("cookie")?.substring(0, 50) + "...",
      }
    });
  }

  // For protected routes, use Clerk's protect() method which handles auth automatically
  if (isProtectedRoute(req)) {
    if (!userId) {
      if (isDevelopment) {
        console.log("[middleware] Protected route without userId, redirecting to sign-in");
      }
      // Get the locale from the URL
      const locale = pathname.split("/")[1] || "en";

      // Build the sign-in URL
      const signInUrl = new URL(`/${locale}/sign-in`, req.url);

      // SECURITY: Validate redirect URL is internal only (prevent open redirect)
      // Allow: /en/admin, /en/dashboard
      // Block: //evil.com, https://evil.com, /\evil.com
      const isInternalPath = pathname.startsWith('/') && !pathname.startsWith('//') && !pathname.startsWith('/\\');
      const safeRedirect = isInternalPath ? pathname : `/${locale}/admin`;

      signInUrl.searchParams.set("redirect_url", safeRedirect);

      return NextResponse.redirect(signInUrl);
    }
    if (isDevelopment) {
      console.log("[middleware] Protected route with valid userId, allowing access");
    }
  }

  if (isDevelopment) {
    console.log("[middleware] Allowing access to:", pathname);
  }
  // For all other routes, continue normally
  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};