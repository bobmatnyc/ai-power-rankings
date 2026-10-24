/**
 * Why: #172 — the run summary line must name a run's failure cause without copying
 * provider text into the log, and a logging fault must never change a run's outcome.
 * What: Table test for classifyRunFailure; classifyAssessments' reason and bucket
 * counts, which must sum to the service's own `rejected` / `assessmentFailed` counts;
 * logRunSummary's level choice and its no-throw guarantee. The end-to-end counts are asserted through the real cron route
 * in `tests/unit/cron-daily-news-billing.test.ts`.
 * Test: `npx vitest run tests/unit/ingestion-run-summary.test.ts`.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { loggers } from "../../lib/logger";
import {
  RUN_SUMMARY_MSG,
  buildRunSummary,
  classifyAssessments,
  classifyRunFailure,
  emptyRunCounts,
  logRunSummary,
  type AssessmentVerdict,
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

// #172: the 2026-10-24 run rejected 12 of 12 with no reason logged.
describe("classifyAssessments (#172)", () => {
  const verdict = (q: number, r: number, c: number, error?: string): AssessmentVerdict => ({
    qualityScore: q,
    relevanceScore: r,
    credibilityScore: c,
    shouldIngest: !error && (q + r + c) / 3 >= 7 && r >= 7,
    ...(error ? { error } : {}),
  });
  const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
  // The service's own predicates (automated-ingestion.service.ts, Step 5).
  const rejectedBy = (rs: ReadonlyArray<AssessmentVerdict | undefined>) =>
    rs.filter((r) => r?.shouldIngest !== true && !r?.error).length;
  const failedBy = (rs: ReadonlyArray<AssessmentVerdict | undefined>) => rs.filter((r) => r?.error).length;

  const results: Array<AssessmentVerdict | undefined> = [
    verdict(9, 9, 9), // passes: not counted anywhere
    verdict(9, 5, 9), // below relevance only
    verdict(6, 7, 6), // below average only
    verdict(3, 2, 5), // below both
    verdict(7, 7, 6.9), // avg 6.97: within 0.5
    { ...verdict(9, 9, 9), shouldIngest: false }, // scores meet both, verdict says no: other
    undefined, // no result came back
    verdict(5, 5, 5, "Quality assessment reply unparseable: Unexpected token"),
    verdict(5, 5, 5, "AI response truncated at the token limit (finish_reason=length)"),
    verdict(5, 5, 5, "circuit breaker open: assessment unavailable after 3 failures"),
    verdict(5, 5, 5, "OpenRouter generation failed: network down"),
  ];

  it("counts each rejection under one reason and each failure under its own label", () => {
    const out = classifyAssessments(results);
    expect(out.rejectReasons).toEqual({
      below_both_thresholds: 1,
      below_relevance_threshold: 1,
      below_average_threshold: 2,
      no_assessment: 1,
      other: 1,
    });
    expect(out.rejectScoreBuckets.average).toEqual({
      meets: 2,
      "within_0.5": 1,
      "0.5_to_2": 1,
      over_2: 1,
      no_score: 1,
    });
    // Fail-open check: an unparseable reply is never a rejection; it has its own label.
    expect(out.assessmentFailedReasons).toEqual({
      unparseable: 1,
      truncated: 1,
      circuit_breaker: 1,
      provider_error: 1,
    });
  });

  it("sums to the service's rejected and assessmentFailed counts", () => {
    const out = classifyAssessments(results);
    expect(sum(out.rejectReasons)).toBe(rejectedBy(results));
    expect(sum(out.rejectScoreBuckets.average)).toBe(rejectedBy(results));
    expect(sum(out.rejectScoreBuckets.relevance)).toBe(rejectedBy(results));
    expect(sum(out.assessmentFailedReasons)).toBe(failedBy(results));
  });

  it("puts counts, labels and the threshold in the summary, and no article or model text", () => {
    const counts = { ...emptyRunCounts(), ...classifyAssessments(results) };
    const json = JSON.stringify(
      buildRunSummary({ runId: "r1", status: "completed", errors: [], durationMs: 5, dryRun: false }, counts)
    );
    expect(JSON.parse(json).rejectThresholds).toEqual({ minimumAverageScore: 7, minimumRelevanceScore: 7 });
    expect(json).not.toMatch(/Unexpected token|finish_reason|network down|OpenRouter|after 3 failures/);
  });
});
