import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression tests for #124 — run-row finalization.
 *
 * Why: A DB diagnostic on run 483bd3e8 (2026-08-29, daily_news) found the run
 * row still reading status='running', completedAt=null, and all six counters
 * 0 — while 9 article rows already carried its ingestion_run_id. Article
 * ingestion had run to completion, but the run's own tracking row was never
 * finalized. Root cause: `updateRun()` was called from a single site per exit
 * branch (7 early-return branches, the success path, and 2 outer catches),
 * each with its own log-and-swallow catch and no retry — if that one call
 * failed (e.g. a dropped DB connection near a serverless timeout), the row
 * was abandoned in its create-time state forever. PR #111 fixed a related but
 * narrower completedAt-stamping bug in the same method without touching this.
 *
 * What: A fake `getDb()` simulates the automated_ingestion_runs table: insert
 * (createRun) seeds a row matching real create-time defaults, and update
 * (updateRun) merges its payload into that row — or throws, per a
 * test-configured rule — so each test can assert what the row would actually
 * look like in Postgres after a run, not just what updateRun() was called
 * with. Discovery/quality/ingestion collaborators are mocked the same way
 * lib/services/automated-ingestion.recency.test.ts does it, so the real
 * pipeline logic (ingest loop, status determination, finalization) runs
 * unmodified.
 *
 * Test: `npx vitest run lib/services/automated-ingestion.run-finalization.test.ts`.
 * Stash the fix (`git stash`) and re-run to see the first two tests fail
 * against the pre-fix code — both assert the row was actually persisted, and
 * pre-fix there is exactly one updateRun() call with no recovery path. The
 * third test isolates finalizeRun's retry specifically (as opposed to test 1,
 * which happens to pass even without a retry): delete the retry block in
 * finalizeRun() and only that test fails.
 */

const RUN_ID = "run-124-fixture";

// vi.mock() factories are hoisted above ordinary `const` declarations, so any
// mock state the factory closes over must be created via vi.hoisted() — see
// the same note in automated-ingestion.updateRun.test.ts.
const { simulatedRow, updateBehavior, resetDbFixture } = vi.hoisted(() => {
  const row: Record<string, unknown> = {};
  const behavior: { shouldFail: (payload: Record<string, unknown>, callIndex: number) => boolean } = {
    shouldFail: () => false,
  };

  function reset(): void {
    for (const key of Object.keys(row)) delete row[key];
    Object.assign(row, {
      status: "running",
      completedAt: null,
      articlesDiscovered: 0,
      articlesPassedQuality: 0,
      articlesIngested: 0,
      articlesSkipped: 0,
      articlesSkippedSemantic: 0,
      rankingChanges: 0,
      estimatedCostUsd: "0",
    });
    behavior.shouldFail = () => false;
  }

  return { simulatedRow: row, updateBehavior: behavior, resetDbFixture: reset };
});

// Relative path — tsconfig excludes *.test.ts from `include`, so the "@/..."
// alias never resolves inside this file itself; see
// automated-ingestion.updateRun.test.ts for the full explanation.
vi.mock("../db/connection", () => {
  let updateCallIndex = 0;

  return {
    getDb: () => ({
      // createRun(): db.insert(automatedIngestionRuns).values({...}).returning()
      insert: () => ({
        values: (data: Record<string, unknown>) => ({
          returning: async () => {
            Object.assign(simulatedRow, data);
            return [{ id: RUN_ID, ...data }];
          },
        }),
      }),
      // updateRun(): db.update(...).set({...}).where(...).returning()
      update: () => ({
        set: (data: Record<string, unknown>) => ({
          where: () => ({
            returning: async () => {
              updateCallIndex += 1;
              if (updateBehavior.shouldFail(data, updateCallIndex)) {
                throw new Error(`Simulated DB failure on update call #${updateCallIndex}`);
              }
              Object.assign(simulatedRow, data);
              return [{ id: RUN_ID, ...simulatedRow }];
            },
          }),
        }),
      }),
      // checkDuplicates(): db.select(...).from(articles).where(inArray(...))
      // getRecentArticleTitles(): db.select(...).from(articles).where(gte(...)).orderBy(...)
      // A single thenable/orderBy-capable object satisfies both call shapes:
      // `await ...where(...)` resolves it directly (via `.then`), and
      // `...where(...).orderBy(...)` calls it as a method.
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => Promise.resolve([]),
            then: (resolve: (value: unknown[]) => void) => resolve([]),
          }),
        }),
      }),
    }),
  };
});

import { AutomatedIngestionService } from "./automated-ingestion.service";
import type { TavilySearchService } from "./tavily-search.service";
import type { BraveSearchService } from "./brave-search.service";
import type { ArticleIngestionService } from "./article-ingestion.service";

/** One fresh (published "now"), fully-contentful discovery result. */
function freshSearchResult(url: string) {
  return {
    title: `Article at ${url}`,
    url,
    description: "An AI coding tool announcement used as a discovery fixture.",
    source: "example.com",
    publishedDate: new Date().toISOString(),
    content:
      "An AI coding assistant vendor announced a new agentic feature today. " +
      "This fixture body exists only to clear the 100-character sufficiency " +
      "threshold so no extraction call is attempted during the test run.",
    score: 0.9,
  };
}

/** Wires discovery + ingestion collaborators so one article ingests successfully. */
function injectHappyPathServices(
  service: AutomatedIngestionService,
  ingestArticle: ReturnType<typeof vi.fn>
): void {
  const internal = service as unknown as {
    _tavilySearchService: Partial<TavilySearchService>;
    _braveSearchService: Partial<BraveSearchService>;
    _articleIngestionService: Partial<ArticleIngestionService>;
  };

  internal._tavilySearchService = {
    isConfigured: () => true,
    searchAINews: vi.fn().mockResolvedValue([freshSearchResult("https://example.com/a")]),
  } as unknown as Partial<TavilySearchService>;

  internal._braveSearchService = {
    isAvailable: () => false,
    searchAINews: vi.fn(),
  } as unknown as Partial<BraveSearchService>;

  internal._articleIngestionService = {
    ingestArticle,
  } as unknown as Partial<ArticleIngestionService>;
}

describe("AutomatedIngestionService - run row finalization (#124)", () => {
  let service: AutomatedIngestionService;
  let ingestArticle: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resetDbFixture();
    service = new AutomatedIngestionService();
    ingestArticle = vi.fn().mockResolvedValue({ id: "article-1", rankingChangesApplied: 0 });
    injectHappyPathServices(service, ingestArticle);
  });

  /**
   * The core fail-open regression. A transient DB failure hits the FIRST
   * write attempted after article ingestion — modeling exactly the dropped
   * connection that stranded run 483bd3e8. Every write after that first one
   * succeeds (the connection recovered), so a run that retries the failed
   * write — or has a second, independent write scheduled after it — should
   * still land a finalized row.
   *
   * Pre-fix, there is exactly one updateRun() call for a successful run (the
   * old "Step 6"), it IS the first write attempted, it fails, and nothing
   * else ever touches the row: it is abandoned at status='running',
   * completedAt=null, articlesIngested=0. This assertion fails against that
   * code.
   */
  it("still lands a finalized row when the first post-ingest write fails transiently", async () => {
    updateBehavior.shouldFail = (_payload, callIndex) => callIndex === 1;

    const result = await service.runDailyDiscovery({
      skipQualityCheck: true,
      maxArticles: 5,
    });

    expect(result.articlesIngested).toBe(1);
    expect(ingestArticle).toHaveBeenCalledTimes(1);

    expect(simulatedRow.status).not.toBe("running");
    expect(simulatedRow.completedAt).not.toBeNull();
    expect(simulatedRow.articlesIngested).toBe(1);
  });

  /**
   * The discriminating case for finalizeRun's retry specifically. Test 1
   * above ("still lands a finalized row...") fails the very first write
   * attempted after ingestion and happens to pass even if finalizeRun's
   * retry were deleted, because in that scenario the LATER, independent
   * checkpoint-vs-final call structure is what recovers — not the retry
   * itself. This test isolates the retry in isolation: only the terminal
   * status-carrying write's FIRST attempt fails; its second attempt (the
   * retry) succeeds. If finalizeRun's retry block were deleted, the single
   * un-retried attempt hits this failure and the row is abandoned at
   * status='running' — this test fails.
   */
  it("recovers the terminal status write via finalizeRun's retry", async () => {
    let statusCallCount = 0;
    updateBehavior.shouldFail = (payload) => {
      if (!("status" in payload)) return false; // checkpoint write always succeeds
      statusCallCount += 1;
      return statusCallCount === 1; // fail only the first status-carrying attempt
    };

    const result = await service.runDailyDiscovery({
      skipQualityCheck: true,
      maxArticles: 5,
    });

    expect(result.articlesIngested).toBe(1);
    // Exactly one retry happened: the first status-carrying attempt failed,
    // the second (the retry) succeeded. Not 1 (no retry attempted) and not
    // >2 (retrying more than once, which finalizeRun does not do).
    expect(statusCallCount).toBe(2);

    expect(simulatedRow.status).not.toBe("running");
    expect(simulatedRow.completedAt).not.toBeNull();
    expect(simulatedRow.articlesIngested).toBe(1);

    // The retry recovered, so no persistence-failure message should have
    // leaked into the returned pipeline result.
    expect(result.errors).toEqual([]);
  });

  /**
   * Isolates the checkpoint specifically: every write that carries a
   * `status` (i.e. every attempt to finalize the run) fails permanently, but
   * writes that only carry counters keep succeeding. This models a narrower,
   * plausible failure (e.g. a constraint or trigger on the status column)
   * where the row can never be marked complete, but proves ingestion counts
   * are not silently lost along with it.
   *
   * Pre-fix, the only updateRun() call in the success path always carries
   * `status`, so it always fails here — the row never receives the real
   * count and stays at articlesIngested=0. This assertion fails against that
   * code.
   */
  it("persists real ingestion counts even when the terminal status write can never succeed", async () => {
    updateBehavior.shouldFail = (payload) => "status" in payload;

    const result = await service.runDailyDiscovery({
      skipQualityCheck: true,
      maxArticles: 5,
    });

    expect(result.articlesIngested).toBe(1);
    // The checkpoint write (no `status` field) is expected to have gone
    // through even though the row can never be marked finalized.
    expect(simulatedRow.articlesIngested).toBe(1);
    expect(simulatedRow.status).toBe("running");
  });

  /**
   * Persistence failing must never mask what the pipeline actually did. Every
   * write fails (a sustained outage, not a transient blip), so the row is
   * never updated past its create-time defaults — but the IngestionResult
   * runDailyDiscovery() returns to its caller (and that the cron route turns
   * into an API response) must still report the real, successful outcome.
   *
   * It must also not go silent about the persistence failure itself: the
   * pre-#124 success path appended a "Status update failed: …" message to
   * `result.errors` when its one write failed, so an operator reading the
   * API response (not just server logs) could tell the row didn't land.
   * finalizeRun's return value restores that same reporting — see the
   * `finally` block in executeDailyDiscovery.
   */
  it("does not let a fully failed updateRun mask the returned pipeline result, and still reports the persistence failure", async () => {
    updateBehavior.shouldFail = () => true;

    const result = await service.runDailyDiscovery({
      skipQualityCheck: true,
      maxArticles: 5,
    });

    expect(result.status).toBe("completed");
    expect(result.articlesIngested).toBe(1);
    expect(result.ingestedArticleIds).toEqual(["article-1"]);

    // The row itself never moved off its create-time defaults — expected,
    // since every write failed — but that must show up as a DB-layer
    // problem for operators to find, never as a corrupted pipeline result.
    expect(simulatedRow.status).toBe("running");

    // ...and it must show up in the RETURNED result too, not just server logs.
    expect(result.errors.some((e) => e.includes("Run row persistence failed"))).toBe(true);
  });
});
