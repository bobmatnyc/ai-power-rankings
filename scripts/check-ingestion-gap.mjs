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
 *   OPENROUTER_CREDIT_ERROR_PATTERN in any of the fetched runs), and ZERO_YIELD_STREAK
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
export const OPENROUTER_CREDIT_ERROR_PATTERN = /insufficient credits?/i;

// automated_ingestion_runs.status value written when a run fails outright.
export const FAILED_STATUS = "failed";

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
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "invalid" : date.toISOString();
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
  const outcomes = coerceJsonArray(candidateOutcomes);
  if (outcomes === null) return ["CANDIDATE_OUTCOMES=unavailable"];

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

  const ingested = outcomes.filter(
    (entry) =>
      entry && typeof entry === "object" && INGESTED_OUTCOME_PATTERN.test(String(entry.outcome ?? ""))
  );
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
  const lastRunDate = new Date(latest.started_at);
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

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("ERROR: DATABASE_URL is not set; cannot check ingestion gap.");
    process.exit(1);
    return;
  }

  const sql = neon(databaseUrl);

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
