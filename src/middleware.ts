import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { i18n } from "./i18n/config";

// Simple route matchers following Clerk's official patterns
const isProtectedRoute = createRouteMatcher([
  '/(.*)admin(.*)',
  '/(.*)dashboard(.*)'
])

const isPublicRoute = createRouteMatcher([
  '/',
  '/(.*)sign-in(.*)',
  '/(.*)sign-up(.*)',
  '/(.*)/news(.*)',
  '/(.*)/companies(.*)',
  '/(.*)/about(.*)',
  '/api/health(.*)',
  '/api/public(.*)'
])

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
        const langCode = lang.toLowerCase();
        if (langCode.startsWith("zh")) return "zh";
        if (langCode.startsWith("ja")) return "ja";
        if (langCode.startsWith("de")) return "de";
        if (langCode.startsWith("fr")) return "fr";
        if (langCode.startsWith("it")) return "it";
        if (langCode.startsWith("ko")) return "ko";
        if (langCode.startsWith("uk")) return "uk";
        if (langCode.startsWith("hr")) return "hr";
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

function handleLocaleRedirection(req: NextRequest): NextResponse | null {
  const pathname = req.nextUrl.pathname;

  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (!pathnameHasLocale) {
    const locale = getLocale(req);
    const host = req.headers.get("host") || "localhost:3001";
    const protocol = req.headers.get("x-forwarded-proto") || "http";
    const localePath = `/${locale}${pathname}`;
    const baseUrl = `${protocol}://${host}`;
    const redirectUrl = new URL(localePath, baseUrl);
    return NextResponse.redirect(redirectUrl, { status: 301 });
  }

  return null;
}

export default clerkMiddleware(async (auth, req) => {
  const pathname = req.nextUrl.pathname;

  // Skip API routes - they handle their own auth
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Allow sitemap.xml without locale prefix
  if (pathname === '/sitemap.xml') {
    return NextResponse.next();
  }

  // Handle locale redirection first
  const localeResponse = handleLocaleRedirection(req);
  if (localeResponse) {
    return localeResponse;
  }

  // Check if auth is disabled via environment variable
  const isAuthDisabled = process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";

  // If auth is disabled, allow all routes
  if (isAuthDisabled) {
    return NextResponse.next();
  }

  // For protected routes, check authentication
  if (isProtectedRoute(req) && !isPublicRoute(req)) {
    const { userId } = await auth();

    if (!userId) {
      // Redirect to sign-in page
      const locale = pathname.split("/")[1] || "en";
      const host = req.headers.get("host") || "localhost:3001";
      const protocol = req.headers.get("x-forwarded-proto") || "http";
      const signInPath = `/${locale}/sign-in`;
      const baseUrl = `${protocol}://${host}`;
      const redirectUrl = new URL(signInPath, baseUrl);
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Add security headers
  const response = NextResponse.next();
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");

  // Cache static assets
  if (pathname.includes("/_next/static")) {
    response.headers.set("Cache-Control", "public, max-age=31536000, immutable");
  }

  return response;
})

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next/static|_next/image|assets|data|partytown|favicon.ico|crown.*|robots.txt|sitemap.xml).*)',
    // Include API routes for conditional handling
    '/(api|trpc)(.*)',
  ],
}