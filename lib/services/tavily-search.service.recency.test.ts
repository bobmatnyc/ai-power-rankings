import { afterEach, describe, expect, it, vi } from "vitest";
import { TavilySearchService } from "./tavily-search.service";

/**
 * Regression tests for #125 Task 1a.
 *
 * Why: Tavily ranks search results by relevance, not recency (confirmed
 * against the current Tavily API reference — there is no sort-by-date
 * option), so a same-day story can rank low enough on relevance to miss the
 * `max_results` cutoff entirely even inside a 14-day `days` window. Requesting
 * `time_range: 'day'` (Tavily's documented, topic-independent recency filter)
 * as an explicit extra pass is what actually makes same-day content reachable
 * — this is the request-construction half of #125; sortByFreshness in
 * automated-ingestion.service.ts is the ordering half.
 *
 * What: Mocks global fetch and inspects the request bodies TavilySearchService
 * sends, asserting the recency pass fires first with `time_range: 'day'` when
 * opted in, is additive (the broader `days`-bounded pass still runs), stays
 * off by default (other searchAINews callers are unaffected), is skipped for
 * a non-"news" topic (Tavily's recommended combo is topic=news +
 * time_range=day), and — the code-critic follow-up on bbf43787 — degrades to
 * the broader pass instead of failing the whole call when the recency pass's
 * own fetch rejects.
 *
 * Test: `npx vitest run lib/services/tavily-search.service.recency.test.ts`.
 */

function mockFetchOk() {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    json: async () => ({ query: "q", results: [], response_time: 0.1 }),
  } as unknown as Response);
}

function requestBodies(fetchSpy: ReturnType<typeof mockFetchOk>): Record<string, unknown>[] {
  return fetchSpy.mock.calls.map((call) => JSON.parse(call[1]?.body as string));
}

describe("TavilySearchService - recency pass (#125)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not issue a recency pass by default", async () => {
    const fetchSpy = mockFetchOk();
    const service = new TavilySearchService("test-key");

    await service.searchAINews({ topic: "news" });

    expect(requestBodies(fetchSpy).every((b) => b.time_range === undefined)).toBe(true);
  });

  it("issues an explicit time_range='day' pass first, alongside the broader days-bounded pass", async () => {
    const fetchSpy = mockFetchOk();
    const service = new TavilySearchService("test-key");

    await service.searchAINews({ topic: "news", includeRecentPass: true, days: 14 });

    const bodies = requestBodies(fetchSpy);
    expect(bodies[0]).toMatchObject({ time_range: "day", topic: "news" });
    // Additive, not a replacement: the days-bounded pass still runs.
    expect(bodies.some((b) => b.days === 14)).toBe(true);
  });

  it("skips the recency pass when topic is not 'news'", async () => {
    const fetchSpy = mockFetchOk();
    const service = new TavilySearchService("test-key");

    await service.searchAINews({ topic: "general", includeRecentPass: true });

    expect(requestBodies(fetchSpy).every((b) => b.time_range === undefined)).toBe(true);
  });

  /**
   * The recency pass runs first (see above), so its own rejection must not
   * take the primary/supplementary passes down with it — a transient failure
   * on the extra call would otherwise fail the whole run whenever Brave
   * isn't configured as a fallback (automated-ingestion.service.ts's
   * discoverArticles treats any searchAINews rejection as "Tavily failed").
   */
  it("degrades to the broader pass when the recency pass's fetch rejects", async () => {
    const primaryResult = {
      title: "Primary result",
      url: "https://example.com/primary",
      content: "Primary content",
      score: 0.8,
    };
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("network error on recency pass"))
      .mockResolvedValue({
        ok: true,
        json: async () => ({ query: "q", results: [primaryResult], response_time: 0.1 }),
      } as unknown as Response);
    const service = new TavilySearchService("test-key");

    const results = await service.searchAINews({ topic: "news", includeRecentPass: true, days: 14 });

    // Did not throw, and the broader pass's result made it through.
    expect(results.some((r) => r.url === "https://example.com/primary")).toBe(true);
    // Recency pass (rejected) + primary + 1 supplementary query.
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });
});
