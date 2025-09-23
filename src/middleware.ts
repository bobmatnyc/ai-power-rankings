import { clerkMiddleware, createRouteMatcher, currentUser } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { validateEnvironment } from "@/lib/startup-validation";
import { i18n } from "./i18n/config";

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

// Define admin routes
const isAdminRoute = createRouteMatcher(["/(.*)admin(.*)"]);

// Define protected routes
const isProtectedRoute = createRouteMatcher(["/admin(.*)", "/(.*)dashboard(.*)"]);

// Define public routes that should be accessible without authentication
const isPublicRoute = createRouteMatcher([
  "/(.*)sign-in(.*)",
  "/(.*)sign-up(.*)",
  "/",
  "/(.*)/news(.*)",
  "/(.*)/companies(.*)",
  "/(.*)/about(.*)",
]);

export default clerkMiddleware(async (authFunc, req) => {
  const pathname = req.nextUrl.pathname;

  // Allow sitemap.xml to be accessed without locale prefix
  if (pathname === "/sitemap.xml") {
    return NextResponse.next();
  }

  // Skip API routes completely - they handle their own routing
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Check if auth is disabled
  const isAuthDisabled = process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";

  // Skip authentication in development mode or when auth is disabled
  if (process.env["NODE_ENV"] === "development" || isAuthDisabled) {
    // Only handle locale redirection
    const pathnameHasLocale = locales.some(
      (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
    );

    if (!pathnameHasLocale) {
      const locale = getLocale(req);
      // Use the host from the request headers to maintain the correct port
      const host = req.headers.get("host") || "localhost:3000";
      const protocol = req.headers.get("x-forwarded-proto") || "http";
      const redirectUrl = new URL(`/${locale}${pathname}`, `${protocol}://${host}`);
      return NextResponse.redirect(redirectUrl, { status: 301 });
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

  // Check if there is any supported locale in the pathname
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  // For paths without locale, add the locale prefix first
  if (!pathnameHasLocale) {
    const locale = getLocale(req);
    // Use the host from the request headers to maintain the correct port
    const host = req.headers.get("host") || "localhost:3000";
    const protocol = req.headers.get("x-forwarded-proto") || "http";
    const redirectUrl = new URL(`/${locale}${pathname}`, `${protocol}://${host}`);
    return NextResponse.redirect(redirectUrl, { status: 301 });
  }

  // Protect routes based on authentication - but allow public routes
  if (isProtectedRoute(req) && !isPublicRoute(req)) {
    // Use authFunc.protect() for protected routes
    await authFunc.protect();

    // For admin routes, check if user has admin metadata
    if (isAdminRoute(req)) {
      const { userId } = await authFunc();
      if (userId) {
        const user = await currentUser();
        const isAdminUser = user?.publicMetadata?.isAdmin === true;

        if (!isAdminUser) {
          // Redirect non-admin users to home page
          const locale = pathname.split("/")[1] || "en";
          const host = req.headers.get("host") || "localhost:3000";
          const protocol = req.headers.get("x-forwarded-proto") || "http";
          const redirectUrl = new URL(`/${locale}`, `${protocol}://${host}`);
          return NextResponse.redirect(redirectUrl, { status: 303 });
        }
      }
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
    // Skip all internal paths (_next, assets, api, data, partytown, and static files)
    "/((?!_next/static|_next/image|assets|data|partytown|favicon.ico|crown.*|robots.txt|sitemap.xml).*)",
  ],
};
