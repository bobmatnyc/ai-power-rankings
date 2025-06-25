import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { i18n } from "./i18n/config";

const locales = i18n.locales;

function getLocale(_request: NextRequest): string {
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
    if (!req.auth?.user || req.auth.user.email !== "bob@matsuoka.com") {
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
    if (!req.auth?.user || req.auth.user.email !== "bob@matsuoka.com") {
      // Extract locale from the pathname
      const locale = pathname.split("/")[1] || getLocale(req);
      return NextResponse.redirect(new URL(`/${locale}/dashboard/auth/signin`, req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip all internal paths (_next, assets, api)
    "/((?!api|_next/static|_next/image|assets|favicon.ico|crown-of-technology.png|robots.txt|sitemap.xml).*)",
  ],
};
