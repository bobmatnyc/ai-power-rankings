/**
 * Why: #172 — the 2026-10-23 daily-news run answered 200 but logged no outcome, so
 * nobody could tell whether any article was assessed or added. The per-stage lines
 * the pipeline does emit are mostly `info`, and only `warn`/`error` lines reached
 * the production log for that run.
 * What: One structured "[AutomatedIngestion] Run summary" line per run, carrying
 * counts only (never URLs, titles, hosts or provider text) plus the run status and a
 * fixed-vocabulary failure cause. It also breaks `rejected` and `assessmentFailed`
 * down by fixed reason labels and buckets rejected scores against the thresholds.
 * Test: `tests/unit/ingestion-run-summary.test.ts`.
 */

import { loggers } from "@/lib/logger";
import { INGEST_THRESHOLDS, type QualityAssessment } from "@/lib/services/article-quality.service";

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
  /** #172: why the `rejected` candidates were rejected; sums to `rejected`. */
  rejectReasons: Record<RejectReason, number>;
  /** #172: how far each rejected candidate's scores fell below the thresholds. */
  rejectScoreBuckets: { average: Record<ScoreBucket, number>; relevance: Record<ScoreBucket, number> };
  /** #172: why the `assessmentFailed` candidates got no verdict; sums to `assessmentFailed`. */
  assessmentFailedReasons: Record<AssessmentFailureReason, number>;
}

/**
 * Why a verdict-carrying candidate was rejected. `no_assessment`: no result came
 * back for the candidate. `other`: scores meet both thresholds yet the verdict is
 * not to ingest, so a drift between this classifier and the service shows up here.
 */
export const REJECT_REASONS = [
  "below_both_thresholds",
  "below_relevance_threshold",
  "below_average_threshold",
  "no_assessment",
  "other",
] as const;
export type RejectReason = (typeof REJECT_REASONS)[number];

/** Distance below a threshold; `meets` means at or above it. */
export const SCORE_BUCKETS = ["meets", "within_0.5", "0.5_to_2", "over_2", "no_score"] as const;
export type ScoreBucket = (typeof SCORE_BUCKETS)[number];

/** Why an assessment produced no verdict (the candidate carries `error`). */
export const ASSESSMENT_FAILURE_REASONS = [
  "unparseable",
  "truncated",
  "circuit_breaker",
  "provider_error",
] as const;
export type AssessmentFailureReason = (typeof ASSESSMENT_FAILURE_REASONS)[number];

function zeroed<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
}

/** The fields of a QualityAssessment the breakdown reads: numbers, a flag, an error. */
export type AssessmentVerdict = Pick<
  QualityAssessment,
  "qualityScore" | "relevanceScore" | "credibilityScore" | "shouldIngest" | "error"
>;

function scoreBucket(score: number, threshold: number): ScoreBucket {
  if (!Number.isFinite(score)) return "no_score";
  const gap = threshold - score;
  if (gap <= 0) return "meets";
  if (gap <= 0.5) return "within_0.5";
  if (gap <= 2) return "0.5_to_2";
  return "over_2";
}

/** Reads the error text only to pick a label; the text itself never leaves here. */
function classifyAssessmentFailure(error: string): AssessmentFailureReason {
  if (error.startsWith("Quality assessment reply unparseable")) return "unparseable";
  if (/truncated at the token limit/i.test(error)) return "truncated";
  if (error.startsWith("circuit breaker open")) return "circuit_breaker";
  return "provider_error";
}

/**
 * Counts-only breakdown of the assessment step. `results[i]` is the assessment for
 * the i-th assessed candidate (undefined when none came back). A candidate is
 * rejected exactly when the service counts it so: `shouldIngest !== true` and no
 * `error`. A candidate with `error` is counted under `assessmentFailedReasons` only.
 */
export function classifyAssessments(results: ReadonlyArray<AssessmentVerdict | undefined>) {
  const rejectReasons = zeroed(REJECT_REASONS);
  const average = zeroed(SCORE_BUCKETS);
  const relevance = zeroed(SCORE_BUCKETS);
  const assessmentFailedReasons = zeroed(ASSESSMENT_FAILURE_REASONS);
  const { minimumAverageScore, minimumRelevanceScore } = INGEST_THRESHOLDS;

  for (const result of results) {
    if (result?.shouldIngest === true) continue;
    if (result?.error) {
      assessmentFailedReasons[classifyAssessmentFailure(result.error)]++;
      continue;
    }
    if (result === undefined) {
      rejectReasons.no_assessment++;
      average.no_score++;
      relevance.no_score++;
      continue;
    }
    // Same formula as ArticleQualityService.parseAssessmentResponse.
    const avg = (result.qualityScore + result.relevanceScore + result.credibilityScore) / 3;
    const averageBucket = scoreBucket(avg, minimumAverageScore);
    const relevanceBucket = scoreBucket(result.relevanceScore, minimumRelevanceScore);
    average[averageBucket]++;
    relevance[relevanceBucket]++;
    const lowAverage = averageBucket !== "meets";
    const lowRelevance = relevanceBucket !== "meets";
    if (averageBucket === "no_score" || relevanceBucket === "no_score") rejectReasons.no_assessment++;
    else if (lowAverage && lowRelevance) rejectReasons.below_both_thresholds++;
    else if (lowRelevance) rejectReasons.below_relevance_threshold++;
    else if (lowAverage) rejectReasons.below_average_threshold++;
    else rejectReasons.other++;
  }

  return { rejectReasons, rejectScoreBuckets: { average, relevance }, assessmentFailedReasons };
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
    ...classifyAssessments([]),
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
    rejectThresholds: { ...INGEST_THRESHOLDS }, // #172: what the score buckets measure against
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
