import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression tests for #128 — a timed-out pipeline overwriting its own
 * terminal status.
 *
 * Why: runDailyDiscovery races executeDailyDiscovery(...) against a 10-minute
 * timeout via Promise.race, and never cancels the losing side. When the
 * timeout wins, its handler writes status='failed' through updateRun(). The
 * abandoned executeDailyDiscovery call keeps running in the background and,
 * before this fix, its own finalize write in the `finally` block could still
 * land afterward — unconditionally replacing the status='failed' row with a
 * stale 'completed'/'partial' and resetting completedAt to a later, wrong
 * time. This was documented as "gap 2" in executeDailyDiscovery's `finally`
 * block (added by PR #129 / c402fbf5) and is fixed here, not there: the fix
 * lives in updateRun() itself, the single write path both the timeout
 * handler and the abandoned pipeline's finalize call funnel through.
 *
 * What: A fake getDb() simulates the automated_ingestion_runs table and
 * actually evaluates the WHERE clause updateRun() passes to `.where(...)`
 * (a real, unmocked drizzle-orm `eq`/`and` expression tree — only getDb() is
 * mocked) against the simulated row's current column values, the same way
 * Postgres would: a condition that does not match means the row is not
 * selected, so NONE of the write's `.set()` payload applies to it — not just
 * the status field. This makes the test discriminating: it fails
 * pre-fix (where updateRun's WHERE clause is `eq(id, runId)` alone, which
 * always matches) and passes post-fix (where a terminal write's WHERE clause
 * adds `eq(status, 'running')`).
 *
 * Test: `npx vitest run lib/services/automated-ingestion.status-guard.test.ts`.
 * Stash the fix (`git stash`) and re-run to see the first test fail: the
 * late 'completed' write has no status guard to fail against pre-fix, so it
 * applies unconditionally and downgrades the row.
 *
 * Also covers a code-critic finding on the first version of this fix: a
 * terminal write matching zero rows used to be treated as an automatic
 * race-loss no-op, which silently swallowed the OTHER reason zero rows can
 * come back — runId does not exist at all (the pre-#128 behavior, which
 * threw and surfaced into the caller's result.errors). updateRun() now runs
 * one existence-only SELECT to tell the two apart; `rowExistsRef` lets these
 * tests drive that SELECT's answer independently of the UPDATE fixture.
 */

const RUN_ID = "run-128-fixture";

// vi.mock() factories are hoisted above ordinary `const` declarations, so any
// mock state the factory closes over must be created via vi.hoisted() — see
// the same note in automated-ingestion.run-finalization.test.ts.
const { simulatedRow, rowExistsRef, resetDbFixture, extractEqConditions } = vi.hoisted(() => {
  const row: Record<string, unknown> = {};
  const existsRef = { current: true };

  function reset(): void {
    for (const key of Object.keys(row)) delete row[key];
    Object.assign(row, {
      id: RUN_ID,
      status: "running",
      completedAt: null,
      articlesDiscovered: 0,
      articlesIngested: 0,
    });
    existsRef.current = true;
  }

  /**
   * Walks a drizzle-orm SQL expression tree (as built by real, unmocked
   * `eq()`/`and()` calls) and extracts every `[columnName, boundValue]`
   * equality pair it contains, in the order they appear. Depends only on the
   * shape drizzle-orm produces for plain `eq()` conditions optionally
   * combined with `and()` — the only shapes updateRun() ever builds.
   */
  function extractEqConditions(node: unknown): Array<[string, unknown]> {
    const tokens: Array<{ name?: string; value?: unknown }> = [];

    function walk(n: unknown): void {
      if (!n || typeof n !== "object") return;
      const obj = n as { queryChunks?: unknown[]; name?: unknown; value?: unknown };
      if (Array.isArray(obj.queryChunks)) {
        for (const chunk of obj.queryChunks) walk(chunk);
        return;
      }
      if (typeof obj.name === "string") {
        tokens.push({ name: obj.name });
        return;
      }
      if ("value" in obj && !Array.isArray(obj.value)) {
        tokens.push({ value: obj.value });
      }
    }
    walk(node);

    const pairs: Array<[string, unknown]> = [];
    for (let i = 0; i < tokens.length - 1; i++) {
      if (tokens[i]?.name !== undefined && tokens[i + 1]?.value !== undefined) {
        pairs.push([tokens[i]!.name as string, tokens[i + 1]!.value]);
      }
    }
    return pairs;
  }

  return { simulatedRow: row, rowExistsRef: existsRef, resetDbFixture: reset, extractEqConditions };
});

// Relative path — tsconfig excludes *.test.ts from `include`, so the "@/..."
// alias never resolves inside this file itself; see
// automated-ingestion.updateRun.test.ts for the full explanation.
vi.mock("../db/connection", () => ({
  getDb: () => ({
    update: () => ({
      set: (data: Record<string, unknown>) => ({
        where: (whereArg: unknown) => ({
          returning: async () => {
            if (!rowExistsRef.current) return [];
            const conditions = extractEqConditions(whereArg);
            const rowMatches = conditions.every(([column, value]) => simulatedRow[column] === value);
            if (!rowMatches) {
              return [];
            }
            Object.assign(simulatedRow, data);
            return [{ ...simulatedRow }];
          },
        }),
      }),
    }),
    // updateRun()'s zero-rows-on-a-terminal-write branch runs this existence
    // check (db.select({status}).from(...).where(eq(id, runId)).limit(1)) to
    // tell a race loss (row exists) apart from a genuinely missing run (row
    // absent) — see updateRun's doc comment.
    select: () => ({
      from: () => ({
        where: (whereArg: unknown) => ({
          limit: async () => {
            if (!rowExistsRef.current) return [];
            const conditions = extractEqConditions(whereArg);
            const rowMatches = conditions.every(([column, value]) => simulatedRow[column] === value);
            return rowMatches ? [{ status: simulatedRow.status }] : [];
          },
        }),
      }),
    }),
  }),
}));

import { AutomatedIngestionService } from "./automated-ingestion.service";

describe("AutomatedIngestionService.updateRun - terminal-status race guard (#128)", () => {
  let service: AutomatedIngestionService;

  beforeEach(() => {
    resetDbFixture();
    service = new AutomatedIngestionService();
  });

  /**
   * The core regression. Models the exact race from the finally-block
   * comment: the timeout handler's write lands first (status='failed'), the
   * abandoned pipeline's finalize write lands second (status='completed').
   */
  it("keeps a 'failed' row's status and completedAt when a late finalize attempts 'completed'", async () => {
    // First write: runDailyDiscovery's timeout handler.
    await service.updateRun(RUN_ID, {
      status: "failed",
      errors: ["Pipeline timeout: exceeded 600s"],
    });

    expect(simulatedRow.status).toBe("failed");
    expect(simulatedRow.completedAt).toBeInstanceOf(Date);
    const originalCompletedAt = simulatedRow.completedAt;

    // Second write: the abandoned executeDailyDiscovery call's own finalize,
    // arriving after the timeout already decided the run failed.
    await service.updateRun(RUN_ID, {
      status: "completed",
      articlesIngested: 3,
    });

    expect(simulatedRow.status).toBe("failed");
    expect(simulatedRow.completedAt).toBe(originalCompletedAt);
    // The late write's entire SET clause was rejected by the WHERE guard,
    // not just its status field — so its counters did not land either.
    expect(simulatedRow.articlesIngested).toBe(0);
  });

  /**
   * Design decision: a checkpoint write (no `status` field) is NOT guarded
   * by the terminal-status WHERE clause, so real ingestion counts recorded
   * by an abandoned pipeline still land even after the row has gone
   * terminal. Only the status-bearing write is guarded.
   */
  it("still applies a counter-only checkpoint write after the row has gone terminal", async () => {
    await service.updateRun(RUN_ID, { status: "failed", errors: ["boom"] });
    expect(simulatedRow.status).toBe("failed");

    await service.updateRun(RUN_ID, { articlesDiscovered: 7, articlesIngested: 3 });

    expect(simulatedRow.status).toBe("failed");
    expect(simulatedRow.articlesIngested).toBe(3);
    expect(simulatedRow.articlesDiscovered).toBe(7);
  });

  /**
   * The normal, non-racing path is unchanged: a single terminal write against
   * a row still 'running' applies exactly as before.
   */
  it("applies a terminal write normally when the row is still 'running'", async () => {
    await service.updateRun(RUN_ID, {
      status: "completed",
      articlesIngested: 5,
    });

    expect(simulatedRow.status).toBe("completed");
    expect(simulatedRow.articlesIngested).toBe(5);
    expect(simulatedRow.completedAt).toBeInstanceOf(Date);
  });

  /**
   * Code-critic finding: zero rows on a terminal write must not be treated
   * as an automatic race-loss no-op — that would also swallow the case where
   * runId simply does not exist. The row exists (rowExistsRef stays true)
   * but is already terminal, so the follow-up existence check finds it and
   * this is correctly a race loss.
   */
  it("treats zero rows as a race loss (not an error) when the row exists but is no longer 'running'", async () => {
    await service.updateRun(RUN_ID, { status: "failed", errors: ["boom"] });
    expect(simulatedRow.status).toBe("failed");

    await expect(
      service.updateRun(RUN_ID, { status: "completed", articlesIngested: 9 })
    ).resolves.toBeUndefined();

    expect(simulatedRow.status).toBe("failed");
    expect(simulatedRow.articlesIngested).toBe(0);
  });

  /**
   * Code-critic finding, the other branch: zero rows because runId is
   * genuinely missing (rowExistsRef set false) must still throw, restoring
   * the pre-#128 error behavior — a persistence failure for a run that never
   * existed must not go silent.
   */
  it("throws when the row genuinely does not exist (not merely a race loss)", async () => {
    rowExistsRef.current = false;

    await expect(service.updateRun(RUN_ID, { status: "completed", articlesIngested: 1 })).rejects.toThrow(
      /No ingestion run found/
    );
  });
});
