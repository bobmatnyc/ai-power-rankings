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

/** Paths that require a signed-in user. Checked before the public list. */
export const PROTECTED_ROUTE_PATTERNS = [
  "/:locale/admin(.*)",
  "/:locale/dashboard(.*)",
  "/api/admin(.*)",
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

/** Classifies a request; a protected match wins over any public match. */
export function routeAccess(req: NextRequest): RouteAccess {
  if (isProtectedRoute(req)) return "protected";
  if (isPublicRoute(req)) return "public";
  return "default";
}
