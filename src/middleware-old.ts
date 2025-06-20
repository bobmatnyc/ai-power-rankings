import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withAuth } from "next-auth/middleware";
import { i18n } from "./i18n/config";

const locales = i18n.locales;

function getLocale(_request: NextRequest): string {
  // For now, we'll use the default locale
  // In the future, we can implement browser language detection
  return i18n.defaultLocale;
}

function handleI18nRouting(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Handle OAuth routes with CORS
  if (pathname === "/.well-known/oauth-authorization-server" || pathname === "/register") {
    const response = NextResponse.next();
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: response.headers });
    }
    return response;
  }

  // Check if there is any supported locale in the pathname
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (pathnameHasLocale) {
    return NextResponse.next();
  }

  // Redirect if there is no locale
  const locale = getLocale(request);
  request.nextUrl.pathname = `/${locale}${pathname}`;
  return NextResponse.redirect(request.nextUrl);
}

// Auth middleware for admin routes
const authMiddleware = withAuth(
  function middleware(req) {
    // First handle i18n routing
    const i18nResponse = handleI18nRouting(req);
    if (i18nResponse.status !== 200) {
      return i18nResponse;
    }

    // Then handle admin authentication
    const pathname = req.nextUrl.pathname;
    if (pathname.includes("/admin") && !pathname.includes("/admin/auth")) {
      if (!req.nextauth.token?.["isAdmin"]) {
        const locale = getLocale(req);
        return NextResponse.redirect(new URL(`/${locale}/admin/auth/signin`, req.url));
      }
    }
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname;

        // Allow access to auth pages without authentication
        if (pathname.includes("/admin/auth")) {
          return true;
        }

        // For admin routes, require authentication and admin role
        if (pathname.includes("/admin")) {
          return !!token?.["isAdmin"];
        }

        // Allow all other routes
        return true;
      },
    },
  }
);

export function middleware(request: NextRequest) {
  // Use auth middleware if it's an admin route, otherwise use i18n routing
  if (request.nextUrl.pathname.includes("/admin")) {
    return (authMiddleware as any)(request, {} as any);
  }

  return handleI18nRouting(request);
}

export const config = {
  matcher: [
    // Skip all internal paths (_next, assets, api)
    "/((?!api|_next/static|_next/image|assets|favicon.ico|crown-of-technology.png|robots.txt).*)",
  ],
};
