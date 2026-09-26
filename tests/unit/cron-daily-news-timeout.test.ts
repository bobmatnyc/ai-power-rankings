/**
 * The ingestion pipeline timeout fits inside the cron function limit (#160).
 *
 * Why: `PIPELINE_TIMEOUT_MS` was 10 minutes while the route's `maxDuration`
 * is 300 s, so Vercel killed a slow run first: the run row stayed "running",
 * the route returned no result, and the what's-new summary step never ran.
 * What: Drives the real GET handler and the real `runDailyDiscovery` timeout
 * guard, with the pipeline body replaced by one that never finishes, under
 * fake timers. By the time a run still leaves the summary its minimum budget,
 * the route must have marked the run failed, returned a structured 200 result,
 * and handed the summary step at least `MIN_GENERATION_BUDGET_MS`. Also pins
 * the admin summary POST's `maxDuration`.
 * Test: `npx vitest run tests/unit/cron-daily-news-timeout.test.ts`. No
 * network, no database.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const summary = vi.hoisted(() => ({
  regenerate: vi.fn<(options: { timeBudgetMs: number }) => Promise<unknown>>(async () => ({
    status: "skipped",
    period: "2026-09",
    reason: "unchanged",
  })),
}));

vi.mock("../../lib/db/connection", () => ({ getDb: () => null }));
vi.mock("../../lib/cache/invalidation.service", () => ({ invalidateArticleCache: vi.fn() }));
vi.mock("../../lib/services/whats-new-auto-regenerate", () => ({
  autoRegenerateMonthlySummary: summary.regenerate,
}));

import { GET, maxDuration } from "../../app/api/cron/daily-news/route";
import { maxDuration as summaryPostMaxDuration } from "../../app/api/whats-new/summary/route";
import { AutomatedIngestionService } from "../../lib/services/automated-ingestion.service";
import { MIN_GENERATION_BUDGET_MS } from "../../lib/services/whats-new-summary.service";

const SECRET = "cron-secret-fixture-value";
const RUN_ID = "run-timeout-fixture";
const originalCronSecret = process.env["CRON_SECRET"];

type Payload = {
  success: boolean;
  data: { runId: string; status: string; errors: string[]; whatsNewSummary: unknown };
};

describe("GET /api/cron/daily-news — pipeline timeout inside maxDuration", () => {
  let updateRun: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    process.env["CRON_SECRET"] = SECRET;
    summary.regenerate.mockClear();
    // A pipeline that creates its run row and then never finishes.
    vi.spyOn(
      AutomatedIngestionService.prototype as unknown as {
        executeDailyDiscovery: (o: unknown, s: number, ref: { current: string }) => Promise<never>;
      },
      "executeDailyDiscovery"
    ).mockImplementation((_options, _start, runIdRef) => {
      runIdRef.current = RUN_ID;
      return new Promise<never>(() => undefined);
    });
    updateRun = vi.spyOn(AutomatedIngestionService.prototype, "updateRun").mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    if (originalCronSecret === undefined) delete process.env["CRON_SECRET"];
    else process.env["CRON_SECRET"] = originalCronSecret;
  });

  it("marks the run failed and returns a structured result while the summary step still has its budget", async () => {
    let settled = false;
    const pending = GET(
      new Request("https://aipowerranking.com/api/cron/daily-news", {
        headers: { authorization: `Bearer ${SECRET}` },
      })
    ).finally(() => {
      settled = true;
    });

    // The latest moment that still leaves the summary step its minimum budget.
    await vi.advanceTimersByTimeAsync(maxDuration * 1000 - MIN_GENERATION_BUDGET_MS);
    expect(settled).toBe(true);

    const response = await pending;
    expect(response.status).toBe(200);
    const payload = (await response.json()) as Payload;
    expect(payload.success).toBe(true);
    expect(payload.data).toMatchObject({ runId: RUN_ID, status: "failed" });
    expect(payload.data.errors).toEqual([expect.stringMatching(/^Pipeline timeout: exceeded \d+s$/)]);
    expect(payload.data.whatsNewSummary).toMatchObject({ status: "skipped" });

    expect(updateRun).toHaveBeenCalledWith(
      RUN_ID,
      expect.objectContaining({ status: "failed", errors: payload.data.errors })
    );

    expect(summary.regenerate).toHaveBeenCalledTimes(1);
    expect(summary.regenerate.mock.calls[0][0].timeBudgetMs).toBeGreaterThanOrEqual(
      MIN_GENERATION_BUDGET_MS
    );
  });
});

describe("POST /api/whats-new/summary — function limit", () => {
  it("allows 300 s for an admin regeneration, like /api/cron/monthly-summary", () => {
    expect(summaryPostMaxDuration).toBe(300);
  });
});
