/**
 * The daily-news cron passes the short provider window (#476).
 *
 * Why: the cron called runDailyDiscovery() with no arguments, so every daily
 * run asked providers for 14 days of results.
 * What: Drives the real GET handler with the ingestion service replaced and
 * asserts the `days` it passes.
 * Test: `npx vitest run tests/unit/cron-daily-news-window-476.test.ts`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ runDailyDiscovery: vi.fn() }));

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

import { GET } from "../../app/api/cron/daily-news/route";

const SECRET = "cron-secret-fixture-value";
const original = process.env["CRON_SECRET"];

describe("GET /api/cron/daily-news provider window (#476)", () => {
  beforeEach(() => {
    mocks.runDailyDiscovery.mockReset();
    process.env["CRON_SECRET"] = SECRET;
  });

  afterEach(() => {
    if (original === undefined) delete process.env["CRON_SECRET"];
    else process.env["CRON_SECRET"] = original;
  });

  it("passes a 2-3 day window to runDailyDiscovery", async () => {
    mocks.runDailyDiscovery.mockResolvedValue({
      runId: "r",
      status: "completed",
      articlesDiscovered: 0,
      articlesPassedQuality: 0,
      articlesIngested: 0,
      articlesSkipped: 0,
      rankingChanges: 0,
      estimatedCostUsd: 0,
      errors: [],
      ingestedArticleIds: [],
      durationMs: 1,
    });

    await GET(
      new Request("https://aipowerranking.com/api/cron/daily-news", {
        headers: { authorization: `Bearer ${SECRET}` },
      })
    );

    const days = mocks.runDailyDiscovery.mock.calls[0][0]?.days;
    expect(days).toBeGreaterThanOrEqual(2);
    expect(days).toBeLessThanOrEqual(3);
  });
});
