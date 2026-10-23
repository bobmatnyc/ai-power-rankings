/**
 * Why: #172 — the 2026-10-23 daily-news run answered 200 but logged no outcome, so
 * nobody could tell whether any article was assessed or added. The per-stage lines
 * the pipeline does emit are mostly `info`, and only `warn`/`error` lines reached
 * the production log for that run.
 * What: One structured "[AutomatedIngestion] Run summary" line per run, carrying
 * counts only (never URLs, titles, hosts or provider text) plus the run status and a
 * fixed-vocabulary failure cause.
 * Test: `tests/unit/ingestion-run-summary.test.ts`.
 */

import { loggers } from "@/lib/logger";

export const RUN_SUMMARY_MSG = "[AutomatedIngestion] Run summary";

/**
 * Stage counts the pipeline reaches. AutomatedIngestionService assigns each field
 * from the same value it already computes, at the moment it computes it, so a run
 * that stops early (fail-closed, timeout) still reports how far it got.
 */
export interface IngestionRunCounts {
  discovered: number;
  stale: number;
  /** Candidates left after the freshness filter. */
  candidates: number;
  urlDuplicates: number;
  semanticDuplicates: number;
  /** Candidates with article content ready for assessment. */
  fetched: number;
  /** Candidates dropped before assessment, including blocked domains. */
  fetchFailed: number;
  blockedDomain: number;
  /** Candidates that went through the quality LLM step. */
  assessed: number;
  assessmentFailed: number;
  rejected: number;
  passedQuality: number;
  /** Rows actually inserted into the articles table (always 0 on a dry run). */
  added: number;
  ingestFailed: number;
}

export function emptyRunCounts(): IngestionRunCounts {
  return {
    discovered: 0,
    stale: 0,
    candidates: 0,
    urlDuplicates: 0,
    semanticDuplicates: 0,
    fetched: 0,
    fetchFailed: 0,
    blockedDomain: 0,
    assessed: 0,
    assessmentFailed: 0,
    rejected: 0,
    passedQuality: 0,
    added: 0,
    ingestFailed: 0,
  };
}

export type RunFailureCause =
  | "provider_billing"
  | "assessment_truncated"
  | "assessment_unparseable"
  | "assessment_failed"
  | "pipeline_timeout"
  | "pipeline_error"
  | "no_search_provider"
  | "no_content_fetched"
  | "ingest_failed"
  | "persistence_failed"
  | "other";

/**
 * Maps the run's first error to a fixed label, so the summary names the cause
 * without copying provider text (which can carry URLs) into the log.
 */
export function classifyRunFailure(errors: readonly string[]): RunFailureCause | null {
  const first = errors[0];
  if (first === undefined) return null;
  if (first.startsWith("Provider billing error")) return "provider_billing";
  if (first.startsWith("Quality assessment failed for all")) {
    if (/truncated/i.test(first)) return "assessment_truncated";
    if (/unparseable|no numeric score/i.test(first)) return "assessment_unparseable";
    return "assessment_failed";
  }
  if (first.startsWith("Pipeline timeout")) return "pipeline_timeout";
  if (first.startsWith("Pipeline error")) return "pipeline_error";
  if (first.startsWith("No search API configured")) return "no_search_provider";
  if (first.startsWith("Could not fetch content")) return "no_content_fetched";
  if (first.startsWith("Failed to ingest")) return "ingest_failed";
  if (first.startsWith("Run row persistence failed")) return "persistence_failed";
  return "other";
}

export interface RunSummaryInput {
  runId: string;
  status: "completed" | "failed" | "partial";
  errors: readonly string[];
  durationMs: number;
  dryRun: boolean;
}

/** The exact object the summary line carries. */
export function buildRunSummary(run: RunSummaryInput, counts: IngestionRunCounts) {
  return {
    runId: run.runId,
    status: run.status,
    cause: classifyRunFailure(run.errors),
    dryRun: run.dryRun,
    ...counts,
    duplicates: counts.urlDuplicates + counts.semanticDuplicates,
    errorCount: run.errors.length,
    durationMs: run.durationMs,
  };
}

/**
 * Emits the summary line. A failed run logs at `error`; any other at `warn`, the
 * lowest level that reached the production log for the #172 run. Never throws: a
 * logging fault must not change the run result or the route's status code.
 */
export function logRunSummary(run: RunSummaryInput, counts: IngestionRunCounts): void {
  try {
    const summary = buildRunSummary(run, counts);
    if (run.status === "failed") {
      loggers.api.error(RUN_SUMMARY_MSG, summary);
    } else {
      loggers.api.warn(RUN_SUMMARY_MSG, summary);
    }
  } catch {
    // Deliberately empty: see the doc comment.
  }
}
