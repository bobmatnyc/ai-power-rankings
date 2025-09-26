import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Check if authentication should be disabled - for staging, auth is disabled
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

  // Skip API routes, static files, Next.js internals, and specific test routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/simple-test") // Allow simple test page without locale
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

// Export the middleware - simplified for staging where auth is disabled
export default function middleware(req: NextRequest) {
  // For staging with auth disabled, only handle locale redirects
  if (isAuthDisabled) {
    return localeMiddleware(req) || NextResponse.next();
  }

  // For production with auth enabled, we would handle Clerk here
  // But for now, staging uses simplified middleware
  return localeMiddleware(req) || NextResponse.next();
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
