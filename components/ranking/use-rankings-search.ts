"use client";

import { useEffect, useRef } from "react";
import { queryLengthBucket, trackEvent } from "@/lib/analytics/track";

interface SearchableRanking {
  // #175: typed as the API actually delivers them, not as the UI hopes.
  tool: {
    id?: string | null;
    slug?: string | null;
    name?: string | null;
    category?: string | null;
  };
}

/** #233: site_search waits this long after the last keystroke, so one search sends one event. */
export const SITE_SEARCH_DEBOUNCE_MS = 800;

/**
 * Filters rankings by the search term and reports the search to GA4.
 *
 * Why: #175 needs a search event. #233 keeps the term out of every URL, so the
 *   term comes from the rankings search box (client state), never a query key.
 * What: Case-insensitive substring match on tool name, slug (else id) and
 *   category; a null or undefined field is skipped, not matched.
 *   An empty term returns `rankings` unchanged and sends nothing. Once `ready`
 *   (rankings loaded) and the term has not changed for
 *   `SITE_SEARCH_DEBOUNCE_MS`, sends one `site_search` per settled term with
 *   the query length, its bucket and the result count — never the term itself.
 * Test: `tests/unit/analytics-events.test.tsx` ("site_search").
 */
export function useRankingsSearch<T extends SearchableRanking>(
  rankings: T[],
  rawTerm: string,
  ready: boolean
): T[] {
  const term = rawTerm.trim().toLowerCase();
  const results = term
    ? rankings.filter(({ tool }) =>
        // #175: the rankings API passes these through unchecked; any may be null/undefined.
        [tool.name, tool.slug ?? tool.id, tool.category].some(
          (field) => typeof field === "string" && field.toLowerCase().includes(term)
        )
      )
    : rankings;

  const tracked = useRef<string | null>(null);
  const resultCount = results.length;
  useEffect(() => {
    // #233: a cleared box ends the search, so typing the same term again is a new search.
    if (!term) tracked.current = null;
    if (!term || !ready || tracked.current === term) return;
    // #233: debounced, so a term typed letter by letter sends one event, not one per keystroke.
    const timer = setTimeout(() => {
      tracked.current = term;
      trackEvent("site_search", {
        query_length: term.length,
        query_length_bucket: queryLengthBucket(term.length),
        result_count: resultCount,
        search_location: "rankings",
      });
    }, SITE_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term, ready, resultCount]);

  return results;
}
