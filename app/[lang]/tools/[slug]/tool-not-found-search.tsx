"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRankingsSearch } from "@/components/ranking/use-rankings-search";
import { Input } from "@/components/ui/input";
import type { ToolSuggestion } from "@/lib/tools/nearest-tools";

/** At most this many search results are listed. */
const MAX_RESULTS = 8;

interface ToolNotFoundSearchProps {
  lang: string;
  tools: ToolSuggestion[];
}

/**
 * Search box on the tool 404 page.
 *
 * Why: #193: a visitor on a dead tool URL can look the tool up in place.
 *   #233 keeps search terms out of URLs, so the term is client state only.
 * What: filters the active catalogue by name or slug as the visitor types and
 *   lists matching tool links; `site_search` fires through `useRankingsSearch`
 *   with `search_location: "tool_not_found"`. No `<form>`, no `name`.
 * Test: `tests/unit/analytics-events.test.tsx` ("tool 404 search"),
 *   `tests/unit/tool-not-found-193.test.tsx`.
 */
export function ToolNotFoundSearch({ lang, tools }: ToolNotFoundSearchProps) {
  const [term, setTerm] = useState("");
  const rows = useMemo(() => tools.map((tool) => ({ tool })), [tools]);
  const results = useRankingsSearch(rows, term, true, "tool_not_found");
  const shown = term.trim() ? results.slice(0, MAX_RESULTS) : [];

  return (
    <div className="flex flex-col gap-2">
      {/* #233: no <form> and no name, so the term can never be submitted into a URL. */}
      <Input
        type="search"
        aria-label="Search tools"
        placeholder="Search tools"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
      />
      {shown.length > 0 && (
        <ul className="flex flex-col gap-1" aria-label="Search results">
          {shown.map(({ tool }) => (
            <li key={tool.slug}>
              <Link href={`/${lang}/tools/${tool.slug}`}>{tool.name}</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
