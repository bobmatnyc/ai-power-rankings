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

  // Handle admin authentication
  if (pathname.includes("/admin") && !pathname.includes("/admin/auth")) {
    if (!req.auth?.user || req.auth.user.email !== "bob@matsuoka.com") {
      const locale = getLocale(req);
      return NextResponse.redirect(new URL(`/${locale}/admin/auth/signin`, req.url));
    }
  }

  // Check if there is any supported locale in the pathname
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (pathnameHasLocale) {
    return NextResponse.next();
  }

  // Redirect if there is no locale
  const locale = getLocale(req);
  req.nextUrl.pathname = `/${locale}${pathname}`;
  return NextResponse.redirect(req.nextUrl);
});

export const config = {
  matcher: [
    // Skip all internal paths (_next, assets, api)
    "/((?!api|_next/static|_next/image|assets|favicon.ico|crown-of-technology.png|robots.txt).*)",
  ],
};
