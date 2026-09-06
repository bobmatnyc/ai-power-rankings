/**
 * Regression coverage for the ingestion gap-detector's yield-aware alerting (issue #105).
 *
 * Why: check-ingestion-gap.mjs used to gate purely on "is there a recent row" — a FAILED
 * run, or a run that completes but ingests 0 articles because OpenRouter credits ran out
 * (2026-07-25) or extraction broke (2026-07-19), still writes a row and looked perfectly
 * healthy to both the GitHub Actions watchdog and the macOS notifier. This test pins the
 * corrected contract — evaluateIngestionRuns() must alert on run-absence, failed status,
 * OpenRouter billing errors, and a zero-yield streak, each tagged with a distinct,
 * greppable ALERT[REASON] — so none of those failure modes can silently regress again.
 *
 * Test: Runs under `npm run test:unit`. Exercises evaluateIngestionRuns() directly with
 * synthetic rows and an injected clock — no database access, no network.
 */

import { describe, expect, it } from "vitest";
import {
  CONSECUTIVE_ZERO_YIELD_RUNS,
  FAILED_STATUS,
  MAX_GAP_HOURS,
  errorLogText,
  evaluateIngestionRuns,
} from "../../scripts/check-ingestion-gap.mjs";

const NOW = new Date("2026-07-31T09:00:00.000Z").getTime();

function runAt(hoursAgo: number, overrides: Partial<Record<string, unknown>> = {}) {
  const startedAt = new Date(NOW - hoursAgo * 60 * 60 * 1000).toISOString();
  return {
    started_at: startedAt,
    status: "completed",
    articles_ingested: 5,
    error_log: [],
    ...overrides,
  };
}

describe("evaluateIngestionRuns", () => {
  it("is healthy (exit 0, no ALERT lines) when the latest run is recent, succeeded, and yielded articles", () => {
    const rows = [runAt(2), runAt(26), runAt(50)];
    const result = evaluateIngestionRuns(rows, NOW);

    expect(result.ok).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.lines.some((l) => l.startsWith("ALERT"))).toBe(false);
    expect(result.lines[0]).toMatch(/^OK: /);
  });

  it("alerts ALERT[STALLED] when the latest run is older than MAX_GAP_HOURS", () => {
    const rows = [runAt(MAX_GAP_HOURS + 0.1)];
    const result = evaluateIngestionRuns(rows, NOW);

    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.lines.some((l) => l.startsWith("ALERT[STALLED]"))).toBe(true);
  });

  it("alerts ALERT[NO_RUNS_EVER] when there are no rows at all", () => {
    const result = evaluateIngestionRuns([], NOW);

    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.lines[0]).toMatch(/^ALERT\[NO_RUNS_EVER\]/);
  });

  it("alerts ALERT[RUN_FAILED] when the latest run's status is 'failed', even though it's recent", () => {
    const rows = [runAt(1, { status: FAILED_STATUS, articles_ingested: 0 }), runAt(25), runAt(49)];
    const result = evaluateIngestionRuns(rows, NOW);

    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.lines.some((l) => l.startsWith("ALERT[RUN_FAILED]"))).toBe(true);
  });

  it("alerts ALERT[OPENROUTER_CREDITS] when error_log contains the OpenRouter insufficient-credits message", () => {
    const rows = [
      runAt(1, {
        status: FAILED_STATUS,
        articles_ingested: 0,
        error_log: ["OpenRouter request failed: 402 insufficient credits"],
      }),
      runAt(25),
      runAt(49),
    ];
    const result = evaluateIngestionRuns(rows, NOW);

    expect(result.ok).toBe(false);
    expect(result.lines.some((l) => l.startsWith("ALERT[OPENROUTER_CREDITS]"))).toBe(true);
    // Distinct from (and in addition to) the generic failed-run reason, so an operator can
    // tell "billing" apart from "code failure" at a glance.
    expect(result.lines.some((l) => l.startsWith("ALERT[RUN_FAILED]"))).toBe(true);
  });

  it("alerts ALERT[ZERO_YIELD_STREAK] when the last CONSECUTIVE_ZERO_YIELD_RUNS runs all ingested 0 articles", () => {
    const rows = Array.from({ length: CONSECUTIVE_ZERO_YIELD_RUNS }, (_, i) =>
      runAt((i + 1) * 24, { status: "completed", articles_ingested: 0 })
    );
    const result = evaluateIngestionRuns(rows, NOW);

    expect(result.ok).toBe(false);
    expect(result.lines.some((l) => l.startsWith("ALERT[ZERO_YIELD_STREAK]"))).toBe(true);
  });

  it("does NOT alert on a single zero-yield run — one quiet news day is legitimate", () => {
    const rows = [runAt(1, { articles_ingested: 0 }), runAt(25, { articles_ingested: 3 }), runAt(49, { articles_ingested: 2 })];
    const result = evaluateIngestionRuns(rows, NOW);

    expect(result.ok).toBe(true);
    expect(result.exitCode).toBe(0);
  });

  it("does not false-positive the zero-yield streak on a table with fewer than CONSECUTIVE_ZERO_YIELD_RUNS rows", () => {
    // Only one row exists (e.g. right after the table was created) and it's zero-yield;
    // that alone must not be enough to trip ZERO_YIELD_STREAK.
    const rows = [runAt(1, { articles_ingested: 0 })];
    const result = evaluateIngestionRuns(rows, NOW);

    expect(result.lines.some((l) => l.startsWith("ALERT[ZERO_YIELD_STREAK]"))).toBe(false);
  });
});

/**
 * The gap-detector workflow greps these two lines to decide whether re-triggering the
 * production cron is safe (#134): a row still at 'running' means a previous invocation may
 * be alive, and a LAST_RUN_STARTED that does not move after a fallback call proves the
 * route wrote nothing. Both are a contract with `.github/workflows/cron-gap-detector.yml`,
 * so the exact `KEY=value` shape and the append-not-prepend position are pinned here.
 */
describe("evaluateIngestionRuns — machine-readable state lines (#134)", () => {
  it("appends LAST_STATUS and LAST_RUN_STARTED to a healthy result without displacing the OK line", () => {
    const rows = [runAt(2), runAt(26), runAt(50)];
    const result = evaluateIngestionRuns(rows, NOW);

    expect(result.lines[0]).toMatch(/^OK: /);
    expect(result.lines).toContain("LAST_STATUS=completed");
    expect(result.lines).toContain(`LAST_RUN_STARTED=${new Date(NOW - 2 * 60 * 60 * 1000).toISOString()}`);
  });

  it("reports LAST_STATUS=running for a row still in flight, so the workflow can refuse to overlap it", () => {
    const rows = [runAt(30, { status: "running", articles_ingested: 0 })];
    const result = evaluateIngestionRuns(rows, NOW);

    expect(result.lines.some((l) => l.startsWith("ALERT[STALLED]"))).toBe(true);
    expect(result.lines).toContain("LAST_STATUS=running");
  });

  it("reports LAST_STATUS on an alerting result without displacing the first ALERT line", () => {
    const rows = [runAt(1, { status: FAILED_STATUS, articles_ingested: 0 })];
    const result = evaluateIngestionRuns(rows, NOW);

    expect(result.lines[0]).toMatch(/^ALERT\[RUN_FAILED\]/);
    expect(result.lines).toContain(`LAST_STATUS=${FAILED_STATUS}`);
  });

  it("reports LAST_STATUS=none when no run was ever recorded", () => {
    const result = evaluateIngestionRuns([], NOW);

    expect(result.lines[0]).toMatch(/^ALERT\[NO_RUNS_EVER\]/);
    expect(result.lines).toContain("LAST_STATUS=none");
    expect(result.lines).toContain("LAST_RUN_STARTED=none");
  });
});

describe("errorLogText", () => {
  it("joins string entries and stringifies non-string entries", () => {
    expect(errorLogText(["a", "b"])).toBe("a\nb");
    expect(errorLogText([{ msg: "x" }])).toBe('{"msg":"x"}');
  });

  it("returns an empty string for non-array input", () => {
    expect(errorLogText(null)).toBe("");
    expect(errorLogText(undefined)).toBe("");
  });
});
