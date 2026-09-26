/**
 * Ingestion and the what's-new summary share the cron function limit (#160).
 *
 * Why: Vercel kills GET /api/cron/daily-news at `maxDuration` (300 s). The
 * pipeline timeout used to be 10 minutes, so a slow run was killed with its
 * run row left "running". Ingestion has priority over the summary, which
 * retries daily: a slow run must still finish, the summary step is the one
 * that yields, and a hung failed-run write must not hold the function.
 * What: Drives the real GET handler, the real `runDailyDiscovery` timeout
 * guard and the real summary budget check under fake timers. Only the
 * pipeline body, `updateRun`, the cache and the database are replaced, and
 * `fetch` fails the test if the LLM is called. Also pins the admin summary
 * POST's `maxDuration`.
 * Test: `npx vitest run tests/unit/cron-daily-news-timeout.test.ts`. No
 * network, no database.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/db/connection", () => ({ getDb: () => null }));
vi.mock("../../lib/startup-validation", () => ({ getOpenRouterApiKey: () => "test-key" }));
vi.mock("../../lib/cache/invalidation.service", () => ({
  invalidateArticleCache: vi.fn(async () => ({
    pathsRevalidated: [],
    tagsRevalidated: [],
    memoryCacheCleared: [],
    success: true,
  })),
}));

import { GET, maxDuration } from "../../app/api/cron/daily-news/route";
import { maxDuration as summaryPostMaxDuration } from "../../app/api/whats-new/summary/route";
import {
  AutomatedIngestionService,
  type IngestionResult,
} from "../../lib/services/automated-ingestion.service";
import {
  MIN_GENERATION_BUDGET_MS,
  WhatsNewSummaryService,
} from "../../lib/services/whats-new-summary.service";

const SECRET = "cron-secret-fixture-value";
const RUN_ID = "run-timeout-fixture";
const LIMIT_MS = maxDuration * 1000;
const originalCronSecret = process.env["CRON_SECRET"];

type Payload = {
  success: boolean;
  data: { runId: string; status: string; errors: string[]; whatsNewSummary: unknown };
};

const llm = vi.fn(async () => {
  throw new Error("the LLM must not be called in this test");
});

/** Replaces the pipeline body: sets the run id, then settles after `ms` (never when null). */
function pipelineTakes(ms: number | null): void {
  vi.spyOn(
    AutomatedIngestionService.prototype as unknown as {
      executeDailyDiscovery: (o: unknown, s: number, ref: { current: string }) => Promise<IngestionResult>;
    },
    "executeDailyDiscovery"
  ).mockImplementation((_options, _start, runIdRef) => {
    runIdRef.current = RUN_ID;
    if (ms === null) return new Promise<IngestionResult>(() => undefined);
    return new Promise<IngestionResult>((resolve) =>
      setTimeout(
        () =>
          resolve({
            runId: RUN_ID,
            status: "completed",
            articlesDiscovered: 8,
            articlesPassedQuality: 4,
            articlesIngested: 4,
            articlesSkipped: 4,
            articlesSkippedSemantic: 0,
            articlesSkippedStale: 0,
            candidateOutcomes: [],
            rankingChanges: 0,
            estimatedCostUsd: 0.02,
            errors: [],
            ingestedArticleIds: ["a1", "a2", "a3", "a4"],
            durationMs: ms,
          }),
        ms
      )
    );
  });
}

/** Calls the route and reports whether it has returned after `ms` of fake time. */
async function runCronFor(ms: number): Promise<{ settled: boolean; response: Promise<Response> }> {
  let settled = false;
  const response = GET(
    new Request("https://aipowerranking.com/api/cron/daily-news", {
      headers: { authorization: `Bearer ${SECRET}` },
    })
  ).finally(() => {
    settled = true;
  });
  await vi.advanceTimersByTimeAsync(ms);
  return { settled, response };
}

describe("GET /api/cron/daily-news — ingestion and summary inside maxDuration", () => {
  let updateRun: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", llm);
    llm.mockClear();
    process.env["CRON_SECRET"] = SECRET;
    updateRun = vi.spyOn(AutomatedIngestionService.prototype, "updateRun").mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    if (originalCronSecret === undefined) delete process.env["CRON_SECRET"];
    else process.env["CRON_SECRET"] = originalCronSecret;
  });

  it("marks a pipeline that never finishes failed and returns a structured 200 before the limit", async () => {
    pipelineTakes(null);

    const { settled, response } = await runCronFor(LIMIT_MS);
    expect(settled).toBe(true);

    const res = await response;
    expect(res.status).toBe(200);
    const payload = (await res.json()) as Payload;
    expect(payload.success).toBe(true);
    expect(payload.data).toMatchObject({ runId: RUN_ID, status: "failed" });
    expect(payload.data.errors).toEqual([expect.stringMatching(/^Pipeline timeout: exceeded \d+s$/)]);
    expect(updateRun).toHaveBeenCalledWith(
      RUN_ID,
      expect.objectContaining({ status: "failed", errors: payload.data.errors })
    );
    expect(payload.data.whatsNewSummary).toMatchObject({
      status: "skipped",
      reason: "insufficient-time-budget",
    });
    expect(llm).not.toHaveBeenCalled();
  });

  it("lets a 250 s run succeed and skips the summary for budget without an LLM call", async () => {
    pipelineTakes(250_000);
    const summaryReads = vi.spyOn(WhatsNewSummaryService.prototype, "getCachedSummary");

    const { settled, response } = await runCronFor(LIMIT_MS);
    expect(settled).toBe(true);

    const payload = (await (await response).json()) as Payload;
    expect(payload.success).toBe(true);
    expect(payload.data).toMatchObject({ runId: RUN_ID, status: "completed", errors: [] });
    expect(updateRun).not.toHaveBeenCalledWith(RUN_ID, expect.objectContaining({ status: "failed" }));
    expect(payload.data.whatsNewSummary).toMatchObject({
      status: "skipped",
      reason: "insufficient-time-budget",
    });
    expect(summaryReads).not.toHaveBeenCalled();
    expect(llm).not.toHaveBeenCalled();
  });

  it("gives an early-finishing run's summary step at least the minimum budget", async () => {
    pipelineTakes(30_000);
    const regenerate = vi
      .spyOn(WhatsNewSummaryService.prototype, "regenerateIfChanged")
      .mockImplementation(async (period) => ({ status: "generated", period, generationTimeMs: 1 }));

    const { settled, response } = await runCronFor(LIMIT_MS);
    expect(settled).toBe(true);

    const payload = (await (await response).json()) as Payload;
    expect(payload.data).toMatchObject({ status: "completed" });
    expect(payload.data.whatsNewSummary).toMatchObject({ status: "generated" });
    expect(regenerate).toHaveBeenCalledTimes(1);
    expect(regenerate.mock.calls[0][1]).toBeGreaterThanOrEqual(MIN_GENERATION_BUDGET_MS);
  });

  it("returns before the limit when the failed-run write hangs, and reports the unpersisted row", async () => {
    pipelineTakes(null);
    updateRun.mockImplementation(() => new Promise<void>(() => undefined));

    const { settled, response } = await runCronFor(LIMIT_MS);
    expect(settled).toBe(true);

    const res = await response;
    expect(res.status).toBe(200);
    const payload = (await res.json()) as Payload;
    expect(payload.data.status).toBe("failed");
    expect(payload.data.errors).toEqual([
      expect.stringMatching(/^Pipeline timeout: exceeded \d+s$/),
      expect.stringContaining(`Run row persistence failed or timed out (runId=${RUN_ID})`),
    ]);
  });
});

describe("POST /api/whats-new/summary — function limit", () => {
  it("allows 300 s for an admin regeneration, like /api/cron/monthly-summary", () => {
    expect(summaryPostMaxDuration).toBe(300);
  });
});
