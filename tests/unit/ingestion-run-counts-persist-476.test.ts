import { describe, expect, it, vi } from "vitest";

/**
 * Why: #476 — teaserExpanded and previouslyRejected lived only in the in-memory
 * run summary, so the run row could not say whether teaser expansion ran.
 * What: Runs the pipeline against a fake getDb() that records every UPDATE
 * payload, and asserts the final write carries both counts as the leading
 * `run_counts` entry of candidate_outcomes.
 */

const { setPayloads, priorRuns } = vi.hoisted(() => ({
  setPayloads: [] as Record<string, unknown>[],
  priorRuns: [] as Array<{ createdAt: Date; candidateOutcomes: unknown }>,
}));

vi.mock("../../lib/db/connection", () => ({
  getDb: () => ({
    execute: async () => ({ rows: [{ id: "run-476c" }] }),
    update: () => ({
      set: (data: Record<string, unknown>) => ({
        where: () => ({
          returning: async () => {
            setPayloads.push(data);
            return [{ id: "run-476c", status: "running", ...data }];
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
            resolve(!!fields && "candidateOutcomes" in fields ? priorRuns : []),
        }),
      }),
    }),
  }),
}));

import { AutomatedIngestionService } from "../../lib/services/automated-ingestion.service";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const REJECTED_URL = "https://www.amazon.com/company-page";
const TEASER_URL = "https://teaser.example/teaser";
const TEASER =
  "Anthropic shipped a new Claude Code release with background agents, according to a report published today on the subject.";
const FULL_TEXT = "Claude Code now runs background agents. ".repeat(40);

function candidate(url: string, content: string) {
  return {
    title: "AI coding tool news",
    url,
    description: content.substring(0, 500),
    source: "example.com",
    publishedDate: new Date(Date.now() - MS_PER_DAY).toISOString(),
    content,
    score: 0.9,
    discoveredVia: "window" as const,
  };
}

describe("run counts persisted with the run row (#476)", () => {
  it("writes teaserExpanded and previouslyRejected into candidate_outcomes", async () => {
    priorRuns.push({
      createdAt: new Date(Date.now() - 2 * MS_PER_DAY),
      candidateOutcomes: [
        {
          url: REJECTED_URL,
          discoveredVia: "window",
          sourceDate: null,
          provisionalDate: null,
          outcome: "quality_rejected",
        },
      ],
    });
    const service = new AutomatedIngestionService();
    const internal = service as unknown as Record<string, unknown>;
    internal._tavilySearchService = {
      isConfigured: () => true,
      searchAINews: vi
        .fn()
        .mockResolvedValue([candidate(REJECTED_URL, FULL_TEXT), candidate(TEASER_URL, TEASER)]),
    };
    internal._braveSearchService = { isAvailable: () => false, searchAINews: vi.fn() };
    internal._articleQualityService = {
      batchAssess: vi.fn(async (items: unknown[]) =>
        items.map(() => ({
          shouldIngest: false,
          qualityScore: 3,
          relevanceScore: 3,
          credibilityScore: 3,
          reasoning: "fixture",
          estimatedCost: 0,
        }))
      ),
    };
    internal._articleIngestionService = { ingestArticle: vi.fn() };
    vi.spyOn(
      service as unknown as { fetchArticleContent: () => Promise<string> },
      "fetchArticleContent"
    ).mockImplementation(async () => FULL_TEXT);

    await service.runDailyDiscovery({ days: 14 });

    const final = setPayloads.filter((p) => p.candidateOutcomes !== undefined).at(-1);
    const outcomes = final?.candidateOutcomes as Array<Record<string, unknown>> | undefined;
    expect(outcomes?.[0]).toEqual({
      outcome: "run_counts",
      teaserExpanded: 1,
      teaserFallback: 0,
      previouslyRejected: 1,
    });
  });
});
