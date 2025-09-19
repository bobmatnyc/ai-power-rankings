import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Conditionally import Clerk only if auth is enabled
const isAuthDisabled = process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";

// Lazy loading for Clerk middleware when auth is enabled
let clerkMiddleware: any = null;
let isProtectedRoute: any = () => false;

// Function to initialize Clerk middleware if needed
async function initializeClerkMiddleware() {
  if (isAuthDisabled || clerkMiddleware) {
    return;
  }

  try {
    const { clerkMiddleware: clerkMw, createRouteMatcher } = await import("@clerk/nextjs/server");
    clerkMiddleware = clerkMw;

    // Define protected routes
    isProtectedRoute = createRouteMatcher(["/admin(.*)", "/dashboard(.*)"]);
  } catch (error) {
    console.warn("Clerk not available, running in no-auth mode");
  }
}

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

// Export the appropriate middleware based on auth configuration
export default async function middleware(req: NextRequest) {
  // If auth is disabled, only handle locale redirects
  if (isAuthDisabled) {
    return localeMiddleware(req);
  }

  // Initialize Clerk middleware if needed
  await initializeClerkMiddleware();

  // If Clerk is not available, fall back to locale middleware only
  if (!clerkMiddleware) {
    return localeMiddleware(req);
  }

  // If auth is enabled, use Clerk middleware with locale handling
  return clerkMiddleware((auth: any, req: NextRequest) => {
    // Protect admin routes
    if (isProtectedRoute(req)) {
      auth().protect();
    }

    // Handle locale redirects
    return localeMiddleware(req);
  })(req);
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
