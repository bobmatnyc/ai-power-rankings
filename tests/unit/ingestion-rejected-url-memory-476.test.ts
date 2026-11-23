import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Why: #476 — the same off-topic candidates were rediscovered and re-scored by
 * the quality LLM every day. A URL rejected in a recent run must be skipped
 * before assessment, recorded as `skipped_previously_rejected`, and counted.
 * What: A fake getDb() answers the prior-runs query with `priorRuns` (the fake
 * ignores the WHERE clause, so the lookback test proves the in-code bound).
 */

const { priorRuns, setPayloads, readFails } = vi.hoisted(() => ({
  priorRuns: [] as Array<{ createdAt: Date; candidateOutcomes: unknown }>,
  setPayloads: [] as Record<string, unknown>[],
  readFails: { value: false },
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
          then: (resolve: (value: unknown[]) => void, reject: (e: unknown) => void) => {
            const isRunsRead = !!fields && "candidateOutcomes" in fields;
            if (isRunsRead && readFails.value) return reject(new Error("connection reset"));
            return resolve(isRunsRead ? priorRuns : []);
          },
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
    readFails.value = false;
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

  it("assesses every candidate when the prior-rejections read throws (fail open)", async () => {
    readFails.value = true;
    priorRuns.push(priorRun(2, REJECTED_URL));
    const { service, batchAssess } = setup([
      candidate("Amazon company page", REJECTED_URL),
      candidate("Agentic coding tool ships", FRESH_URL),
    ]);

    const result = await service.runDailyDiscovery({ days: 14 });

    const assessedUrls = batchAssess.mock.calls.flatMap((call) =>
      (call[0] as Array<{ url: string }>).map((a) => a.url)
    );
    expect(assessedUrls.sort()).toEqual([FRESH_URL, REJECTED_URL].sort());
    expect(result.status).toBe("completed");
  });

  // #476 (critic HIGH): a transient extractor error must not hide an article for 30 days.
  it("does not skip, on the next run, a URL rejected after its full-text fetch failed", async () => {
    const teaser = { ...candidate("Claude Code ships agents", FRESH_URL), content: "Claude Code ships background agents for long-running coding tasks, according to a report published today. Read more" };
    const first = setup([teaser]);
    vi.spyOn(
      first.service as unknown as { fetchArticleContent: () => Promise<string | null> },
      "fetchArticleContent"
    ).mockRejectedValue(new Error("extractor down"));

    const run1 = await first.service.runDailyDiscovery({ days: 14 });

    const outcome1 = run1.candidateOutcomes.find((o) => o.url === FRESH_URL);
    expect(outcome1?.outcome).toBe("quality_rejected_unexpanded");
    expect(collectRejectedUrls([{ createdAt: new Date(), candidateOutcomes: run1.candidateOutcomes }]).has(FRESH_URL)).toBe(false);

    priorRuns.push({ createdAt: new Date(), candidateOutcomes: run1.candidateOutcomes });
    const second = setup([candidate("Claude Code ships agents", FRESH_URL)]);
    const run2 = await second.service.runDailyDiscovery({ days: 14 });

    expect(second.batchAssess).toHaveBeenCalledTimes(1);
    expect(run2.candidateOutcomes.find((o) => o.url === FRESH_URL)?.outcome).not.toBe("skipped_previously_rejected");
  });

  it("still skips a URL rejected after a successful full-text fetch", async () => {
    const teaser = { ...candidate("Off-topic page", REJECTED_URL), content: "A short off-topic teaser about retail deals and delivery options that has nothing to do with AI coding. Read more" };
    const first = setup([teaser]);
    vi.spyOn(
      first.service as unknown as { fetchArticleContent: () => Promise<string | null> },
      "fetchArticleContent"
    ).mockResolvedValue("An off-topic retail page about shopping deals and delivery options. ".repeat(20));

    const run1 = await first.service.runDailyDiscovery({ days: 14 });
    expect(run1.candidateOutcomes.find((o) => o.url === REJECTED_URL)?.outcome).toBe("quality_rejected");

    priorRuns.push({ createdAt: new Date(), candidateOutcomes: run1.candidateOutcomes });
    const second = setup([candidate("Off-topic page", REJECTED_URL)]);
    const run2 = await second.service.runDailyDiscovery({ days: 14 });

    expect(second.batchAssess).not.toHaveBeenCalled();
    expect(run2.candidateOutcomes.find((o) => o.url === REJECTED_URL)?.outcome).toBe("skipped_previously_rejected");
  });
});
