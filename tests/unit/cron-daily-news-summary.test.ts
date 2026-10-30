/**
 * GET /api/cron/daily-news does not generate a monthly report (#182).
 *
 * Why: #182 (owner ruling): only the 1st-of-month cron writes a month's
 * report, once the month has closed. The daily-news cron used to regenerate
 * the open month after every successful ingestion run (#160); that step and
 * its `data.whatsNewSummary` field are removed, and the run's status and
 * result must not depend on any report generation.
 * What: Drives the real GET handler with the ingestion service and cache
 * invalidation replaced and `WhatsNewSummaryService` replaced by a class that
 * records its construction and every method call. For a completed and a
 * failed run, the generator is never constructed or called, the status is
 * unchanged (200 / 500), and `data` holds exactly the ingestion fields.
 * Test: `npx vitest run tests/unit/cron-daily-news-summary.test.ts`. No
 * network, no database.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runDailyDiscovery: vi.fn(),
  generatorConstructed: vi.fn(),
  generateMonthlySummary: vi.fn(),
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
    constructor() {
      mocks.generatorConstructed();
    }
    generateMonthlySummary = mocks.generateMonthlySummary;
    regenerateIfChanged = mocks.regenerateIfChanged;
  },
}));

import { GET } from "../../app/api/cron/daily-news/route";

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

const FAILED = {
  ...INGESTION,
  status: "failed",
  articlesIngested: 0,
  ingestedArticleIds: [],
  errors: ["OpenRouter API error (402): insufficient credits"],
};

function authorizedRequest(): Request {
  return new Request("https://aipowerranking.com/api/cron/daily-news", {
    headers: { authorization: `Bearer ${SECRET}` },
  });
}

describe("GET /api/cron/daily-news — no monthly report generation (#182)", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    process.env["CRON_SECRET"] = SECRET;
  });

  afterEach(() => {
    if (originalCronSecret === undefined) delete process.env["CRON_SECRET"];
    else process.env["CRON_SECRET"] = originalCronSecret;
  });

  it.each([
    { label: "a completed run", run: INGESTION, status: 200, success: true },
    { label: "a failed run", run: FAILED, status: 500, success: false },
  ])("never constructs or calls the monthly generator after $label", async ({ run, status, success }) => {
    mocks.runDailyDiscovery.mockResolvedValue(run);

    const response = await GET(authorizedRequest());

    expect(response.status).toBe(status);
    expect(mocks.runDailyDiscovery).toHaveBeenCalledTimes(1);
    expect(mocks.generatorConstructed).not.toHaveBeenCalled();
    expect(mocks.generateMonthlySummary).not.toHaveBeenCalled();
    expect(mocks.regenerateIfChanged).not.toHaveBeenCalled();
    const payload = (await response.json()) as { success: boolean; data: Record<string, unknown> };
    expect(payload.success).toBe(success);
    // The run result is the ingestion result only: no report field.
    expect(payload.data).not.toHaveProperty("whatsNewSummary");
    expect(payload.data).toEqual(run);
  });
});
