import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import { localeNotFoundRewrite } from "./lib/locale-not-found-rewrite";
import { openWeightRewrite } from "./lib/rankings/open-weight-view";
import { isApiPath, needsClerk, routeAccess } from "./lib/route-access";
import { searchKeyRedirect } from "./lib/search-url-keys";
import { heldSourceRewrite, urlTableRedirect } from "./lib/url-table-redirect";

// Quick Win #4: Only log in development to save 10-30ms TTFB in production
const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * The `NEXT_PUBLIC_DISABLE_AUTH` answer: a 403 in production, a pass-through
 * elsewhere, or null when auth is enabled. Runs on every matched path, with or
 * without Clerk, as it did when Clerk wrapped every path.
 */
function authDisabledResponse(): NextResponse | null {
  if (process.env.NEXT_PUBLIC_DISABLE_AUTH !== "true") return null;
  // SECURITY: Prevent auth bypass in production
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    console.error("[SECURITY] Auth bypass attempted in production environment - BLOCKING");
    return NextResponse.json(
      { error: "Security violation: Authentication cannot be disabled in production" },
      { status: 403 }
    );
  }

  if (isDevelopment) {
    console.log("[middleware] Auth disabled in development, skipping checks");
  }
  return NextResponse.next();
}

/**
 * Request middleware: URL redirects for every matched path, then Clerk only
 * where auth is used.
 *
 * Why: #368 — Clerk's middleware on a public page marks the response as
 *   per-user, so no public page was served from the edge cache.
 * What: Runs the #191 table redirect, the #233 search-key strip and the #340
 *   held-source rewrite for every matched path, as before, then the #195
 *   open-weight rewrite (`openWeightRewrite`), then the #443 site 404 for a
 *   first segment that is not a locale (`localeNotFoundRewrite`). A path that
 *   `needsClerk()` (API, admin, dashboard, sign-in/up and the rest of the
 *   `(authenticated)` group) then runs `clerkHandler`, unchanged. Any other
 *   path gets the auth-disabled answer or passes through without Clerk.
 * Test: `tests/unit/middleware-clerk-scope-368.test.ts`,
 *   `tests/unit/middleware-route-access.test.ts`.
 */
export default function middleware(req: NextRequest, event: NextFetchEvent) {
  // #191: the signed URL table's 308s, first, so a table source never takes two hops.
  const moved = urlTableRedirect(req);
  if (moved) return moved;

  // #233: strip search-term keys from page URLs before any HTML (and gtag) loads; runs even with auth disabled.
  const stripped = searchKeyRedirect(req);
  if (stripped) return stripped;

  // #340: a held non-locale source keeps rendering, from its held /en page.
  const held = heldSourceRewrite(req);
  if (held) return held;

  // #195: `/rankings/models?open=1` is served by its static open-weight route, so the board page stays ISR.
  const openWeight = openWeightRewrite(req);
  if (openWeight) return openWeight;

  // #443: a first segment that is not a locale gets the site 404; the [lang] root layout's notFound() has no boundary above it.
  const notLocale = routeAccess(req) === "protected" ? null : localeNotFoundRewrite(req);
  if (notLocale) return notLocale;

  // #368: Clerk runs only where auth is used; public pages skip it so the edge can cache them.
  if (needsClerk(req)) return clerkHandler(req, event);
  return authDisabledResponse() ?? NextResponse.next();
}

const clerkHandler = clerkMiddleware(async (auth, req: NextRequest) => {
  // Check if auth is disabled for development/testing
  const disabled = authDisabledResponse();
  if (disabled) return disabled;

  const pathname = req.nextUrl.pathname;
  if (isDevelopment) {
    console.log("[middleware] Processing request:", pathname);
  }

  // Protected patterns are checked before public ones; see lib/route-access.ts.
  const access = routeAccess(req);

  // Allow public routes without authentication check
  if (access === "public") {
    if (isDevelopment) {
      console.log("[middleware] Public route, allowing access:", pathname);
    }
    return NextResponse.next();
  }

  // Use await with auth() to properly read the session
  const authData = await auth();
  const { userId, sessionId } = authData;

  if (isDevelopment) {
    console.log("[middleware] Auth data:", {
      pathname,
      userId: userId || "null",
      sessionId: sessionId || "null",
      access,
      headers: {
        cookie: req.headers.get("cookie")?.substring(0, 50) + "...",
      }
    });
  }

  // For protected routes, use Clerk's protect() method which handles auth automatically
  if (access === "protected") {
    if (!userId) {
      // API callers get a 401 JSON body; a sign-in redirect is only useful to a browser.
      // Case-insensitive, matching the protected-route matcher in lib/route-access.ts.
      // #228: checks the raw and the once-decoded path, as routeAccess() does.
      if (isApiPath(pathname)) {
        return NextResponse.json(
          { error: "Unauthorized", message: "Authentication required", code: "AUTH_REQUIRED" },
          // #325: this refusal runs before any route's no-store wrapper, so it sets its own.
          { status: 401, headers: { "Cache-Control": "no-store" } }
        );
      }
      if (isDevelopment) {
        console.log("[middleware] Protected route without userId, redirecting to sign-in");
      }
      // Get the locale from the URL
      const locale = pathname.split("/")[1] || "en";

      // Build the sign-in URL
      const signInUrl = new URL(`/${locale}/sign-in`, req.url);

      // SECURITY: Validate redirect URL is internal only (prevent open redirect)
      // Allow: /en/admin, /en/dashboard
      // Block: //evil.com, https://evil.com, /\evil.com
      const isInternalPath = pathname.startsWith('/') && !pathname.startsWith('//') && !pathname.startsWith('/\\');
      const safeRedirect = isInternalPath ? pathname : `/${locale}/admin`;

      signInUrl.searchParams.set("redirect_url", safeRedirect);

      return NextResponse.redirect(signInUrl);
    }
    if (isDevelopment) {
      console.log("[middleware] Protected route with valid userId, allowing access");
    }
  }

  if (isDevelopment) {
    console.log("[middleware] Allowing access to:", pathname);
  }
  // For all other routes, continue normally
  return NextResponse.next();
});

// #368: the matcher stays broad because the redirects above run for every page; needsClerk() scopes Clerk.
export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
    // Always run for the protected page trees; mirrors the page entries of
    // PROTECTED_ROUTE_PATTERNS in lib/route-access.ts.
    '/:locale/admin(.*)',
    '/:locale/dashboard(.*)',
  ],
};
