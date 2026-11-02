"use client";

import { useSearchParams } from "next/navigation";
import { type ReactNode, Suspense } from "react";

/** The query string a statically rendered page has: none. */
const EMPTY_SEARCH_PARAMS = new URLSearchParams();

type Render = (searchParams: URLSearchParams) => ReactNode;

function WithSearchParams({ render }: { render: Render }): ReactNode {
  return render(useSearchParams());
}

/**
 * Renders `render(searchParams)` so a static page still has its content in the HTML.
 *
 * Why: #368 — on a static or ISR page, `useSearchParams()` makes Next render the
 *   nearest Suspense fallback on the server and the component only on the client,
 *   so a fallback of "Loading..." would replace the board and the sidebar in the HTML.
 * What: the Suspense fallback is `render` with no query parameters, which the
 *   server renders into the HTML; on the client the real query replaces it.
 *   With no query string the two renders are the same.
 * Test: `tests/unit/search-params-boundary-368.test.tsx`.
 */
export function SearchParamsBoundary({ render }: { render: Render }): React.JSX.Element {
  return (
    <Suspense fallback={render(EMPTY_SEARCH_PARAMS)}>
      <WithSearchParams render={render} />
    </Suspense>
  );
}
