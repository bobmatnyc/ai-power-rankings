import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { NEWS_PAGE_URL, loadNewsItems } from "../../components/news/load-news";

/**
 * Regression tests for #152 — the news page tells a failed read from no news.
 *
 * Why: `NewsContent` turned a failed `/api/news` request into an empty list, so
 * a 503 rendered the "no news items" card.
 * What: `loadNewsItems` is driven with a stub `fetch` for each outcome. The repo
 * has no DOM test setup (no testing-library, no jsdom), so the component's
 * wiring — that it reads through `loadNewsItems` and renders the error card
 * before the "no items" branch — is pinned on its source, the way
 * `tests/unit/news-route-pagination.test.ts` pins the route.
 * Test: `npx vitest run tests/unit/news-content-load.test.ts`. No network.
 */

function stubFetch(response: Response | Error): typeof fetch {
  return vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  }) as unknown as typeof fetch;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("loadNewsItems (#152)", () => {
  it("reads a successful page through the edge-cacheable URL", async () => {
    const fetchImpl = stubFetch(json({ news: [{ id: "1" }], total: 1 }));

    const result = await loadNewsItems<{ id: string }>(fetchImpl);

    expect(result).toEqual({ ok: true, items: [{ id: "1" }] });
    expect(fetchImpl).toHaveBeenCalledWith(NEWS_PAGE_URL);
  });

  it("reports an empty successful page as success with no items", async () => {
    const result = await loadNewsItems(stubFetch(json({ news: [], total: 0 })));

    expect(result).toEqual({ ok: true, items: [] });
  });

  it.each([
    ["a 503", json({ error: "News temporarily unavailable" }, 503)],
    ["a 200 with no news array", json({ error: "unexpected" })],
    ["a network error", new TypeError("Failed to fetch")],
  ])("reports %s as a failure, not as an empty list", async (_label, response) => {
    const result = await loadNewsItems(stubFetch(response));

    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty("items");
  });
});

describe("NewsContent wiring (#152)", () => {
  const source = readFileSync(
    join(__dirname, "..", "..", "components/news/news-content.tsx"),
    "utf8"
  );

  it("reads through loadNewsItems and renders the error card, with a retry, before 'no items'", () => {
    expect(source).toContain("loadNewsItems<MetricsHistory>()");

    const errorBranch = source.indexOf("{loadFailed ? (");
    const retry = source.indexOf("{dict.common.tryAgain}");
    const noItems = source.indexOf("{dict.news.noItems}");
    expect(errorBranch).toBeGreaterThan(-1);
    expect(retry).toBeGreaterThan(errorBranch);
    expect(noItems).toBeGreaterThan(retry);
  });
});
