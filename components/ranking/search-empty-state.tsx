"use client";

import { Button } from "@/components/ui/button";

interface SearchEmptyStateProps {
  /** The trimmed search term that matched no row. */
  term: string;
  /** Message template with a `{term}` placeholder (`dict.rankings.noResults`). */
  message: string;
  /** Button label (`dict.rankings.clearSearch`). */
  clearLabel: string;
  /** Clears the search term; must not navigate (#233). */
  onClear: () => void;
}

/**
 * No-results message for a rankings search that matched nothing.
 *
 * Why: #207: a typed term with zero matches left a blank grid area, and the only
 *   clear control was the badge above it.
 * What: Renders `message` with `{term}` replaced, announced through
 *   `role="status"`, and a button that calls `onClear`.
 * Test: `tests/unit/rankings-empty-state-207.test.tsx`.
 */
export function SearchEmptyState({ term, message, clearLabel, onClear }: SearchEmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border p-8 text-center">
      <p role="status" className="text-muted-foreground">
        {/* #207: a replacer function, so `$&`, `$$` and friends in the term stay literal. */}
        {message.replace("{term}", () => term)}
      </p>
      <Button type="button" variant="outline" onClick={onClear}>
        {clearLabel}
      </Button>
    </div>
  );
}
