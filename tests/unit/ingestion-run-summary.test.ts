/**
 * Why: #172 — the run summary line must name a run's failure cause without copying
 * provider text into the log, and a logging fault must never change a run's outcome.
 * What: Table test for classifyRunFailure; logRunSummary's level choice and its
 * no-throw guarantee. The end-to-end counts are asserted through the real cron route
 * in `tests/unit/cron-daily-news-billing.test.ts`.
 * Test: `npx vitest run tests/unit/ingestion-run-summary.test.ts`.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { loggers } from "../../lib/logger";
import {
  RUN_SUMMARY_MSG,
  classifyRunFailure,
  emptyRunCounts,
  logRunSummary,
} from "../../lib/services/ingestion-run-summary";

describe("classifyRunFailure (#172)", () => {
  it.each([
    [[], null],
    [["Provider billing error [openrouter]: credits — x", "Quality assessment failed for all 3"], "provider_billing"],
    [["Quality assessment failed for all 3 candidates: AI response truncated at the token limit"], "assessment_truncated"],
    [["Quality assessment failed for all 3 candidates: Quality assessment reply unparseable: x"], "assessment_unparseable"],
    [["Quality assessment failed for all 2 candidates: network down"], "assessment_failed"],
    [["Pipeline timeout: exceeded 270s"], "pipeline_timeout"],
    [["Failed to ingest https://example.org/a: boom"], "ingest_failed"],
    [["something new"], "other"],
  ] as const)("%j -> %s", (errors, expected) => {
    expect(classifyRunFailure(errors)).toBe(expected);
  });
});

describe("logRunSummary (#172)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const run = { runId: "r1", errors: [], durationMs: 5, dryRun: false };

  it("logs a failed run at error and any other run at warn", () => {
    const warn = vi.spyOn(loggers.api, "warn");
    const error = vi.spyOn(loggers.api, "error");

    logRunSummary({ ...run, status: "completed" }, emptyRunCounts());
    logRunSummary({ ...run, status: "failed", errors: ["Pipeline timeout: x"] }, emptyRunCounts());

    expect(warn).toHaveBeenCalledWith(RUN_SUMMARY_MSG, expect.objectContaining({ status: "completed" }));
    expect(error).toHaveBeenCalledWith(
      RUN_SUMMARY_MSG,
      expect.objectContaining({ status: "failed", cause: "pipeline_timeout", errorCount: 1 })
    );
  });

  it("never throws when the logger does", () => {
    vi.spyOn(loggers.api, "error").mockImplementation(() => {
      throw new Error("log sink down");
    });
    expect(() => logRunSummary({ ...run, status: "failed" }, emptyRunCounts())).not.toThrow();
  });
});
