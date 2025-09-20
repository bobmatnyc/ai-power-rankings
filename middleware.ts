import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Check if authentication should be disabled
const isAuthDisabled = process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";

// Supported locales
const locales = ["en", "ja", "zh", "es", "fr", "de", "ko", "pt"];
const defaultLocale = "en";

// Get the preferred locale
function getLocale(request: NextRequest): string {
  // Check if a locale is already in the pathname
  const pathname = request.nextUrl.pathname;
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (pathnameHasLocale) {
    const localeFromPath = pathname.split("/")[1];
    return localeFromPath || defaultLocale;
  }

  // Check Accept-Language header
  const acceptLanguage = request.headers.get("Accept-Language");
  if (acceptLanguage) {
    const detectedLocale = acceptLanguage.split(",")[0]?.split("-")[0]?.toLowerCase();

    if (detectedLocale && locales.includes(detectedLocale)) {
      return detectedLocale;
    }
  }

  return defaultLocale;
}

// Locale redirect middleware
function localeMiddleware(req: NextRequest): NextResponse | undefined {
  const pathname = req.nextUrl.pathname;

  // Skip API routes, static files, and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".") ||
    pathname.startsWith("/admin")
  ) {
    return undefined;
  }

  // Check if the pathname has a locale
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  // Redirect if no locale
  if (!pathnameHasLocale) {
    const locale = getLocale(req);
    const newUrl = new URL(`/${locale}${pathname}`, req.url);
    newUrl.search = req.nextUrl.search;
    return NextResponse.redirect(newUrl);
  }

  return undefined;
}

// Import Clerk conditionally
let clerkMiddleware: any = null;
let createRouteMatcher: any = null;

if (!isAuthDisabled) {
  try {
    const clerkModule = require("@clerk/nextjs/server");
    clerkMiddleware = clerkModule.clerkMiddleware;
    createRouteMatcher = clerkModule.createRouteMatcher;
  } catch (error) {
    console.warn("Clerk not available, running in no-auth mode");
  }
}

// Define protected routes
const isProtectedRoute = createRouteMatcher
  ? createRouteMatcher(["/admin(.*)", "/dashboard(.*)"])
  : () => false;

// Create the Clerk middleware if available
const authMiddleware = clerkMiddleware
  ? clerkMiddleware(async (auth: any, req: NextRequest) => {
      // Protect admin routes
      if (isProtectedRoute(req)) {
        await auth.protect();
      }

      // Handle locale redirects
      const localeResponse = localeMiddleware(req);
      if (localeResponse) {
        return localeResponse;
      }

      return NextResponse.next();
    })
  : null;

// Export the middleware
export default function middleware(req: NextRequest) {
  // If auth is disabled or Clerk is not available, only handle locale redirects
  if (isAuthDisabled || !authMiddleware) {
    return localeMiddleware(req) || NextResponse.next();
  }

  // If auth is enabled, use Clerk middleware
  return authMiddleware(req);
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
