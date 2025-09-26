import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { i18n } from "./i18n/config";

// Type definitions for Clerk functions when dynamically imported
type ClerkMiddleware = (handler: (auth: any, req: NextRequest) => Promise<NextResponse>) => (req: NextRequest) => Promise<NextResponse>;
type CreateRouteMatcher = (routes: string[]) => (req: NextRequest) => boolean;

// Conditionally import Clerk based on environment
// This prevents production errors when Clerk is not configured
let clerkMiddleware: ClerkMiddleware | null = null;
let createRouteMatcher: CreateRouteMatcher | null = null;

const isAuthDisabled = process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";
const hasClerkKey = !!process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"];

// Only load Clerk if auth is enabled AND we have the necessary keys
if (!isAuthDisabled && hasClerkKey) {
  try {
    const clerkModule = require("@clerk/nextjs/server");
    clerkMiddleware = clerkModule.clerkMiddleware;
    createRouteMatcher = clerkModule.createRouteMatcher;
  } catch (error) {
    console.warn("[Middleware] Clerk not available:", error);
  }
}

// Middleware ALWAYS runs in Edge Runtime on Vercel - cannot be changed
// API routes are handled conditionally INSIDE middleware to avoid Clerk cookie validation
// API routes return early with NextResponse.next() before Clerk processes them

// Skip environment validation in middleware since it runs in Edge Runtime
// The validation will happen in API routes and server components which run in Node.js runtime
// This prevents Edge Runtime errors from missing environment variables that are only needed for specific features

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

// Define route matchers - use createRouteMatcher if available, otherwise simple pattern matching
const protectedRoutePatterns = ["/(.*)admin(.*)", "/(.*)dashboard(.*)"];
const publicRoutePatterns = [
  "/(.*)sign-in(.*)",
  "/(.*)sign-up(.*)",
  "/",
  "/(.*)/news(.*)",
  "/(.*)/companies(.*)",
  "/(.*)/about(.*)",
  "/api/health(.*)",
  "/api/public(.*)",
];

// Create route matchers using Clerk if available, otherwise use simple matching
const isProtectedRoute = createRouteMatcher
  ? createRouteMatcher(protectedRoutePatterns)
  : (req: NextRequest) => {
      const pathname = req.nextUrl.pathname;
      return protectedRoutePatterns.some((pattern) => {
        const regex = new RegExp("^" + pattern.replace(/\(.*\)/g, ".*") + "$");
        return regex.test(pathname);
      });
    };

const isPublicRoute = createRouteMatcher
  ? createRouteMatcher(publicRoutePatterns)
  : (req: NextRequest) => {
      const pathname = req.nextUrl.pathname;
      return publicRoutePatterns.some((pattern) => {
        const regex = new RegExp("^" + pattern.replace(/\(.*\)/g, ".*") + "$");
        return regex.test(pathname);
      });
    };

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

// Middleware function that handles both Clerk and non-Clerk scenarios
async function middlewareHandler(req: NextRequest): Promise<NextResponse> {
  const pathname = req.nextUrl.pathname;

  // Allow sitemap.xml to be accessed without locale prefix
  if (pathname === "/sitemap.xml") {
    return NextResponse.next();
  }


  // Handle public routes that don't need authentication (but still need Clerk context for API routes)
  if (isPublicRoute(req) && !pathname.startsWith("/api/")) {
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
      return NextResponse.json(null, { status: 200, headers: response.headers });
    }
    return response;
  }

  // Handle locale redirection for non-API routes only
  if (!pathname.startsWith("/api/")) {
    const localeResponse = handleLocaleRedirection(req);
    if (localeResponse) {
      return localeResponse;
    }
  }

  // Protected routes are bypassed when auth is disabled or Clerk is not available
  // This prevents production errors when Clerk environment variables are missing
  if (isProtectedRoute(req) && !isPublicRoute(req) && !isAuthDisabled && clerkMiddleware) {
    // Route is protected and Clerk is available - this will be handled by Clerk wrapper
    // Just note that authentication will be required
    console.log(`[Middleware] Protected route ${pathname} will require authentication`);
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
}

// Export middleware - use Clerk wrapper if available, otherwise direct handler
export default clerkMiddleware && !isAuthDisabled
  ? clerkMiddleware(async (auth: any, req: NextRequest) => {
      // When using Clerk, handle authentication for protected routes
      const pathname = req.nextUrl.pathname;

      if (isProtectedRoute(req) && !isPublicRoute(req)) {
        try {
          const { userId } = await auth();
          if (!userId) {
            // For API routes, return 401 JSON response instead of redirect
            if (pathname.startsWith("/api/")) {
              return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }

            // For page routes, redirect to sign-in
            const locale = pathname.split("/")[1] || "en";
            const host = req.headers.get("host") || "localhost:3000";
            const protocol = req.headers.get("x-forwarded-proto") || "http";
            const redirectUrl = new URL(`/${locale}/sign-in`, `${protocol}://${host}`);
            return NextResponse.redirect(redirectUrl, { status: 303 });
          }
        } catch (error) {
          console.error("[Middleware] Auth check failed:", error);

          // For API routes, return 500 JSON response instead of redirect
          if (pathname.startsWith("/api/")) {
            return NextResponse.json(
              {
                error: "Authentication service error",
                message: error instanceof Error ? error.message : "Unknown error",
              },
              { status: 500 }
            );
          }

          // For page routes, redirect to sign-in
          const locale = pathname.split("/")[1] || "en";
          const host = req.headers.get("host") || "localhost:3000";
          const protocol = req.headers.get("x-forwarded-proto") || "http";
          const redirectUrl = new URL(`/${locale}/sign-in`, `${protocol}://${host}`);
          return NextResponse.redirect(redirectUrl, { status: 303 });
        }
      }

      // Call the main handler for all other logic
      return middlewareHandler(req);
    })
  : middlewareHandler;

export const config = {
  matcher: [
    // Skip Next.js internals and static files, but INCLUDE api routes for conditional handling
    "/((?!_next/static|_next/image|assets|data|partytown|favicon.ico|crown.*|robots.txt|sitemap.xml).*)",
    // Always include API routes but handle them conditionally inside the middleware
    "/(api|trpc)(.*)",
  ],
};
