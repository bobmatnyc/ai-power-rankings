/**
 * What's-new summary regeneration from GET /api/cron/daily-news (#160).
 *
 * Why: The summary regenerates only from this CRON_SECRET-gated route, after
 * ingestion. A regeneration failure must be reported in the run result and
 * must never turn a successful ingestion run into a failed cron run.
 * What: Drives the real GET handler and the real `autoRegenerateMonthlySummary`
 * wrapper with the ingestion service, cache invalidation and
 * `WhatsNewSummaryService` replaced.
 * Test: `npx vitest run tests/unit/cron-daily-news-summary.test.ts`. No
 * network, no database.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runDailyDiscovery: vi.fn(),
  regenerateIfChanged: vi.fn(),
}));

vi.mock("../../lib/services/automated-ingestion.service", () => ({
  AutomatedIngestionService: class {
    runDailyDiscovery = mocks.runDailyDiscovery;
  },
}));

vi.mock("../../lib/cache/invalidation.service", () => ({
  invalidateArticleCache: vi.fn(async () => ({
    pathsRevalidated: [],
    tagsRevalidated: [],
    memoryCacheCleared: [],
    success: true,
  })),
}));

vi.mock("../../lib/services/whats-new-summary.service", () => ({
  WhatsNewSummaryService: class {
    regenerateIfChanged = mocks.regenerateIfChanged;
  },
}));

import { GET, maxDuration } from "../../app/api/cron/daily-news/route";

const SECRET = "cron-secret-fixture-value";
const originalCronSecret = process.env["CRON_SECRET"];

const INGESTION = {
  runId: "run-1",
  status: "completed",
  articlesDiscovered: 5,
  articlesPassedQuality: 3,
  articlesIngested: 3,
  articlesSkipped: 2,
  rankingChanges: 0,
  estimatedCostUsd: 0.01,
  errors: [],
  ingestedArticleIds: ["a1", "a2", "a3"],
  durationMs: 40,
};

function authorizedRequest(): Request {
  return new Request("https://aipowerranking.com/api/cron/daily-news", {
    headers: { authorization: `Bearer ${SECRET}` },
  });
}

type Payload = {
  success: boolean;
  data: { articlesIngested: number; whatsNewSummary: Record<string, unknown> };
};

describe("GET /api/cron/daily-news — what's-new summary regeneration", () => {
  beforeEach(() => {
    mocks.runDailyDiscovery.mockReset().mockResolvedValue(INGESTION);
    mocks.regenerateIfChanged.mockReset();
    process.env["CRON_SECRET"] = SECRET;
  });

  afterEach(() => {
    if (originalCronSecret === undefined) delete process.env["CRON_SECRET"];
    else process.env["CRON_SECRET"] = originalCronSecret;
  });

  it("regenerates the current month after ingestion and reports the outcome", async () => {
    const period = new Date().toISOString().slice(0, 7);
    const generated = { status: "generated", period, generationTimeMs: 1234 };
    mocks.regenerateIfChanged.mockResolvedValue(generated);

    const response = await GET(authorizedRequest());

    expect(response.status).toBe(200);
    expect(mocks.regenerateIfChanged).toHaveBeenCalledTimes(1);
    const [calledPeriod, budget] = mocks.regenerateIfChanged.mock.calls[0];
    expect(calledPeriod).toBe(period);
    expect(budget).toBeGreaterThan(0);
    expect(budget).toBeLessThan(maxDuration * 1000);
    expect(mocks.runDailyDiscovery.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.regenerateIfChanged.mock.invocationCallOrder[0]
    );
    const payload = (await response.json()) as Payload;
    expect(payload.data.whatsNewSummary).toEqual(generated);
  });

  it("still succeeds and reports the failure when regeneration throws an LLM or database error", async () => {
    mocks.regenerateIfChanged.mockRejectedValue(new Error("OpenRouter API error (500): upstream down"));

    const response = await GET(authorizedRequest());

    expect(response.status).toBe(200);
    const payload = (await response.json()) as Payload;
    expect(payload.success).toBe(true);
    expect(payload.data.articlesIngested).toBe(3);
    expect(payload.data.whatsNewSummary).toMatchObject({
      status: "failed",
      error: "OpenRouter API error (500): upstream down",
    });
  });
});
