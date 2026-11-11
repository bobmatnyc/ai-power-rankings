import { NextResponse, type NextRequest } from "next/server";
import { isLocale } from "@/i18n/config";
import { RESERVED_FIRST_SEGMENTS } from "@/lib/seo/url-table";

/** A path no route matches, so Next.js renders `app/global-not-found.tsx` (404). `/_not-found` itself matches `[lang]`. */
export const UNMATCHED_PATH = "/en/__not-found";

/**
 * Sends a page path whose first segment is not a locale to the site 404.
 *
 * Why: #443 made `app/[lang]/layout.tsx` a root layout so `<html lang>` is the
 *   route locale. Its #340 `notFound()` for a segment that is not a locale
 *   (`/pricing`) now has no not-found boundary above it, so Next.js answered
 *   its bare built-in 404 instead of the site's "Page Not Found" page.
 * What: for a path with no dot (so no public file, sitemap or robots.txt) whose
 *   first segment is a plain word (no `_` or `%`, so no `/_vercel` or
 *   `/__nextjs`) that is neither a locale nor one of the url table's
 *   `RESERVED_FIRST_SEGMENTS` (app and public roots outside `[lang]`, Clerk's
 *   pages), rewrites to `UNMATCHED_PATH`, which renders
 *   `app/global-not-found.tsx` with status 404. Every other path, `/`
 *   included, returns null. A path with a dot still reaches the layout's
 *   `notFound()`, a 404 with the built-in page. `middleware.ts` skips it for
 *   a protected path, which keeps its sign-in redirect.
 * Test: `tests/unit/html-lang-dates-443.test.tsx`.
 */
export function localeNotFoundRewrite(req: NextRequest): NextResponse | null {
  const pathname = req.nextUrl.pathname;
  if (pathname.includes(".")) return null;
  const first = pathname.split("/")[1] ?? "";
  if (!/^[A-Za-z0-9-]+$/.test(first) || isLocale(first) || RESERVED_FIRST_SEGMENTS.has(first.toLowerCase())) return null;
  const target = req.nextUrl.clone();
  target.pathname = UNMATCHED_PATH;
  return NextResponse.rewrite(target);
}
