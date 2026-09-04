import { afterEach, describe, expect, it, vi } from "vitest";
import {
  TavilySearchService,
  dedupeSearchResultsPreferRecency,
  type TavilySearchResult,
} from "./tavily-search.service";

/**
 * Regression tests for #132 — pass membership on every search result.
 *
 * Why: the `time_range: 'day'` recency pass (#125) and the broader
 * `days`-bounded pass returned the same shape, and the merge deduplicated by
 * URL FIRST-SEEN. Nothing recorded which pass found a result, so every
 * downstream freshness decision fell back to Tavily's `published_date` — which
 * on 2026-09-03 read Aug 20, Aug 21 and Aug 30 for pages the recency pass had
 * just returned as last-24h content.
 *
 * What: Asserts each pass tags its own results, and that a URL both passes
 * return keeps the recency tag BY TAG rather than by array position — the
 * reversed-push-order case below is the one first-seen dedup cannot satisfy.
 *
 * Test: `npx vitest run lib/services/tavily-search.service.recency-tagging.test.ts`.
 */

function result(url: string, discoveredVia: "recency" | "window"): TavilySearchResult {
  return {
    title: `Article at ${url}`,
    url,
    description: "fixture",
    source: "example.com",
    publishedDate: null,
    score: 0.5,
    discoveredVia,
  };
}

describe("dedupeSearchResultsPreferRecency (#132)", () => {
  it("keeps the recency-tagged entry when it is pushed first", () => {
    const deduped = dedupeSearchResultsPreferRecency([
      result("https://example.com/a", "recency"),
      result("https://example.com/a", "window"),
    ]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0].discoveredVia).toBe("recency");
  });

  /**
   * The discriminating case. Push order is deliberately reversed, so a
   * first-seen dedup keeps the WINDOW entry and loses the only same-day signal
   * that does not depend on Tavily's published_date.
   */
  it("keeps the recency-tagged entry when the push order is reversed", () => {
    const deduped = dedupeSearchResultsPreferRecency([
      result("https://example.com/a", "window"),
      result("https://example.com/a", "recency"),
    ]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0].discoveredVia).toBe("recency");
  });

  it("keeps the first occurrence's position when upgrading its tag", () => {
    const deduped = dedupeSearchResultsPreferRecency([
      result("https://example.com/a", "window"),
      result("https://example.com/b", "window"),
      result("https://example.com/a", "recency"),
    ]);

    expect(deduped.map((r) => r.url)).toEqual(["https://example.com/a", "https://example.com/b"]);
    expect(deduped[0].discoveredVia).toBe("recency");
  });

  it("leaves a window-only URL tagged window", () => {
    const deduped = dedupeSearchResultsPreferRecency([
      result("https://example.com/a", "window"),
      result("https://example.com/a", "window"),
    ]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0].discoveredVia).toBe("window");
  });
});

describe("TavilySearchService - pass tagging (#132)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("tags each result with the pass that returned it", async () => {
    const apiResult = (url: string) => ({
      title: `Article at ${url}`,
      url,
      content: "fixture content",
      score: 0.7,
      published_date: "2026-08-20T00:00:00.000Z",
    });

    // Call order inside searchAINews: recency pass, primary pass, one
    // supplementary query.
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ query: "q", results: [apiResult("https://example.com/recent")] }),
      } as unknown as Response)
      .mockResolvedValue({
        ok: true,
        json: async () => ({ query: "q", results: [apiResult("https://example.com/broad")] }),
      } as unknown as Response);

    const service = new TavilySearchService("test-key");
    const results = await service.searchAINews({
      topic: "news",
      includeRecentPass: true,
      days: 14,
    });

    const byUrl = new Map(results.map((r) => [r.url, r]));
    expect(byUrl.get("https://example.com/recent")?.discoveredVia).toBe("recency");
    expect(byUrl.get("https://example.com/broad")?.discoveredVia).toBe("window");
  });

  it("tags every result window when the recency pass is not requested", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        query: "q",
        results: [
          { title: "t", url: "https://example.com/a", content: "c", score: 0.5 },
        ],
      }),
    } as unknown as Response);

    const service = new TavilySearchService("test-key");
    const results = await service.searchAINews({ topic: "news" });

    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.discoveredVia === "window")).toBe(true);
  });
});
