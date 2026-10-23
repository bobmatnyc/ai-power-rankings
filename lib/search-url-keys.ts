import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Query keys that carry a search term (#233).
 *
 * `term` was the rankings search key; the other five are the keys GA4
 * enhanced measurement reads as a site search.
 */
export const SEARCH_URL_KEYS: ReadonlySet<string> = new Set([
  "term",
  "search",
  "q",
  "s",
  "query",
  "keyword",
]);

function decodeKey(raw: string): string {
  try {
    return decodeURIComponent(raw.replace(/\+/g, " "));
  } catch {
    // A malformed escape is compared as written.
    return raw;
  }
}

/**
 * Redirects a page request that carries a search term to the same URL without it.
 *
 * Why: #233 — a search term in a page URL reaches GA4 as `page_location` (and as
 *   `view_search_results`) before any client code could remove it. A redirect
 *   response has no HTML, so gtag never runs on the URL with the term.
 * What: For GET and HEAD outside `/api` and `/_next`, drops every query pair
 *   whose decoded key is in `SEARCH_URL_KEYS` (case-insensitive, repeats
 *   included) and returns a 308 to the remaining URL. Other pairs keep their
 *   order and original encoding. Returns null when nothing is dropped, so the
 *   caller continues. `/api` is excluded because `/api/companies` reads `search`.
 * Test: `tests/unit/search-term-redaction-233.test.ts` ("middleware").
 */
export function searchKeyRedirect(req: NextRequest): NextResponse | null {
  if (req.method !== "GET" && req.method !== "HEAD") return null;
  // The raw path, not nextUrl.pathname: NextURL rewrites /_next/data/<build>/x.json to /x.
  const path = new URL(req.url).pathname.toLowerCase();
  if (/^\/(api|_next)(\/|$)/.test(path)) return null;

  const query = req.nextUrl.search.slice(1);
  if (!query) return null;
  const pairs = query.split("&");
  const kept = pairs.filter((pair) => {
    const rawKey = pair.split("=", 1)[0] ?? "";
    return !SEARCH_URL_KEYS.has(decodeKey(rawKey).toLowerCase());
  });
  if (kept.length === pairs.length) return null;

  const target = req.nextUrl.clone();
  target.search = kept.length ? `?${kept.join("&")}` : "";
  return NextResponse.redirect(target, 308);
}
