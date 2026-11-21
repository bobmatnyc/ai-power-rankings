import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Why: #476 — the same off-topic candidates were rediscovered and re-scored by
 * the quality LLM every day. A URL rejected in a recent run must be skipped
 * before assessment, recorded as `skipped_previously_rejected`, and counted.
 * What: A fake getDb() answers the prior-runs query with `priorRuns` (the fake
 * ignores the WHERE clause, so the lookback test proves the in-code bound).
 */

const { priorRuns, setPayloads } = vi.hoisted(() => ({
  priorRuns: [] as Array<{ createdAt: Date; candidateOutcomes: unknown }>,
  setPayloads: [] as Record<string, unknown>[],
}));

vi.mock("../../lib/db/connection", () => ({
  getDb: () => ({
    execute: async () => ({ rows: [{ id: "run-476" }] }),
    update: () => ({
      set: (data: Record<string, unknown>) => ({
        where: () => ({
          returning: async () => {
            setPayloads.push(data);
            return [{ id: "run-476", status: "running", ...data }];
          },
        }),
      }),
    }),
    select: (fields?: Record<string, unknown>) => ({
      from: () => ({
        where: () => ({
          orderBy: () => Promise.resolve([]),
          limit: () => Promise.resolve([{ status: "running" }]),
          then: (resolve: (value: unknown[]) => void) =>
            resolve(fields && "candidateOutcomes" in fields ? priorRuns : []),
        }),
      }),
    }),
  }),
}));

import {
  AutomatedIngestionService,
  REJECTED_URL_LOOKBACK_DAYS,
  collectRejectedUrls,
} from "../../lib/services/automated-ingestion.service";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const REJECTED_URL = "https://www.amazon.com/company-page";
const FRESH_URL = "https://example.com/agentic-coding-news";

function candidate(title: string, url: string) {
  return {
    title,
    url,
    description: "fixture",
    source: "example.com",
    publishedDate: new Date(Date.now() - MS_PER_DAY).toISOString(),
    // #476: long enough to count as full text, so no extraction is attempted.
    content: `${title}. ${"An AI coding tool shipped a new release with agent features. ".repeat(12)}`,
    score: 0.9,
    discoveredVia: "window" as const,
  };
}

function priorRun(daysAgo: number, url: string) {
  return {
    createdAt: new Date(Date.now() - daysAgo * MS_PER_DAY),
    candidateOutcomes: [
      { url, discoveredVia: "window", sourceDate: null, provisionalDate: null, outcome: "quality_rejected" },
    ],
  };
}

function setup(results: ReturnType<typeof candidate>[]) {
  const service = new AutomatedIngestionService();
  const batchAssess = vi.fn(async (items: Array<{ url: string }>) =>
    items.map(() => ({
      shouldIngest: false,
      qualityScore: 3,
      relevanceScore: 3,
      credibilityScore: 3,
      reasoning: "off-topic",
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
  return { service, batchAssess };
}

describe("rejected-URL memory (#476)", () => {
  beforeEach(() => {
    priorRuns.length = 0;
    setPayloads.length = 0;
  });

  it("skips a URL rejected in a prior run without calling the assessor, and counts it", async () => {
    priorRuns.push(priorRun(2, REJECTED_URL));
    const { service, batchAssess } = setup([
      candidate("Amazon company page", REJECTED_URL),
      candidate("Agentic coding tool ships", FRESH_URL),
    ]);

    const result = await service.runDailyDiscovery({ days: 14 });

    const assessedUrls = batchAssess.mock.calls.flatMap((call) =>
      (call[0] as Array<{ url: string }>).map((a) => a.url)
    );
    expect(assessedUrls).not.toContain(REJECTED_URL);
    // A URL not previously rejected is still assessed.
    expect(assessedUrls).toContain(FRESH_URL);
    const skipped = result.candidateOutcomes.find((o) => o.url === REJECTED_URL);
    expect(skipped?.outcome).toBe("skipped_previously_rejected");
    expect(result.articlesSkipped).toBe(1);
  });

  it("assesses a URL whose rejection is older than the lookback", async () => {
    priorRuns.push(priorRun(REJECTED_URL_LOOKBACK_DAYS + 1, REJECTED_URL));
    const { service, batchAssess } = setup([candidate("Amazon company page", REJECTED_URL)]);

    const result = await service.runDailyDiscovery({ days: 14 });

    expect(batchAssess).toHaveBeenCalledTimes(1);
    expect(result.candidateOutcomes[0]?.outcome).toBe("quality_rejected");
  });

  it("collectRejectedUrls keeps only quality_rejected URLs inside the window", () => {
    const now = Date.now();
    const urls = collectRejectedUrls(
      [
        priorRun(REJECTED_URL_LOOKBACK_DAYS - 1, "https://a.example/in"),
        priorRun(REJECTED_URL_LOOKBACK_DAYS + 1, "https://a.example/out"),
        {
          createdAt: new Date(now),
          candidateOutcomes: [{ url: "https://a.example/stale", outcome: "skipped_stale" }],
        },
        { createdAt: new Date(now), candidateOutcomes: null },
      ],
      now
    );
    expect([...urls]).toEqual(["https://a.example/in"]);
  });
});
