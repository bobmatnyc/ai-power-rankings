import { createRouteMatcher } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { locales } from "@/i18n/config";

/**
 * Route access classification used by `middleware.ts`.
 *
 * Why: The middleware used to check the public list first, and public entries
 * such as `/(.*)/tools(.*)` had an unanchored prefix. They matched admin API
 * paths and dashboard pages, so those requests skipped authentication.
 * What: Protected patterns are checked first and always win. Public patterns
 * are anchored to a real locale segment (or name an exact `/api/...` prefix),
 * so they cannot match `/api/admin/...` or `/<locale>/dashboard/...`.
 * Test: `tests/unit/middleware-route-access.test.ts`.
 */

/** Locale segment restricted to the configured locales, e.g. `(en|de|fr)`. */
const LOCALE = `:locale(${locales.join("|")})`;

/**
 * Paths that require a signed-in user. Checked before the public list.
 * `/api/data` and `/api/ai` are admin-only; their handlers also call
 * `requireAdmin()`, and no public page calls them.
 */
export const PROTECTED_ROUTE_PATTERNS = [
  "/:locale/admin(.*)",
  "/:locale/dashboard(.*)",
  "/api/admin(.*)",
  "/api/data(.*)",
  "/api/ai(.*)",
];

/**
 * Paths served to anonymous visitors without an auth lookup. Paths in neither
 * list still pass through; the auth lookup only runs for them.
 */
export const PUBLIC_ROUTE_PATTERNS = [
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  `/${LOCALE}/sign-in(.*)`,
  `/${LOCALE}/sign-up(.*)`,
  // #226: static page for signed-out visitors; exact match, no session lookup.
  `/${LOCALE}/unauthorized`,
  "/api/public(.*)",
  "/api/health(.*)",
  "/api/rankings(.*)",
  "/api/tools(.*)",
  "/api/news(.*)",
  "/api/og(.*)",
  "/api/cron(.*)", // Cron jobs authenticate via CRON_SECRET, not Clerk
  "/api/whats-new(.*)", // Public API for monthly summaries
  `/${LOCALE}/news(.*)`,
  `/${LOCALE}/rankings(.*)`,
  `/${LOCALE}/tools(.*)`,
  `/${LOCALE}/about(.*)`,
  `/${LOCALE}/methodology(.*)`,
  `/${LOCALE}/trending(.*)`,
  `/${LOCALE}/privacy(.*)`,
  `/${LOCALE}/terms(.*)`,
  `/${LOCALE}/contact(.*)`,
];

export const isProtectedRoute = createRouteMatcher(PROTECTED_ROUTE_PATTERNS);
export const isPublicRoute = createRouteMatcher(PUBLIC_ROUTE_PATTERNS);

export type RouteAccess = "protected" | "public" | "default";

/**
 * The forms of a pathname that Next can route: the raw form and, when it
 * decodes, its single `decodeURIComponent` form.
 *
 * Why: `req.nextUrl.pathname` is a WHATWG `URL.pathname`, which keeps percent
 * escapes, so `/en/%61dmin` reached the matchers undecoded and classed
 * `default` (#228). Next's own route lookup tries the raw path and then one
 * `decodeURIComponent` of it, ignoring a decode error.
 * What: Returns `[raw]`, or `[raw, decoded]` when one decode succeeds and
 * changes the path. Never decodes twice and never throws.
 * Test: `tests/unit/route-access-encoded-228.test.ts`.
 */
export function pathForms(raw: string): string[] {
  // #228: decode once, as Next's router does; a malformed escape keeps only the raw form.
  try {
    const decoded = decodeURIComponent(raw);
    return decoded === raw ? [raw] : [raw, decoded];
  } catch {
    return [raw];
  }
}

/**
 * Runs a Clerk route matcher on a bare pathname. A matcher built from a
 * pattern list reads only `req.nextUrl.pathname`, so a shim carrying that
 * field avoids `new URL()`, which would normalise the decoded path further.
 */
function matchesPath(matcher: (req: NextRequest) => boolean, pathname: string): boolean {
  return matcher({ nextUrl: { pathname } } as unknown as NextRequest);
}

/**
 * Classifies a request; a protected match wins over any public match.
 * #228: protected when the raw OR the once-decoded path is protected (fail
 * closed); public only when the raw path is public, so decoding never widens
 * public access.
 */
export function routeAccess(req: NextRequest): RouteAccess {
  const forms = pathForms(req.nextUrl.pathname);
  if (forms.some((pathname) => matchesPath(isProtectedRoute, pathname))) return "protected";
  if (isPublicRoute(req)) return "public";
  return "default";
}

/**
 * #228: an anonymous protected request gets a 401 instead of a sign-in
 * redirect when the raw OR the once-decoded path is under `/api/`, matching
 * `routeAccess`. Case-insensitive, like the route matchers.
 */
export function isApiPath(raw: string): boolean {
  return pathForms(raw).some((pathname) => pathname.toLowerCase().startsWith("/api/"));
}
