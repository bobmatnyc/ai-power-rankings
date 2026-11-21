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

function setup(results: ReturnType<typeof candidate>[], fetchImpl: (url: string) => Promise<string | null>) {
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
    .spyOn(service as unknown as { fetchArticleContent: (url: string) => Promise<string | null> }, "fetchArticleContent")
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

    expect(fetchArticleContent).toHaveBeenCalledWith(url, expect.anything(), expect.anything());
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
});
