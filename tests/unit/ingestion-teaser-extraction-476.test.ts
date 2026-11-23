import { describe, expect, it, vi } from "vitest";

/**
 * Why: #476 — one-sentence teaser snippets on relevant topics were scored on
 * the snippet alone and rejected. A teaser-length snippet is replaced by the
 * extractor's full text before assessment; full-text snippets are not
 * re-extracted; a failed or boilerplate extraction keeps the snippet.
 */

vi.mock("../../lib/db/connection", () => ({
  getDb: () => ({
    execute: async () => ({ rows: [{ id: "run-476b" }] }),
    update: () => ({
      set: (data: Record<string, unknown>) => ({
        where: () => ({ returning: async () => [{ id: "run-476b", status: "running", ...data }] }),
      }),
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => Promise.resolve([]),
          limit: () => Promise.resolve([{ status: "running" }]),
          then: (resolve: (value: unknown[]) => void) => resolve([]),
        }),
      }),
    }),
  }),
}));

import { AutomatedIngestionService } from "../../lib/services/automated-ingestion.service";

const TEASER =
  "Anthropic shipped a new Claude Code release with background agents, according to a report published today on the subject.";
const FULL_TEXT = "Claude Code now runs background agents. ".repeat(40);
const LONG_SNIPPET = "A long Tavily snippet with full article text about AI coding tools. ".repeat(12);

function candidate(url: string, content: string) {
  return {
    title: "AI coding tool news",
    url,
    description: content.substring(0, 500),
    source: "example.com",
    publishedDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    content,
    score: 0.9,
    discoveredVia: "window" as const,
  };
}

type FetchImpl = (
  url: string,
  stats?: unknown,
  billing?: { note: (provider: string, message: string, status?: number) => void }
) => Promise<string | null>;

function setup(results: ReturnType<typeof candidate>[], fetchImpl: FetchImpl) {
  const service = new AutomatedIngestionService();
  const batchAssess = vi.fn(async (items: Array<{ url: string }>) =>
    items.map(() => ({
      shouldIngest: false,
      qualityScore: 3,
      relevanceScore: 3,
      credibilityScore: 3,
      reasoning: "fixture",
      estimatedCost: 0,
    }))
  );
  const internal = service as unknown as Record<string, unknown>;
  internal._tavilySearchService = {
    isConfigured: () => true,
    searchAINews: vi.fn().mockResolvedValue(results),
  };
  internal._braveSearchService = { isAvailable: () => false, searchAINews: vi.fn() };
  internal._articleQualityService = { batchAssess };
  internal._articleIngestionService = { ingestArticle: vi.fn() };
  const fetchArticleContent = vi
    .spyOn(service as unknown as { fetchArticleContent: FetchImpl }, "fetchArticleContent")
    .mockImplementation(fetchImpl);
  const assessedContent = (url: string): string | undefined =>
    batchAssess.mock.calls
      .flatMap((call) => call[0] as Array<{ url: string; content: string }>)
      .find((a) => a.url === url)?.content;
  return { service, batchAssess, fetchArticleContent, assessedContent };
}

describe("teaser extraction before assessment (#476)", () => {
  it("extracts a teaser candidate and the assessor sees the full text", async () => {
    const url = "https://news.google.com/teaser";
    const { service, fetchArticleContent, assessedContent } = setup([candidate(url, TEASER)], async () => FULL_TEXT);

    await service.runDailyDiscovery({ days: 14 });

    expect(fetchArticleContent).toHaveBeenCalledWith(url, undefined, undefined);
    expect(assessedContent(url)).toBe(FULL_TEXT);
  });

  it("does not re-extract a candidate that already has full text", async () => {
    const url = "https://example.com/full";
    const { service, fetchArticleContent, assessedContent } = setup(
      [candidate(url, LONG_SNIPPET)],
      async () => FULL_TEXT
    );

    await service.runDailyDiscovery({ days: 14 });

    expect(fetchArticleContent).not.toHaveBeenCalled();
    expect(assessedContent(url)).toBe(LONG_SNIPPET);
  });

  it("falls back to the teaser when extraction throws, without failing the run", async () => {
    const url = "https://news.google.com/throws";
    const { service, fetchArticleContent, assessedContent } = setup([candidate(url, TEASER)], async () => {
      throw new Error("extractor down");
    });

    const result = await service.runDailyDiscovery({ days: 14 });

    expect(fetchArticleContent).toHaveBeenCalled();
    expect(assessedContent(url)).toBe(TEASER);
    expect(result.status).not.toBe("failed");
  });

  it("keeps the teaser when the extracted page is consent boilerplate (#477 guard)", async () => {
    const url = "https://news.google.com/consent";
    const boilerplate = "We use cookies and tracking technologies. Accept all or reject all. ".repeat(10);
    const { service, fetchArticleContent, assessedContent } = setup([candidate(url, TEASER)], async () => boilerplate);

    await service.runDailyDiscovery({ days: 14 });

    expect(fetchArticleContent).toHaveBeenCalled();
    expect(assessedContent(url)).toBe(TEASER);
  });

  // #476 review: expansion has its own budget inside the pipeline timeout.
  it("bounds expansion with a hanging extractor: cap respected, run completes, snippets assessed", async () => {
    const urls = [1, 2, 3, 4, 5].map((i) => `https://news.google.com/hang-${i}`);
    const { service, fetchArticleContent, assessedContent } = setup(
      // Distinct titles, so semantic dedupe keeps all five.
      ["Cursor", "Windsurf", "Devin", "Copilot", "Aider"].map((tool, i) => ({
        ...candidate(urls[i]!, TEASER),
        title: `${tool} ships release ${i} with unrelated feature set`,
      })),
      () => new Promise<string | null>(() => undefined)
    );
    (service as unknown as { teaserBudget: object }).teaserBudget = {
      maxPerRun: 2,
      perTeaserTimeoutMs: 50,
      concurrency: 2,
      stopAfterRunMs: 60_000,
    };

    const started = Date.now();
    const result = await service.runDailyDiscovery({ days: 14 });

    expect(Date.now() - started).toBeLessThan(2_000);
    expect(fetchArticleContent).toHaveBeenCalledTimes(2);
    for (const u of urls) expect(assessedContent(u)).toBe(TEASER);
    expect(result.status).not.toBe("failed");
  });

  it("starts no expansion once the run is past stopAfterRunMs", async () => {
    const url = "https://news.google.com/late";
    const { service, fetchArticleContent, assessedContent } = setup([candidate(url, TEASER)], async () => FULL_TEXT);
    (service as unknown as { teaserBudget: object }).teaserBudget = {
      maxPerRun: 10,
      perTeaserTimeoutMs: 10_000,
      concurrency: 3,
      stopAfterRunMs: 0,
    };

    await service.runDailyDiscovery({ days: 14 });

    expect(fetchArticleContent).not.toHaveBeenCalled();
    expect(assessedContent(url)).toBe(TEASER);
  });

  it("does not count a teaser fetch's 401 as a run billing/auth failure", async () => {
    const url = "https://news.google.com/billing";
    const { service, assessedContent } = setup([candidate(url, TEASER)], async (_u, _s, billing) => {
      billing?.note("tavily", "Unauthorized", 401);
      return null;
    });

    const result = await service.runDailyDiscovery({ days: 14 });

    expect(assessedContent(url)).toBe(TEASER);
    expect(result.errors.join(" ")).not.toMatch(/Provider (billing|auth) error/);
    expect(result.status).not.toBe("failed");
  });

  // #476 (marker rule): a snippet over the length cutoff that is still truncated gets full text.
  it("extracts a long snippet that carries a [...] truncation marker", async () => {
    const url = "https://example.com/truncated";
    const truncated = `${LONG_SNIPPET} The announcement continues [...]`;
    const { service, fetchArticleContent, assessedContent } = setup([candidate(url, truncated)], async () => FULL_TEXT);

    await service.runDailyDiscovery({ days: 14 });

    expect(fetchArticleContent).toHaveBeenCalledWith(url, undefined, undefined);
    expect(assessedContent(url)).toBe(FULL_TEXT);
  });

  // #476 (Fail-Open Check): a failed fetch keeps the snippet AND is recorded.
  it("records a failed full-text fetch as teaserFallback and still assesses the snippet", async () => {
    const url = "https://example.com/fetch-fails";
    const { service, assessedContent } = setup([candidate(url, TEASER)], async () => {
      throw new Error("extractor down");
    });

    const result = await service.runDailyDiscovery({ days: 14 });

    expect(assessedContent(url)).toBe(TEASER);
    expect(result.persistedRunCounts).toMatchObject({ teaserExpanded: 0, teaserFallback: 1 });
    expect(result.status).not.toBe("failed");
  });

  // #476: a google.com/url redirect is fetched and deduplicated as the publisher URL.
  it("resolves a google.com/url redirect before dedup and fetch", async () => {
    const redirect = "https://www.google.com/url?rct=j&sa=t&url=https%3A%2F%2Fpublisher.example%2Fstory&ct=ga";
    const publisher = "https://publisher.example/story";
    const { service, fetchArticleContent, assessedContent } = setup(
      [candidate(redirect, TEASER)],
      async () => FULL_TEXT
    );
    const checkDuplicates = vi.spyOn(service, "checkDuplicates");

    await service.runDailyDiscovery({ days: 14 });

    expect(checkDuplicates.mock.calls[0]?.[0]).toEqual([publisher]);
    expect(fetchArticleContent).toHaveBeenCalledWith(publisher, undefined, undefined);
    expect(assessedContent(publisher)).toBe(FULL_TEXT);
  });
});
