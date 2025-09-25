import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { validateEnvironment } from "@/lib/startup-validation";
import { i18n } from "./i18n/config";

// Middleware ALWAYS runs in Edge Runtime on Vercel - cannot be changed
// API routes are handled conditionally INSIDE middleware to avoid Clerk cookie validation
// API routes return early with NextResponse.next() before Clerk processes them

// Run startup validation once when middleware is first loaded
// This ensures the application fails to start if required env vars are missing
let startupValidationComplete = false;
if (!startupValidationComplete) {
  try {
    validateEnvironment();
    startupValidationComplete = true;
  } catch (error) {
    console.error("[Middleware] Startup validation failed:", error);
    // In development, log the error but allow the app to continue
    // In production, this will cause the deployment to fail
    if (process.env["NODE_ENV"] === "production") {
      throw error;
    }
  }
}

const locales = i18n.locales;

function getLocale(request: NextRequest): string {
  // Check if locale is in URL path
  const pathname = request.nextUrl.pathname;
  const localeFromPath = locales.find(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (localeFromPath) {
    return localeFromPath;
  }

  // Check Accept-Language header
  const acceptLanguage = request.headers.get("accept-language");
  if (acceptLanguage) {
    const preferredLocales = acceptLanguage
      .split(",")
      .map((lang) => lang.split(";")[0]?.trim() || "")
      .map((lang) => {
        // Map language codes to our supported locales
        const langCode = lang.toLowerCase();
        if (langCode.startsWith("zh")) {
          return "zh";
        }
        if (langCode.startsWith("ja")) {
          return "ja";
        }
        if (langCode.startsWith("de")) {
          return "de";
        }
        if (langCode.startsWith("fr")) {
          return "fr";
        }
        if (langCode.startsWith("it")) {
          return "it";
        }
        if (langCode.startsWith("ko")) {
          return "ko";
        }
        if (langCode.startsWith("uk")) {
          return "uk";
        }
        if (langCode.startsWith("hr")) {
          return "hr";
        }
        return "en";
      });

    for (const locale of preferredLocales) {
      if (locales.includes(locale)) {
        return locale;
      }
    }
  }

  return i18n.defaultLocale;
}

// Define protected page routes (using modern createRouteMatcher pattern)
const isProtectedRoute = createRouteMatcher([
  "/(.*)admin(.*)",
  "/(.*)dashboard(.*)"
]);

// Define public routes that should be accessible without authentication
const isPublicRoute = createRouteMatcher([
  "/(.*)sign-in(.*)",
  "/(.*)sign-up(.*)",
  "/",
  "/(.*)/news(.*)",
  "/(.*)/companies(.*)",
  "/(.*)/about(.*)",
  "/api/health(.*)",
  "/api/public(.*)",
  // Admin routes are explicitly protected - remove them from public
]);

// Helper function for locale redirection
function handleLocaleRedirection(req: NextRequest): NextResponse | null {
  const pathname = req.nextUrl.pathname;

  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (!pathnameHasLocale) {
    const locale = getLocale(req);
    const host = req.headers.get("host") || "localhost:3000";
    const protocol = req.headers.get("x-forwarded-proto") || "http";
    const redirectUrl = new URL(`/${locale}${pathname}`, `${protocol}://${host}`);
    return NextResponse.redirect(redirectUrl, { status: 301 });
  }

  return null;
}

// Modern Clerk middleware using 2024 patterns - API routes MUST go through Clerk for auth context
export default clerkMiddleware(async (auth, req) => {
  const pathname = req.nextUrl.pathname;

  // Allow sitemap.xml to be accessed without locale prefix
  if (pathname === "/sitemap.xml") {
    return NextResponse.next();
  }

  // Check if auth is disabled globally (for special development cases only)
  const isAuthDisabled = process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";

  // Handle public routes that don't need authentication (but still need Clerk context for API routes)
  if (isPublicRoute(req) && !pathname.startsWith('/api/')) {
    const localeResponse = handleLocaleRedirection(req);
    if (localeResponse) {
      return localeResponse;
    }
    return NextResponse.next();
  }

  // Handle OAuth routes with CORS
  if (pathname === "/.well-known/oauth-authorization-server" || pathname === "/register") {
    const response = NextResponse.next();
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: response.headers });
    }
    return response;
  }

  // Handle locale redirection for non-API routes only
  if (!pathname.startsWith('/api/')) {
    const localeResponse = handleLocaleRedirection(req);
    if (localeResponse) {
      return localeResponse;
    }
  }

  // Protect routes - check authentication for protected routes
  if (isProtectedRoute(req) && !isPublicRoute(req) && !isAuthDisabled) {
    try {
      const { userId } = await auth();
      if (!userId) {
        // For API routes, return 401 JSON response instead of redirect
        if (pathname.startsWith('/api/')) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // For page routes, redirect to sign-in
        const locale = pathname.split("/")[1] || "en";
        const host = req.headers.get("host") || "localhost:3000";
        const protocol = req.headers.get("x-forwarded-proto") || "http";
        const redirectUrl = new URL(`/${locale}/sign-in`, `${protocol}://${host}`);
        return NextResponse.redirect(redirectUrl, { status: 303 });
      }
    } catch (error) {
      console.error('[Middleware] Auth check failed:', error);

      // For API routes, return 500 JSON response instead of redirect
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({
          error: 'Authentication service error',
          message: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
      }

      // For page routes, redirect to sign-in
      const locale = pathname.split("/")[1] || "en";
      const host = req.headers.get("host") || "localhost:3000";
      const protocol = req.headers.get("x-forwarded-proto") || "http";
      const redirectUrl = new URL(`/${locale}/sign-in`, `${protocol}://${host}`);
      return NextResponse.redirect(redirectUrl, { status: 303 });
    }
  }

  const response = NextResponse.next();

  // Add security headers
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");

  // Add performance headers for static assets
  if (pathname.includes("/_next/static")) {
    response.headers.set("Cache-Control", "public, max-age=31536000, immutable");
  }

  return response;
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files, but INCLUDE api routes for conditional handling
    '/((?!_next/static|_next/image|assets|data|partytown|favicon.ico|crown.*|robots.txt|sitemap.xml).*)',
    // Always include API routes but handle them conditionally inside the middleware
    '/(api|trpc)(.*)',
  ],
};