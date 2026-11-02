import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #368: a static page keeps query-dependent content in its HTML.
 *
 * Why: on a static page Next makes `useSearchParams()` suspend on the server, so
 *   the nearest Suspense fallback ("Loading...") took the place of the rankings
 *   board and the sidebar in the HTML.
 * What: renders `SearchParamsBoundary` with `useSearchParams()` suspending, as
 *   it does in a static render, and checks the HTML holds the content rendered
 *   with no query; with the hook answering, the content uses the real query.
 * Test: `npx vitest run tests/unit/search-params-boundary-368.test.tsx`.
 */

const nav = vi.hoisted(() => ({ useSearchParams: vi.fn() }));
vi.mock("next/navigation", () => nav);

import { SearchParamsBoundary } from "../../components/search-params-boundary";

const view = (searchParams: URLSearchParams) => <p>category={searchParams.get("category") ?? "all"}</p>;

beforeEach(() => {
  nav.useSearchParams.mockReset();
});

describe("SearchParamsBoundary (#368)", () => {
  it("puts the content, rendered with no query, in a static page's HTML", () => {
    nav.useSearchParams.mockImplementation(() => {
      throw new Promise(() => {}); // a static render suspends here
    });
    const html = renderToString(<SearchParamsBoundary render={view} />);
    expect(html).toContain("category=<!-- -->all");
    expect(html).not.toMatch(/loading/i);
  });

  it("renders with the real query when the hook answers", () => {
    nav.useSearchParams.mockReturnValue(new URLSearchParams("category=ide-assistant"));
    const html = renderToString(<SearchParamsBoundary render={view} />);
    expect(html).toContain("category=<!-- -->ide-assistant");
  });
});
