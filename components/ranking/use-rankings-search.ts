"use client";

import { useEffect, useRef } from "react";
import { queryLengthBucket, trackEvent } from "@/lib/analytics/track";

interface SearchableRanking {
  tool: { id: string; slug?: string; name: string; category: string };
}

/**
 * Filters rankings by the `?search=` term and reports the search to GA4.
 *
 * Why: #175 needs a search event. The site's only search entry point is the
 *   schema.org SearchAction (`/{lang}/rankings?search={term}`, app/[lang]/page.tsx),
 *   which landed on an unfiltered list. Filtering makes the result count real.
 * What: Case-insensitive substring match on tool name, slug and category.
 *   An empty term returns `rankings` unchanged and sends nothing. Once `ready`
 *   (rankings loaded), sends one `site_search` per distinct term with the
 *   query length, its bucket and the result count — never the term itself.
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
        [tool.name, tool.slug ?? tool.id, tool.category].some((field) =>
          field.toLowerCase().includes(term)
        )
      )
    : rankings;

  const tracked = useRef<string | null>(null);
  const resultCount = results.length;
  useEffect(() => {
    if (!term || !ready || tracked.current === term) return;
    tracked.current = term;
    trackEvent("site_search", {
      query_length: term.length,
      query_length_bucket: queryLengthBucket(term.length),
      result_count: resultCount,
      search_location: "rankings",
    });
  }, [term, ready, resultCount]);

  return results;
}
