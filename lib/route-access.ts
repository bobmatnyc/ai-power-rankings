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
 * True for the error Clerk's path matcher throws on a path it cannot decode.
 * Checked by name, as Clerk itself does, because the class can be bundled
 * more than once.
 */
function isMalformedURLError(e: unknown): boolean {
  return e instanceof Error && e.name === "MalformedURLError";
}

/**
 * Runs a Clerk route matcher on one exact pathname form.
 *
 * Why: From `@clerk/shared` 3.48 the matcher runs `decodeURI` on the path
 * before matching. That decodes a form `pathForms` already decoded a second
 * time, and it throws `MalformedURLError` on a malformed escape.
 * What: Escapes every `%` as `%25`, so Clerk's `decodeURI` gives back exactly
 * `pathname` and the matcher sees the form chosen here. A matcher built from a
 * pattern list reads only `req.nextUrl.pathname`, so the shim avoids
 * `new URL()`. If Clerk still reports a malformed URL, returns `onMalformed`.
 * Test: `tests/unit/route-access-encoded-228.test.ts`.
 */
function matchesPath(
  matcher: (req: NextRequest) => boolean,
  pathname: string,
  onMalformed: boolean
): boolean {
  // #386: Clerk 6.39 decodes inside the matcher; escape `%` so it decodes back to this form. See #228.
  const shim = { nextUrl: { pathname: pathname.replace(/%/g, "%25") } } as unknown as NextRequest;
  try {
    return matcher(shim);
  } catch (e) {
    // #386: a path Clerk cannot decode fails closed: protected, never public.
    if (isMalformedURLError(e)) return onMalformed;
    throw e;
  }
}

/**
 * Classifies a request; a protected match wins over any public match.
 * #228: protected when the raw OR the once-decoded path is protected (fail
 * closed); public only when the raw path is public, so decoding never widens
 * public access.
 * #386: a path the matcher reports as malformed classes protected.
 */
export function routeAccess(req: NextRequest): RouteAccess {
  const forms = pathForms(req.nextUrl.pathname);
  if (forms.some((pathname) => matchesPath(isProtectedRoute, pathname, true))) return "protected";
  if (matchesPath(isPublicRoute, forms[0], false)) return "public";
  return "default";
}

/**
 * Page trees that need Clerk's middleware even though `routeAccess()` may
 * class them public or default: every top-level folder of the
 * `app/[lang]/(authenticated)/` route group, whose layout mounts ClerkProvider,
 * plus the bare sign-in and sign-up paths.
 */
export const CLERK_PAGE_PATTERNS = [
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/:locale/admin(.*)",
  "/:locale/dashboard(.*)",
  "/:locale/sign-in(.*)",
  "/:locale/sign-up(.*)",
  "/:locale/clerk-debug(.*)",
  "/:locale/unauthorized(.*)",
];

const isClerkPage = createRouteMatcher(CLERK_PAGE_PATTERNS);

/**
 * Whether a request must run through `clerkMiddleware`.
 *
 * Why: #368 — Clerk's middleware ran on every page, so public pages carried
 *   `x-clerk-auth-status` and could not be served from the edge cache. Clerk's
 *   server `auth()` only works on a request that went through the middleware.
 * What: True for every API path (`/api/*`, `/trpc/*`; route handlers call
 *   `auth()` and `requireAdmin()`), every `PROTECTED_ROUTE_PATTERNS` path,
 *   and every `CLERK_PAGE_PATTERNS` page. It checks the raw path and up to
 *   three successive decodes of it (more than `routeAccess()`'s one) and
 *   answers true when any form matches, so an encoded admin-looking path
 *   still runs Clerk: decoding can only add Clerk, never remove it.
 *   Everything else, the public pages, skips Clerk.
 * Test: `tests/unit/middleware-clerk-scope-368.test.ts`.
 */
export function needsClerk(req: NextRequest): boolean {
  const forms = [req.nextUrl.pathname];
  let current = req.nextUrl.pathname;
  for (let i = 0; i < 3; i++) {
    const decoded = pathForms(current)[1];
    if (decoded === undefined) break;
    forms.push(decoded);
    current = decoded;
  }
  if (forms.some((pathname) => pathname.toLowerCase().startsWith("/api/"))) return true;
  if (forms.some((pathname) => /^\/trpc(\/|$)/i.test(pathname))) return true;
  // #388: a path Clerk cannot decode still goes through Clerk (fail closed).
  return forms.some(
    (pathname) => matchesPath(isProtectedRoute, pathname, true) || matchesPath(isClerkPage, pathname, true)
  );
}

/**
 * #228: an anonymous protected request gets a 401 instead of a sign-in
 * redirect when the raw OR the once-decoded path is under `/api/`, matching
 * `routeAccess`. Case-insensitive, like the route matchers.
 */
export function isApiPath(raw: string): boolean {
  return pathForms(raw).some((pathname) => pathname.toLowerCase().startsWith("/api/"));
}
