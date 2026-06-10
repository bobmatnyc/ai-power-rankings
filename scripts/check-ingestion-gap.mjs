#!/usr/bin/env node
/**
 * Daily ingestion gap-detector.
 *
 * Why: The scraper has gone silent for ~12 days three separate times (CRON_SECRET
 *   misconfig) with no alert — a failed cron returns 2xx, so nothing surfaced. This
 *   script independently checks the production DB and FAILS (exit 1) when no ingestion
 *   run was recorded recently, so GitHub's failed-workflow email reaches the maintainer
 *   regardless of the underlying cause.
 * What: Reads DATABASE_URL, queries MAX(started_at) from automated_ingestion_runs, and
 *   exits non-zero if that timestamp is NULL or older than the 25h threshold (24h cron
 *   period + 1h slack).
 * Test: Run locally with a valid DATABASE_URL — prints `OK: ...` and exits 0 when a run
 *   exists within 25h. Temporarily point at a DB with no recent rows (or rename the
 *   threshold to 0) to see `ALERT: ...` and a non-zero exit; unset DATABASE_URL to see
 *   the missing-env error path.
 */

import { neon } from "@neondatabase/serverless";

// 24h daily-cron period + 1h slack: a single missed run trips the alert the same morning.
const MAX_GAP_HOURS = 25;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("ERROR: DATABASE_URL is not set; cannot check ingestion gap.");
  process.exit(1);
}

const sql = neon(databaseUrl);

try {
  // started_at is always set on insert; completed_at is null for runs still in flight.
  const rows = await sql`SELECT MAX(started_at) AS last_run FROM automated_ingestion_runs`;
  const lastRun = rows[0]?.last_run ?? null;

  if (lastRun === null) {
    console.error("ALERT: no ingestion run ever recorded (automated_ingestion_runs is empty)");
    process.exit(1);
  }

  const lastRunDate = new Date(lastRun);
  const ageHours = (Date.now() - lastRunDate.getTime()) / (1000 * 60 * 60);
  const ageHoursStr = ageHours.toFixed(1);
  const lastRunIso = lastRunDate.toISOString();

  if (ageHours > MAX_GAP_HOURS) {
    console.error(`ALERT: no ingestion run in ${ageHoursStr}h (last: ${lastRunIso})`);
    process.exit(1);
  }

  console.log(`OK: last ingestion run ${ageHoursStr}h ago (${lastRunIso})`);
  process.exit(0);
} catch (error) {
  console.error(`ERROR: ingestion gap check failed: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
