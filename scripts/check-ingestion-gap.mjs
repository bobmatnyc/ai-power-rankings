#!/usr/bin/env node
/**
 * Daily ingestion gap-detector.
 *
 * Why: The scraper has gone silent for ~12 days three separate times (CRON_SECRET
 *   misconfig) with no alert — a failed cron returns 2xx, so nothing surfaced. Later,
 *   two more incidents (2026-07-19 duplicate/403 extraction errors, 2026-07-25 OpenRouter
 *   credit exhaustion) showed a second, sneakier failure mode: the cron fires on schedule
 *   and writes a row, but the run itself fails or yields zero articles. A pure "is there a
 *   recent row" check treats both of those as perfectly healthy. This script independently
 *   checks the production DB and FAILS (exit 1) whenever the scraper is either silent
 *   (no recent row), the latest run recorded status='failed', OpenRouter billing errors
 *   show up in error_log, or ingestion has yielded 0 articles for several runs in a row —
 *   so GitHub's failed-workflow email reaches the maintainer regardless of the cause.
 * What: Reads DATABASE_URL, fetches the last CONSECUTIVE_ZERO_YIELD_RUNS rows from
 *   automated_ingestion_runs (most-recent-first), and evaluates four independent
 *   conditions via evaluateIngestionRuns(): STALLED (latest run older than MAX_GAP_HOURS),
 *   RUN_FAILED (latest run's status is 'failed'), OPENROUTER_CREDITS (error_log matches
 *   OPENROUTER_CREDIT_ERROR_PATTERN in any of the fetched runs), PROVIDER_BILLING (#167:
 *   error_log matches PROVIDER_BILLING_ERROR_PATTERN — a Tavily/Jina 402), and ZERO_YIELD_STREAK
 *   (the last CONSECUTIVE_ZERO_YIELD_RUNS runs all ingested 0 articles). Any one of these
 *   trips the alert; all applicable reasons are printed so an operator can tell a stalled
 *   scraper from a zero-yield or billing failure at a glance. Every outcome — healthy or
 *   alerting — also ends with `LAST_STATUS=<status>` and `LAST_RUN_STARTED=<iso>` (#134),
 *   the machine-readable state the gap-detector workflow reads before deciding whether
 *   re-triggering the production cron is safe.
 *   #138: those four verdicts still say nothing about an article that WAS ingested and
 *   then failed to surface in the feed — the 2026-09-07 06:00 UTC case. So every run now
 *   also prints a detail block for the latest run: one INGESTED_ARTICLE line per id in
 *   ingested_article_ids joined to the articles row it names, and the candidate_outcomes
 *   list aggregated by outcome with the dates recorded on each `ingested` candidate. The
 *   block is APPENDED — the OK/ALERT/LAST_STATUS/LAST_RUN_STARTED lines keep their exact
 *   text and position, because cron-gap-detector.yml greps them — and it cannot change
 *   the exit code: withRunDetail() only extends `lines`, and a failed detail query prints
 *   DETAIL_ERROR= instead of throwing. articles_skipped_stale (#132) is still not read;
 *   it is a count the four verdicts already cover.
 *   #476: the block also prints one CANDIDATE_REJECTED line per rejected or skipped
 *   candidate (domain, dates, scores, a bounded reason code; no URL, title or free text).
 *   With RUN_STARTED_AT set (a workflow_dispatch input) the script runs read-only: it
 *   selects the run nearest that instant within ±1h, prints only DIAGNOSTIC lines and
 *   sanitised counts, domains, dates and reason codes (no URL, slug, title or reason
 *   text), and never prints an ALERT[...] or LAST_* line.
 *   The evaluation and formatting logic takes no DB dependency, so it is unit-testable
 *   without a live database (see tests/unit/check-ingestion-gap.test.ts).
 * Test: Run locally with a valid DATABASE_URL — prints `OK: ...` and exits 0 when the
 *   latest run is recent, non-failed, and ingestion isn't stuck at zero. Exercise the
 *   alert paths without touching prod via `npm run test:unit` (or
 *   `npx vitest run tests/unit/check-ingestion-gap.test.ts`), which feeds
 *   evaluateIngestionRuns() synthetic rows for the gap, failed-status, OpenRouter-credits,
 *   and consecutive-zero-yield cases. To exercise the real CLI against a scratch DB,
 *   insert rows into automated_ingestion_runs matching those shapes and point
 *   DATABASE_URL at it.
 */

import { neon } from "@neondatabase/serverless";
// #103: started_at, published_date and created_at are timestamp WITHOUT time zone
// holding UTC; read them as UTC whatever the process TZ.
import { naiveUtcTypes, parseNaiveUtcTimestamp } from "../lib/db/naive-utc-timestamp.mjs";
// #476: candidate dates may be RFC 2822 text (rows stored before #476 kept Tavily's raw value).
import { parseSourceDate } from "../lib/services/source-date.mjs";

// ---------------------------------------------------------------------------
// Named thresholds — tune here, not inline.
// ---------------------------------------------------------------------------

// 24h daily-cron period + 1h slack: a single missed run trips the alert the same morning.
export const MAX_GAP_HOURS = 25;

// A single zero-yield day can be legitimate (no qualifying AI news landed that day); three
// in a row is not. 3 is chosen over 2 to avoid false-positiving on one genuinely quiet news
// day, and over a larger number so a real stall (e.g. sustained OpenRouter credit
// exhaustion, or the extraction breakage seen on 2026-07-19) is still caught within the
// same week rather than dragging on unnoticed.
export const CONSECUTIVE_ZERO_YIELD_RUNS = 3;

// The exact billing error text OpenRouter returns on credit exhaustion (seen verbatim in
// the 2026-07-25 incident's error_log). Matched case-insensitively and singular/plural so
// it survives minor wording drift, and reported as its own alert reason because the fix is
// "top up / rotate the API key", not a code change.
// #167: the 2026-10-12 incident's text was "This request requires more credits, or fewer
// max_tokens ... but can only afford 648", which the original pattern missed — so only
// ZERO_YIELD_STREAK fired. Mirrors CREDITS_PATTERN in lib/services/provider-billing-errors.ts.
export const OPENROUTER_CREDIT_ERROR_PATTERN = /insufficient credits?|requires more credits|can only afford/i;

// #167: any other provider out of credit — Tavily ("API error: 402 ... unpaid
// pay-as-you-go balance") and Jina ("API error (402): Payment Required",
// InsufficientBalanceError). Only the providers' own API error forms match: a paywalled
// site's "402 Payment Required" lands in error_log via "Failed to ingest <url>: ...",
// and every alternative needs whitespace, so a URL such as /error/402 cannot match.
// Mirrors PAYMENT_REQUIRED_PATTERN in lib/services/provider-billing-errors.ts.
export const PROVIDER_BILLING_ERROR_PATTERN =
  /\bTavily (?:Extract )?API error:\s*402\b|\bJina\.ai API error \(402\)|\b402\s+InsufficientBalanceError\b/i;

// automated_ingestion_runs.status value written when a run fails outright.
export const FAILED_STATUS = "failed";

// #103: the driver's default parser reads `timestamp` in the process TZ. Exported so
// the TZ test parses wire values with exactly the parsers main() uses.
export const NEON_OPTIONS = { types: naiveUtcTypes };

// #138: the whole detail block is embedded verbatim in a public GitHub issue body by
// cron-gap-detector.yml, which has a 65536-character limit. A run ingests single-digit
// articles and candidate_outcomes is already capped at CANDIDATE_OUTCOME_LIMIT (100), so
// 50 is far above any real run while bounding the worst case an operator-widened backfill
// could produce. Overflow is reported as a count, never silently dropped.
export const MAX_DETAIL_LINES = 50;

// #138: candidate URLs are printed at most this wide. Long tracking-parameter tails add
// no diagnostic value and the outcome record already caps the stored URL at 300.
export const DETAIL_URL_MAX_CHARS = 120;

// #138: which CandidateOutcome fields are printed on a CANDIDATE_INGESTED line. Matches
// sourceDate / provisionalDate / effectiveDate and also publishedDateSource — the source
// names which of those dates won, so it is useless separated from them.
const DATEISH_FIELD_PATTERN = /date/i;

// #138: `ingested` but not `ingest_failed` — the failed case is already visible in the
// CANDIDATE_OUTCOME aggregate and carries no resolved date to print.
const INGESTED_OUTCOME_PATTERN = /(^|_)ingested$/i;

// A libpq-style URL, which every driver error in this file could otherwise echo. This
// script's output is teed into a public repository's Actions log and issue bodies.
const CONNECTION_STRING_PATTERN = /postgres(?:ql)?:\/\/\S+/gi;

/**
 * Strip anything shaped like a connection string out of text bound for the log.
 */
export function redactConnectionString(text) {
  return String(text ?? "").replace(CONNECTION_STRING_PATTERN, "[redacted]");
}

/**
 * Collapse a value to a single whitespace-free `key=value` token.
 *
 * Why: every detail line is one record, and the workflow greps the output for
 *   `ALERT[REASON]` to decide whether to call production. A URL or slug carrying a
 *   newline would split one record into two; one carrying the literal text `ALERT[` would
 *   forge an alert reason out of attacker-influenced content (candidate URLs come from a
 *   third-party search API). Both are neutralized here rather than trusted not to occur.
 */
function detailToken(value) {
  if (value === null || value === undefined) return "null";
  return String(value).replace(/\s+/g, "_").replace(/ALERT\[/g, "ALERT_");
}

/**
 * Same neutralization for free-text that occupies the rest of a line (an error message),
 * where interior spaces are readable and harmless.
 */
function detailText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/ALERT\[/g, "ALERT_")
    .trim();
}

/**
 * Render a timestamp column as ISO, or the literal `null`.
 *
 * The driver returns `timestamp` columns as Date; a JSON round-trip yields a string. An
 * unparseable value prints `invalid` rather than `Invalid Date`, so the line stays greppable.
 */
function toIsoOrNull(value) {
  if (value === null || value === undefined) return "null";
  // #103: a zone-less string is UTC, not process-local time.
  // #476: RFC 2822 text ("Sun, 22 Nov 2026 06:00:00 GMT") also parses.
  const date = parseSourceDate(value);
  return date === null ? "invalid" : date.toISOString();
}

/**
 * Why: two jsonb columns can each arrive in three shapes — a real array, SQL NULL (a row
 *   written before migration 0013, or a column that does not exist at all, which the
 *   `to_jsonb(r) -> 'col'` projection in fetchRunDetail() reduces to NULL rather than an
 *   error), or the JSON *string* `"[]"`, which is what Drizzle's `.default("[]")` on a
 *   jsonb column actually stores. Only the first is usable.
 * What: Returns the array, or null when the value cannot be read as one — the caller
 *   prints `unavailable` for null instead of failing the gap check.
 * Test: `coerceJsonArray` cases in tests/unit/check-ingestion-gap.test.ts.
 */
export function coerceJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Why: #138 — "the run says it ingested this article" and "the feed can see it" are
 *   different claims, and only the second one matters to a reader. Printing the id
 *   alongside the articles row it names lets the log answer which of status,
 *   published_date, or the row's very existence is why it never surfaced.
 * What: One INGESTED_ARTICLE line per recorded id, in recorded order. `slug=null` means
 *   no articles row matched the id at all (articles.slug is NOT NULL, so a real row can
 *   never print it) — that is itself the answer for a deleted or never-committed insert.
 * Test: `formatIngestedArticleLines` cases in tests/unit/check-ingestion-gap.test.ts.
 *
 * @param {unknown} ingestedArticleIds - the run row's ingested_article_ids jsonb value.
 * @param {Array<{id: unknown, slug?: unknown, status?: unknown, published_date?: unknown,
 *   created_at?: unknown}>} [articleRows] - the joined articles rows, any order.
 * @returns {string[]}
 */
export function formatIngestedArticleLines(ingestedArticleIds, articleRows) {
  const ids = coerceJsonArray(ingestedArticleIds);
  if (ids === null) return ["INGESTED_ARTICLE_IDS=unavailable"];

  const byId = new Map();
  for (const row of articleRows ?? []) {
    if (row && row.id !== null && row.id !== undefined) byId.set(String(row.id), row);
  }

  const lines = [`INGESTED_ARTICLE_IDS=${ids.length}`];
  for (const rawId of ids.slice(0, MAX_DETAIL_LINES)) {
    const id = String(rawId);
    const row = byId.get(id);
    lines.push(
      `INGESTED_ARTICLE id=${detailToken(id)} slug=${detailToken(row?.slug)} ` +
        `status=${detailToken(row?.status)} published_date=${toIsoOrNull(row?.published_date)} ` +
        `created_at=${toIsoOrNull(row?.created_at)}`
    );
  }
  if (ids.length > MAX_DETAIL_LINES) {
    lines.push(`INGESTED_ARTICLE_TRUNCATED=${ids.length - MAX_DETAIL_LINES}`);
  }
  return lines;
}

/**
 * Why: #138 — the aggregate says how the run disposed of everything it discovered, and
 *   the per-`ingested` lines say which date signal won for each article that made it
 *   through. Together they separate "nothing fresh existed" from "something was ingested
 *   with a date that hides it from the feed".
 * What: A CANDIDATE_OUTCOMES total, one CANDIDATE_OUTCOME line per distinct outcome
 *   (commonest first, ties alphabetical, so the ordering is deterministic for tests and
 *   the dominant disposition reads first), then one CANDIDATE_INGESTED line per `ingested`
 *   candidate carrying its URL and every date-ish field the outcome recorded.
 * Test: `formatCandidateOutcomeLines` cases in tests/unit/check-ingestion-gap.test.ts.
 *
 * @param {unknown} candidateOutcomes - the run row's candidate_outcomes jsonb value; see
 *   CandidateOutcome in lib/services/automated-ingestion.service.ts.
 * @returns {string[]}
 */
export function formatCandidateOutcomeLines(candidateOutcomes) {
  const stored = coerceJsonArray(candidateOutcomes);
  if (stored === null) return ["CANDIDATE_OUTCOMES=unavailable"];
  // #476: the run_counts entry describes the run, not a candidate.
  const outcomes = stored.filter((entry) => !isRunCountsEntry(entry));

  const lines = candidateOutcomeCountLines(outcomes);
  const ingested = ingestedEntries(outcomes);
  for (const entry of ingested.slice(0, MAX_DETAIL_LINES)) {
    const dateFields = Object.entries(entry)
      .filter(([key]) => DATEISH_FIELD_PATTERN.test(key))
      .map(([key, value]) => `${key}=${detailToken(value)}`);
    const url = detailToken(String(entry.url ?? "").substring(0, DETAIL_URL_MAX_CHARS));
    lines.push([`CANDIDATE_INGESTED url=${url}`, ...dateFields].join(" "));
  }
  if (ingested.length > MAX_DETAIL_LINES) {
    lines.push(`CANDIDATE_INGESTED_TRUNCATED=${ingested.length - MAX_DETAIL_LINES}`);
  }
  // #476: rejected lines share MAX_DETAIL_LINES with the ingested lines above.
  const rejectedBudget = MAX_DETAIL_LINES - Math.min(ingested.length, MAX_DETAIL_LINES);
  lines.push(...formatCandidateRejectedLines(outcomes, rejectedBudget));
  return lines;
}

/** The CANDIDATE_OUTCOMES total and per-outcome count lines, commonest first. */
function candidateOutcomeCountLines(outcomes) {
  const counts = new Map();
  for (const entry of outcomes) {
    const outcome =
      entry && typeof entry === "object" && entry.outcome !== null && entry.outcome !== undefined
        ? String(entry.outcome)
        : "unknown";
    counts.set(outcome, (counts.get(outcome) ?? 0) + 1);
  }

  const lines = [`CANDIDATE_OUTCOMES=${outcomes.length}`];
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  for (const [outcome, count] of ranked) {
    lines.push(`CANDIDATE_OUTCOME outcome=${detailToken(outcome)} count=${count}`);
  }
  return lines;
}

function ingestedEntries(outcomes) {
  return outcomes.filter(
    (entry) =>
      entry && typeof entry === "object" && INGESTED_OUTCOME_PATTERN.test(String(entry.outcome ?? ""))
  );
}

/**
 * Why: #476 — a diagnostic dispatch can print any past run into a public log, so it must
 *   not carry the scheduled block's full URLs, slugs, titles or LLM reasons.
 * What: Only bounded lines: INGESTED_ARTICLE_IDS (a count), the CANDIDATE_OUTCOMES
 *   counts, RUN_COUNTS, one CANDIDATE_INGESTED line per ingested candidate with domain,
 *   sourceDate and effectiveDate, then CANDIDATE_REJECTED lines. The ingested and
 *   rejected lines share MAX_DETAIL_LINES.
 * Test: `formatDiagnosticLines` cases in tests/unit/check-ingestion-gap.test.ts.
 */
export function formatDiagnosticDetailLines(detail) {
  const ids = coerceJsonArray(detail?.ingestedArticleIds);
  const lines = [`INGESTED_ARTICLE_IDS=${ids === null ? "unavailable" : ids.length}`];
  const stored = coerceJsonArray(detail?.candidateOutcomes);
  const outcomes = stored === null ? null : stored.filter((entry) => !isRunCountsEntry(entry));
  lines.push(...(outcomes === null ? ["CANDIDATE_OUTCOMES=unavailable"] : candidateOutcomeCountLines(outcomes)));
  lines.push(formatRunCountsLine(detail?.candidateOutcomes));
  if (outcomes === null) return lines;

  const ingested = ingestedEntries(outcomes);
  for (const entry of ingested.slice(0, MAX_DETAIL_LINES)) {
    lines.push(
      `CANDIDATE_INGESTED domain=${detailToken(sourceDomain(entry.url))} ` +
        `sourceDate=${detailToken(toIsoOrNull(entry.sourceDate))} ` +
        `effectiveDate=${detailToken(toIsoOrNull(entry.effectiveDate))}`
    );
  }
  if (ingested.length > MAX_DETAIL_LINES) {
    lines.push(`CANDIDATE_INGESTED_TRUNCATED=${ingested.length - MAX_DETAIL_LINES}`);
  }
  const rejectedBudget = MAX_DETAIL_LINES - Math.min(ingested.length, MAX_DETAIL_LINES);
  lines.push(...formatCandidateRejectedLines(outcomes, rejectedBudget));
  return lines;
}

// #476: the quality gate's thresholds; mirrors INGEST_THRESHOLDS in
// lib/services/article-quality.service.ts.
export const QUALITY_MIN_AVERAGE_SCORE = 7.0;
export const QUALITY_MIN_RELEVANCE_SCORE = 7;

// #476: every reason code a CANDIDATE_REJECTED line can carry. A closed set, so free
// text (an LLM rationale, an error message, a title) can never reach the line.
export const REJECTION_REASON_CODES = Object.freeze([
  "stale",
  "duplicate",
  "semantic_dup",
  "previously_rejected",
  "unresolvable_host", // #476: aggregator/wrapper URL dropped before scoring
  "blocked_domain",
  "extraction_failed",
  "assessment_failed",
  "teaser_unexpanded",
  "low_relevance",
  "low_avg",
  "low_relevance_and_avg",
  "summary_rejected",
  "ingest_failed",
  "other",
]);

// #476: outcome -> code where the outcome alone decides it. extraction_failed and
// quality_rejected are refined in rejectionReasonCode().
const OUTCOME_REASON_CODES = new Map([
  ["skipped_stale", "stale"],
  ["skipped_duplicate", "duplicate"],
  ["skipped_semantic", "semantic_dup"],
  ["skipped_previously_rejected", "previously_rejected"],
  ["skipped_unresolvable_host", "unresolvable_host"], // #476
  ["extraction_failed", "extraction_failed"],
  ["assessment_failed", "assessment_failed"],
  ["quality_rejected_unexpanded", "teaser_unexpanded"],
  ["summary_rejected", "summary_rejected"],
  ["ingest_failed", "ingest_failed"],
]);

// #476: an outcome is printed only when it has the shape of a CandidateOutcomeKind.
const OUTCOME_TOKEN_PATTERN = /^[a-z_]{1,40}$/;
const HOSTNAME_PATTERN = /^[a-z0-9.-]{1,253}$/;

/**
 * Why: #476 — the operator needs to see why each candidate died without the log
 *   carrying an LLM rationale, an error message or a title from a public page.
 * What: Maps one candidate_outcomes entry to a code in REJECTION_REASON_CODES. The
 *   outcome decides the code; `extraction_failed` with reason `blocked_domain` becomes
 *   `blocked_domain`; `quality_rejected` is split by which threshold the scores missed.
 *   Anything else, including a quality rejection with no scores, is `other`.
 * Test: `rejectionReasonCode` cases in tests/unit/check-ingestion-gap.test.ts.
 */
export function rejectionReasonCode(entry) {
  if (!entry || typeof entry !== "object") return "other";
  const { outcome } = entry;
  if (outcome === "extraction_failed" && entry.reason === "blocked_domain") return "blocked_domain";
  if (outcome === "quality_rejected") {
    const { averageScore: avg, relevanceScore: rel } = entry;
    if (!Number.isFinite(avg) || !Number.isFinite(rel)) return "other";
    const lowAvg = avg < QUALITY_MIN_AVERAGE_SCORE;
    const lowRel = rel < QUALITY_MIN_RELEVANCE_SCORE;
    if (lowAvg && lowRel) return "low_relevance_and_avg";
    if (lowRel) return "low_relevance";
    if (lowAvg) return "low_avg";
    return "other";
  }
  return OUTCOME_REASON_CODES.get(outcome) ?? "other";
}

/**
 * Return the URL's lowercase hostname, or `invalid` — never the path or query.
 *
 * Test: `sourceDomain` cases in tests/unit/check-ingestion-gap.test.ts.
 */
export function sourceDomain(url) {
  try {
    const host = new URL(String(url ?? "")).hostname.toLowerCase();
    return HOSTNAME_PATTERN.test(host) ? host : "invalid";
  } catch {
    return "invalid";
  }
}

/**
 * Why: #476 — CANDIDATE_OUTCOME counts said 19 of 20 candidates were rejected, but not
 *   which source, which dates, or which threshold. One line per candidate answers that.
 * What: One CANDIDATE_REJECTED line per entry whose outcome is neither ingested nor
 *   run_counts, in recorded order, up to `limit`; then CANDIDATE_REJECTED_TRUNCATED with
 *   the overflow. Each field is bounded: outcome by OUTCOME_TOKEN_PATTERN, domain by
 *   sourceDomain(), dates by toIsoOrNull(), scores by scoreOrNa(), reason by
 *   rejectionReasonCode(); detailToken() runs over every value as a last guard.
 * Test: `formatCandidateRejectedLines` cases in tests/unit/check-ingestion-gap.test.ts.
 */
export function formatCandidateRejectedLines(candidateOutcomes, limit = MAX_DETAIL_LINES) {
  const stored = coerceJsonArray(candidateOutcomes);
  if (stored === null) return [];
  const rejected = stored.filter(
    (entry) =>
      entry &&
      typeof entry === "object" &&
      !isRunCountsEntry(entry) &&
      !INGESTED_OUTCOME_PATTERN.test(String(entry.outcome ?? ""))
  );
  const budget = Math.max(0, Math.floor(limit));
  const lines = rejected.slice(0, budget).map((entry) => {
    const outcome = OUTCOME_TOKEN_PATTERN.test(String(entry.outcome ?? "")) ? entry.outcome : "other";
    const fields = [
      ["outcome", outcome],
      ["domain", sourceDomain(entry.url)],
      ["sourceDate", toIsoOrNull(entry.sourceDate)],
      ["effectiveDate", toIsoOrNull(entry.effectiveDate)],
      ["averageScore", scoreOrNa(entry.averageScore)],
      ["relevanceScore", scoreOrNa(entry.relevanceScore)],
      ["reason", rejectionReasonCode(entry)],
    ];
    return ["CANDIDATE_REJECTED", ...fields.map(([key, value]) => `${key}=${detailToken(value)}`)].join(" ");
  });
  if (rejected.length > budget) {
    lines.push(`CANDIDATE_REJECTED_TRUNCATED count=${rejected.length - budget}`);
  }
  return lines;
}

// #476: outcome value of the run-level counts entry; see RUN_COUNTS_OUTCOME in
// lib/services/automated-ingestion.service.ts.
export const RUN_COUNTS_OUTCOME = "run_counts";

function isRunCountsEntry(entry) {
  return Boolean(entry) && typeof entry === "object" && entry.outcome === RUN_COUNTS_OUTCOME;
}

function countOrNa(value) {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "n/a";
}

/**
 * Why: #476 — on 2026-11-22 the log could not say whether teaser expansion ran.
 * What: One RUN_COUNTS line with teaser_expanded and previously_rejected from the
 *   run_counts entry of candidate_outcomes; `n/a` for a run written before #476.
 * Test: `formatRunCountsLine` cases in tests/unit/check-ingestion-gap.test.ts.
 */
export function formatRunCountsLine(candidateOutcomes) {
  const entry = (coerceJsonArray(candidateOutcomes) ?? []).find(isRunCountsEntry);
  return (
    `RUN_COUNTS teaser_expanded=${countOrNa(entry?.teaserExpanded)} ` +
    `previously_rejected=${countOrNa(entry?.previouslyRejected)} ` +
    `teaser_fallback=${countOrNa(entry?.teaserFallback)}` // #476
  );
}

// #476: how many rejected candidates the alert lists, and how much of each reason.
export const TOP_REJECTED_LIMIT = 5;
export const REJECTED_REASON_MAX_CHARS = 160;
const REJECTED_OUTCOMES = new Set(["quality_rejected", "quality_rejected_unexpanded"]);

function scoreOrNa(value) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(1) : "n/a";
}

function quoted(value, maxChars) {
  return `"${detailText(String(value ?? "")).substring(0, maxChars).replace(/"/g, "'")}"`;
}

/**
 * Why: #476 — the 2026-11-23 zero-yield alert showed counts only; nobody could
 *   see that 19 of 20 candidates were quality_rejected on thin teasers.
 * What: A REJECTED_TOP header and up to TOP_REJECTED_LIMIT REJECTED lines for
 *   `quality_rejected` candidates, highest averageScore first (the near-misses),
 *   each with title, averageScore, relevanceScore and the reason cut to
 *   REJECTED_REASON_MAX_CHARS.
 * Test: `formatTopRejectedLines` cases in tests/unit/check-ingestion-gap.test.ts.
 */
export function formatTopRejectedLines(candidateOutcomes) {
  const stored = coerceJsonArray(candidateOutcomes);
  // CANDIDATE_OUTCOMES=unavailable already reports an unreadable column.
  if (stored === null) return [];
  const rejected = stored.filter(
    // #476: quality_rejected_unexpanded = rejected on the snippet after a failed fetch.
    (entry) => entry && typeof entry === "object" && REJECTED_OUTCOMES.has(entry.outcome)
  );
  const score = (entry) => (typeof entry.averageScore === "number" ? entry.averageScore : -1);
  const ranked = [...rejected].sort((a, b) => score(b) - score(a));
  const lines = [`REJECTED_TOP=${Math.min(rejected.length, TOP_REJECTED_LIMIT)} of ${rejected.length}`];
  for (const entry of ranked.slice(0, TOP_REJECTED_LIMIT)) {
    lines.push(
      `REJECTED outcome=${detailToken(entry.outcome)} averageScore=${scoreOrNa(entry.averageScore)} relevanceScore=${scoreOrNa(entry.relevanceScore)} ` +
        `title=${quoted(entry.title, DETAIL_URL_MAX_CHARS)} reason=${quoted(entry.reason, REJECTED_REASON_MAX_CHARS)}`
    );
  }
  return lines;
}

/**
 * Render the whole latest-run detail block, including the failure case.
 *
 * @param {{error?: unknown, ingestedArticleIds?: unknown, articleRows?: unknown[],
 *   candidateOutcomes?: unknown}} [detail]
 * @returns {string[]}
 */
export function formatRunDetailLines(detail) {
  if (!detail) return [];
  if (detail.error !== undefined && detail.error !== null) {
    const message = detail.error instanceof Error ? detail.error.message : detail.error;
    return [`DETAIL_ERROR=${detailText(redactConnectionString(message))}`];
  }
  return [
    ...formatIngestedArticleLines(detail.ingestedArticleIds, detail.articleRows),
    ...formatCandidateOutcomeLines(detail.candidateOutcomes),
    formatRunCountsLine(detail.candidateOutcomes), // #476
    ...formatTopRejectedLines(detail.candidateOutcomes), // #476
  ];
}

/**
 * Append the detail block to an evaluateIngestionRuns() result.
 *
 * The verdict is carried through untouched — `ok` and `exitCode` are copied, never
 * recomputed — so diagnosis can never turn a healthy check red or a red one green, and
 * `lines[0]` stays the OK/ALERT line cron-gap-detector.yml expects.
 */
export function withRunDetail(result, detail) {
  const detailLines = formatRunDetailLines(detail);
  if (detailLines.length === 0) return result;
  return { ...result, lines: [...result.lines, ...detailLines] };
}

/**
 * Flatten a run's error_log (jsonb array of strings; defensively also accepts non-string
 * entries) into one searchable string.
 */
export function errorLogText(errorLog) {
  if (!Array.isArray(errorLog)) return "";
  return errorLog.map((entry) => (typeof entry === "string" ? entry : JSON.stringify(entry))).join("\n");
}

/**
 * Pure evaluation of ingestion health — no I/O, so it is unit-testable without a database.
 *
 * @param {Array<{started_at: string|Date, status: string, articles_ingested: number|null, error_log: unknown}>} rows
 *   Rows from automated_ingestion_runs, most-recent-first, limited to at most
 *   CONSECUTIVE_ZERO_YIELD_RUNS entries.
 * @param {number} nowMs - injectable clock for deterministic tests.
 * @returns {{ ok: boolean, exitCode: number, lines: string[] }}
 */
export function evaluateIngestionRuns(rows, nowMs = Date.now()) {
  if (!rows || rows.length === 0) {
    return {
      ok: false,
      exitCode: 1,
      lines: [
        "ALERT[NO_RUNS_EVER]: no ingestion run ever recorded (automated_ingestion_runs is empty)",
        "LAST_STATUS=none",
        "LAST_RUN_STARTED=none",
      ],
    };
  }

  const latest = rows[0];
  // #103: started_at is a UTC wall clock with no zone; `new Date(text)` read it in the
  // process TZ and put the 06:00 UTC run at 10:00 UTC under America/New_York.
  const lastRunDate = parseNaiveUtcTimestamp(latest.started_at) ?? new Date(Number.NaN);
  const ageHours = (nowMs - lastRunDate.getTime()) / (1000 * 60 * 60);
  const ageHoursStr = ageHours.toFixed(1);
  const lastRunIso = lastRunDate.toISOString();
  const latestArticlesIngested = latest.articles_ingested ?? 0;

  const alerts = [];

  // 1. Stalled scraper: no run has landed recently at all (the cron itself is silent).
  if (ageHours > MAX_GAP_HOURS) {
    alerts.push(`ALERT[STALLED]: no ingestion run in ${ageHoursStr}h (last: ${lastRunIso})`);
  }

  // 2. The latest run landed on schedule but failed outright.
  if (latest.status === FAILED_STATUS) {
    alerts.push(
      `ALERT[RUN_FAILED]: latest run (${lastRunIso}) has status='${FAILED_STATUS}', ${latestArticlesIngested} articles ingested`
    );
  }

  // 3. OpenRouter credit exhaustion: called out on its own because it's a billing problem
  //    (top up / rotate the key), not a code regression — regardless of whether the run's
  //    final status ended up 'failed' or limped to 'completed' with partial output.
  const creditExhaustedRuns = rows.filter((row) => OPENROUTER_CREDIT_ERROR_PATTERN.test(errorLogText(row.error_log)));
  if (creditExhaustedRuns.length > 0) {
    alerts.push(
      `ALERT[OPENROUTER_CREDITS]: OpenRouter "insufficient credits" error found in ${creditExhaustedRuns.length} of the last ${rows.length} run(s) — billing issue, not a code bug`
    );
  }

  // 3b. #167: a search/extraction provider out of credit (HTTP 402). Same remedy class as
  //     OPENROUTER_CREDITS — a billing problem, not a code bug — but a different account.
  const billingFailedRuns = rows.filter((row) => PROVIDER_BILLING_ERROR_PATTERN.test(errorLogText(row.error_log)));
  if (billingFailedRuns.length > 0) {
    alerts.push(
      `ALERT[PROVIDER_BILLING]: provider billing error (HTTP 402 / insufficient balance) found in ${billingFailedRuns.length} of the last ${rows.length} run(s) — billing issue, not a code bug`
    );
  }

  // 4. Zero-yield streak: the scraper is running (and may even report status='completed')
  //    but has produced nothing for CONSECUTIVE_ZERO_YIELD_RUNS runs in a row. Only
  //    evaluated once we actually have that many rows, so a young/sparse table can't
  //    false-positive.
  if (rows.length >= CONSECUTIVE_ZERO_YIELD_RUNS) {
    const recentWindow = rows.slice(0, CONSECUTIVE_ZERO_YIELD_RUNS);
    const allZeroYield = recentWindow.every((row) => (row.articles_ingested ?? 0) === 0);
    if (allZeroYield) {
      alerts.push(
        `ALERT[ZERO_YIELD_STREAK]: last ${CONSECUTIVE_ZERO_YIELD_RUNS} runs all ingested 0 articles (most recent: ${lastRunIso})`
      );
    }
  }

  // #134: every outcome ends with the same two machine-readable lines so a consumer can
  // read the latest row's state without re-parsing prose. The gap-detector workflow's
  // fallback trigger needs LAST_STATUS to refuse to fire while a row is still 'running'
  // (createRun() has no concurrency guard, and run 483bd3e8 stuck at 'running' for good —
  // see lib/services/automated-ingestion.service.ts, the #124 checkpoint comment), and
  // LAST_RUN_STARTED to tell "the fallback wrote a new row" from "nothing changed".
  // Appended, never prepended: `lines[0]` stays the OK/first-ALERT line callers expect.
  const stateLines = [`LAST_STATUS=${latest.status ?? "unknown"}`, `LAST_RUN_STARTED=${lastRunIso}`];

  if (alerts.length > 0) {
    return { ok: false, exitCode: 1, lines: [...alerts, ...stateLines] };
  }

  return {
    ok: true,
    exitCode: 0,
    lines: [
      `OK: last ingestion run ${ageHoursStr}h ago (${lastRunIso}), status='${latest.status}', ${latestArticlesIngested} articles ingested`,
      ...stateLines,
    ],
  };
}

/**
 * Why: #138 — the detail block is diagnosis, and diagnosis must never be able to fail the
 *   gap check that carries the alert. Every failure mode is funneled into a `{ error }`
 *   result the caller prints as one DETAIL_ERROR line.
 * What: Reads the latest run's two jsonb columns through `to_jsonb(r) -> 'col'`, which
 *   yields SQL NULL for a column that does not exist rather than raising undefined_column
 *   — so this runs unchanged against a database that predates migration 0013 — then joins
 *   the recorded ids to articles. The id list is passed as one jsonb parameter rather than
 *   an array binding, and matched on `articles.id::text`, so a malformed id cannot raise a
 *   uuid cast error; it simply matches nothing and prints as a missing row.
 * Test: Not unit-tested (it is the only DB-touching part). Its output shapes are, via
 *   formatRunDetailLines() — see tests/unit/check-ingestion-gap.test.ts.
 *
 * @returns {Promise<{error?: unknown, ingestedArticleIds?: unknown, articleRows?: unknown[],
 *   candidateOutcomes?: unknown}>}
 */
async function fetchRunDetail(sql, runId) {
  if (!runId) return { error: "latest run row carries no id" };

  try {
    const runRows = await sql`
      SELECT to_jsonb(r) -> 'ingested_article_ids' AS ingested_article_ids,
             to_jsonb(r) -> 'candidate_outcomes'   AS candidate_outcomes
      FROM automated_ingestion_runs r
      WHERE r.id = ${runId}
    `;
    const runRow = runRows[0];
    if (!runRow) return { error: "latest run row not found on re-read" };

    const ids = coerceJsonArray(runRow.ingested_article_ids) ?? [];
    let articleRows = [];
    if (ids.length > 0) {
      const idsJson = JSON.stringify(ids.map((id) => String(id)));
      articleRows = await sql`
        SELECT a.id::text AS id, a.slug, a.status, a.published_date, a.created_at
        FROM articles a
        WHERE a.id::text IN (SELECT jsonb_array_elements_text(${idsJson}::jsonb))
      `;
    }

    return {
      ingestedArticleIds: runRow.ingested_article_ids,
      articleRows,
      candidateOutcomes: runRow.candidate_outcomes,
    };
  } catch (error) {
    return { error };
  }
}

// #476: a diagnostic dispatch selects the run whose started_at is within this much of
// the RUN_STARTED_AT input.
export const DIAGNOSTIC_WINDOW_MS = 60 * 60 * 1000;

// #476: exit code for a RUN_STARTED_AT that is set but not a strict ISO timestamp.
export const INVALID_INPUT_EXIT_CODE = 2;

// #476: YYYY-MM-DDTHH:MM[:SS[.sss]] with a mandatory Z or ±HH:MM zone, so the window
// never depends on the runner's TZ.
const RUN_STARTED_AT_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(?:(Z)|([+-])(\d{2}):(\d{2}))$/;
const RUN_STARTED_AT_MAX_CHARS = 29;

function naiveUtcText(ms) {
  return new Date(ms).toISOString().replace("T", " ").replace("Z", "");
}

/**
 * Why: #476 — an operator needs the rejection lines of a past run, not only the latest.
 *   The input comes from a workflow_dispatch form, so it is validated before it reaches
 *   a query parameter.
 * What: `{ kind: "unset" }` for an absent or empty value (the scheduled path);
 *   `{ kind: "invalid" }` for anything that is not a real calendar instant in the strict
 *   form above; otherwise `{ kind: "valid", centerMs, center, lower, upper }`, where the
 *   three strings are naive-UTC `timestamp` text for [ts-1h, ts+1h].
 * Test: `parseRunStartedAtInput` cases in tests/unit/check-ingestion-gap.test.ts.
 */
export function parseRunStartedAtInput(raw) {
  if (raw === undefined || raw === null || raw === "") return { kind: "unset" };
  const text = String(raw);
  if (text.length > RUN_STARTED_AT_MAX_CHARS) return { kind: "invalid" };
  const match = RUN_STARTED_AT_PATTERN.exec(text);
  if (!match) return { kind: "invalid" };
  const [, y, mo, d, h, mi, s = "0", frac = "0", zulu, sign, oh, om] = match;
  const [year, month, day, hour, minute, second] = [y, mo, d, h, mi, s].map(Number);
  const offsetHours = zulu ? 0 : Number(oh);
  const offsetMinutes = zulu ? 0 : Number(om);
  // #476: no ingestion run predates 1970; an earlier year is a typo, not a query.
  if (year < 1970 || month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return { kind: "invalid" };
  if (offsetHours > 14 || offsetMinutes > 59) return { kind: "invalid" };
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > daysInMonth) return { kind: "invalid" };

  const millis = Number(frac.padEnd(3, "0"));
  const offsetMs = (sign === "-" ? -1 : 1) * (offsetHours * 60 + offsetMinutes) * 60 * 1000;
  const centerMs = Date.UTC(year, month - 1, day, hour, minute, second, millis) - offsetMs;
  return {
    kind: "valid",
    centerMs,
    center: naiveUtcText(centerMs),
    lower: naiveUtcText(centerMs - DIAGNOSTIC_WINDOW_MS),
    upper: naiveUtcText(centerMs + DIAGNOSTIC_WINDOW_MS),
  };
}

/**
 * Why: #476 — a diagnostic run is read-only: it must print no ALERT[...] or LAST_* line
 *   the workflow could act on, and a verdict on a past run measured against now is noise.
 * What: A DIAGNOSTIC header naming the window, then DIAGNOSTIC_RUN for the selected row
 *   and formatDiagnosticDetailLines() for its detail (exit 0); DIAGNOSTIC_NO_RUN when no
 *   row started inside the window (exit 1); a redacted DETAIL_ERROR when the detail read
 *   failed (exit 1 — a diagnosis that could not read its data is not a success).
 * Test: `formatDiagnosticLines` cases in tests/unit/check-ingestion-gap.test.ts.
 */
export function formatDiagnosticLines(window, row, detail) {
  const header = `DIAGNOSTIC: read-only run selection, window=${detailToken(window.lower)}Z..${detailToken(window.upper)}Z`;
  if (!row) return { exitCode: 1, lines: [header, "DIAGNOSTIC_NO_RUN"] };
  const runLine =
    `DIAGNOSTIC_RUN started_at=${toIsoOrNull(row.started_at)} status=${detailToken(row.status ?? "unknown")} ` +
    `articles_ingested=${countOrNa(row.articles_ingested)}`;
  if (detail === undefined) return { exitCode: 0, lines: [header, runLine] };
  if (detail.error !== undefined && detail.error !== null) {
    // #476: fail closed; formatRunDetailLines() renders the redacted DETAIL_ERROR line.
    return { exitCode: 1, lines: [header, runLine, ...formatRunDetailLines(detail)] };
  }
  return { exitCode: 0, lines: [header, runLine, ...formatDiagnosticDetailLines(detail)] };
}

/**
 * #476: the diagnostic path. One SELECT picks the run nearest the input inside the
 * window; fetchRunDetail() reads its detail, printed only as sanitised lines.
 */
async function runDiagnostic(sql, window) {
  const rows = await sql`
    SELECT id, started_at, status, articles_ingested
    FROM automated_ingestion_runs
    WHERE started_at BETWEEN ${window.lower}::timestamp AND ${window.upper}::timestamp
    ORDER BY abs(extract(epoch FROM started_at - ${window.center}::timestamp)), started_at
    LIMIT 1
  `;
  const detail = rows[0] ? await fetchRunDetail(sql, rows[0].id) : undefined;
  // #476: never formatRunDetailLines() here — it prints URLs, slugs, titles and reasons.
  const { exitCode, lines } = formatDiagnosticLines(window, rows[0], detail);
  for (const line of lines) console.log(line);
  process.exit(exitCode);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("ERROR: DATABASE_URL is not set; cannot check ingestion gap.");
    process.exit(1);
    return;
  }

  // #476: RUN_STARTED_AT (workflow_dispatch input) switches to the read-only diagnostic
  // path. The value is never echoed, valid or not.
  const runStartedAt = parseRunStartedAtInput(process.env.RUN_STARTED_AT);
  if (runStartedAt.kind === "invalid") {
    console.error("ERROR: RUN_STARTED_AT is not a strict ISO-8601 timestamp (YYYY-MM-DDTHH:MM[:SS[.sss]]Z or ±HH:MM).");
    process.exit(INVALID_INPUT_EXIT_CODE);
    return;
  }

  const sql = neon(databaseUrl, NEON_OPTIONS);

  if (runStartedAt.kind === "valid") {
    try {
      await runDiagnostic(sql, runStartedAt);
    } catch (error) {
      console.error(
        `ERROR: diagnostic run selection failed: ${redactConnectionString(error instanceof Error ? error.message : error)}`
      );
      process.exit(1);
    }
    return;
  }

  try {
    // Most-recent-first; fetch enough rows to evaluate both the single-latest-run checks
    // (gap, failed status, credits) and the consecutive-zero-yield streak in one query.
    const rows = await sql`
      -- #132: articles_skipped_stale is intentionally not selected — see the header. This
      -- query stays narrow enough to run against a pre-migration DB.
      -- #138: id is selected so the detail query below reads the SAME row this verdict is
      -- computed from, rather than re-deriving "latest" and risking a different one.
      SELECT id, started_at, status, articles_ingested, error_log
      FROM automated_ingestion_runs
      ORDER BY started_at DESC
      LIMIT ${CONSECUTIVE_ZERO_YIELD_RUNS}
    `;

    const verdict = evaluateIngestionRuns(rows);
    // #138: appended after the verdict, and only ever additive — see withRunDetail().
    const result = withRunDetail(verdict, await fetchRunDetail(sql, rows[0]?.id));
    for (const line of result.lines) {
      if (result.ok) {
        console.log(line);
      } else {
        console.error(line);
      }
    }
    process.exit(result.exitCode);
  } catch (error) {
    // #138: a driver error can carry the connection string, and this output is teed into a
    // public repository's Actions log and pasted into an issue body.
    console.error(
      `ERROR: ingestion gap check failed: ${redactConnectionString(error instanceof Error ? error.message : error)}`
    );
    process.exit(1);
  }
}

// Only run the CLI entrypoint when this file is executed directly (e.g. `node
// scripts/check-ingestion-gap.mjs`) — not when it's imported by tests for
// evaluateIngestionRuns()/errorLogText(), which must stay DB-free.
const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main();
}
