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
 *   scraper from a zero-yield or billing failure at a glance. The evaluation logic takes
 *   no DB dependency, so it is unit-testable without a live database (see
 *   tests/unit/check-ingestion-gap.test.ts).
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
      lines: ["ALERT[NO_RUNS_EVER]: no ingestion run ever recorded (automated_ingestion_runs is empty)"],
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

  if (alerts.length > 0) {
    return { ok: false, exitCode: 1, lines: alerts };
  }

  return {
    ok: true,
    exitCode: 0,
    lines: [
      `OK: last ingestion run ${ageHoursStr}h ago (${lastRunIso}), status='${latest.status}', ${latestArticlesIngested} articles ingested`,
    ],
  };
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
      SELECT started_at, status, articles_ingested, error_log
      FROM automated_ingestion_runs
      ORDER BY started_at DESC
      LIMIT ${CONSECUTIVE_ZERO_YIELD_RUNS}
    `;

    const result = evaluateIngestionRuns(rows);
    for (const line of result.lines) {
      if (result.ok) {
        console.log(line);
      } else {
        console.error(line);
      }
    }
    process.exit(result.exitCode);
  } catch (error) {
    console.error(`ERROR: ingestion gap check failed: ${error instanceof Error ? error.message : error}`);
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
