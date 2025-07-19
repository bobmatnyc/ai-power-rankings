import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAuthorizedEmail } from "@/lib/auth-config";
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

export default auth((req) => {
  const pathname = req.nextUrl.pathname;

  // Allow sitemap.xml to be accessed without locale prefix
  if (pathname === "/sitemap.xml") {
    return NextResponse.next();
  }

  // Skip Payload CMS admin and API routes completely - they handle their own routing
  if (pathname.startsWith("/admin") || pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Skip authentication in development mode
  if (process.env["NODE_ENV"] === "development") {
    // Only handle locale redirection in development
    const pathnameHasLocale = locales.some(
      (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
    );

    if (!pathnameHasLocale) {
      const locale = getLocale(req);
      req.nextUrl.pathname = `/${locale}${pathname}`;
      return NextResponse.redirect(req.nextUrl);
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

  // Special handling for /dashboard without locale
  if (pathname === "/dashboard") {
    // Check auth first
    if (!req.auth?.user || !isAuthorizedEmail(req.auth.user.email)) {
      const locale = getLocale(req);
      return NextResponse.redirect(new URL(`/${locale}/dashboard/auth/signin`, req.url));
    }
    // If authenticated, add locale and redirect
    const locale = getLocale(req);
    req.nextUrl.pathname = `/${locale}/dashboard`;
    return NextResponse.redirect(req.nextUrl);
  }

  // Check if there is any supported locale in the pathname
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  // For paths without locale, add the locale prefix first
  if (!pathnameHasLocale) {
    const locale = getLocale(req);
    req.nextUrl.pathname = `/${locale}${pathname}`;
    return NextResponse.redirect(req.nextUrl);
  }

  // Handle our custom dashboard authentication (after locale is ensured)
  if (pathname.includes("/dashboard") && !pathname.includes("/dashboard/auth")) {
    if (!req.auth?.user || !isAuthorizedEmail(req.auth.user.email)) {
      // Extract locale from the pathname
      const locale = pathname.split("/")[1] || getLocale(req);
      return NextResponse.redirect(new URL(`/${locale}/dashboard/auth/signin`, req.url));
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
    // Skip all internal paths (_next, assets, api, data, and static files)
    "/((?!api|_next/static|_next/image|assets|data|favicon.ico|crown.*|robots.txt|sitemap.xml).*)",
  ],
};
