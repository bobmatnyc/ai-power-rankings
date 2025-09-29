import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { i18n } from "./i18n/config";

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

// Main middleware function - handle conditionally based on environment
export async function middleware(req: NextRequest): Promise<NextResponse> {
  const pathname = req.nextUrl.pathname;

  // Handle OPTIONS requests for CORS (prevents 400 errors from preflight requests)
  if (req.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

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

  // Check if auth is disabled - this must work at edge runtime
  // In edge runtime, we can't rely on process.env, so we check a special header
  // or just skip auth entirely for non-production environments
  const host = req.headers.get("host") || "";
  const isProduction = host.includes("aipowerranking.com") && !host.includes("staging");

  // For staging and local development, skip auth completely
  if (!isProduction) {
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
  }

  // Only use Clerk middleware in production
  try {
    const { clerkMiddleware, createRouteMatcher } = await import('@clerk/nextjs/server');

    // Re-create route matchers using Clerk's functions
    const isClerkProtectedRoute = createRouteMatcher([
      '/(.*)admin(.*)',
      '/(.*)dashboard(.*)'
    ]);

    const isClerkPublicRoute = createRouteMatcher([
      '/',
      '/(.*)sign-in(.*)',
      '/(.*)sign-up(.*)',
      '/(.*)/news(.*)',
      '/(.*)/companies(.*)',
      '/(.*)/about(.*)',
      '/api/health(.*)',
      '/api/public(.*)'
    ]);

    // Use Clerk middleware
    const middlewareResult = await clerkMiddleware(async (auth, clerkReq) => {
      // For protected routes, check authentication
      if (isClerkProtectedRoute(clerkReq) && !isClerkPublicRoute(clerkReq)) {
        const { userId } = await auth();

        if (!userId) {
          // Redirect to sign-in page
          const locale = pathname.split("/")[1] || "en";
          const host = clerkReq.headers.get("host") || "localhost:3001";
          const protocol = clerkReq.headers.get("x-forwarded-proto") || "http";
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
    })(req, {} as any); // Pass req and empty context

    // If middleware returns undefined or not a NextResponse, allow the request to proceed
    if (!middlewareResult || !(middlewareResult instanceof NextResponse)) {
      return NextResponse.next();
    }
    return middlewareResult;
  } catch (error) {
    console.warn("Failed to load Clerk middleware:", error);
    // If Clerk fails to load, allow the request to proceed
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next/static|_next/image|assets|data|partytown|favicon.ico|crown.*|robots.txt|sitemap.xml).*)',
    // Include API routes for conditional handling
    '/(api|trpc)(.*)',
  ],
}