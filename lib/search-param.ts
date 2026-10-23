/**
 * The rankings search URL query key (#175).
 *
 * Why: GA4 enhanced measurement reads the query keys q, s, search, query and
 *   keyword as a site search and sends the raw term as
 *   `view_search_results.search_term`. The key was `search`.
 * What: `SEARCH_PARAM` is the key written by every URL that carries a search
 *   term. `readSearchTerm` reads it and falls back to the pre-rename `search`
 *   key so old deep links keep working. Not a client module, so server
 *   components (the schema.org SearchAction) can import the constant.
 * Test: `tests/unit/analytics-events.test.tsx` ("site_search"),
 *   `tests/unit/seo-canonical-origin.test.ts` (SearchAction urlTemplate).
 */
export const SEARCH_PARAM = "term";

/** Pre-#175 key; read only, never written. */
export const LEGACY_SEARCH_PARAM = "search";

export function readSearchTerm(params: { get(name: string): string | null }): string {
  return params.get(SEARCH_PARAM) || params.get(LEGACY_SEARCH_PARAM) || "";
}
