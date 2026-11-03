#!/usr/bin/env node
/**
 * Daily weekly-digest gap-detector.
 *
 * Why: #363 — the weekly-digest cron (`GET /api/cron/weekly-digest`, Mondays 07:30 UTC,
 *   #181/#322) records no row that scripts/check-ingestion-gap.mjs reads. A failed run
 *   stores nothing and a run that never fires stores nothing, so the only signals were the
 *   route's alert webhook and its 500, and neither fires when Vercel never calls the route.
 * What: Reads DATABASE_URL, fetches the newest `weekly_digests` row by `week` and fails
 *   (exit 1) via evaluateWeeklyDigest() when there is no row (ALERT[DIGEST_NONE]) or the
 *   newest week's `generated_at` is older than MAX_DIGEST_AGE_HOURS or unreadable
 *   (ALERT[DIGEST_STALE]). A failed run and a missing run look the same here — no row for
 *   the new week — which is the point: either way the digest is absent. A week with no
 *   articles is also stored as no row (the route skips it), so it alerts too; daily
 *   ingestion would have raised ZERO_YIELD_STREAK for such a week already. Every outcome ends
 *   with LAST_DIGEST_WEEK= and LAST_DIGEST_GENERATED= so the log names the stored state.
 *   Ordered by `week`, not `generated_at`: a forced re-run of an older week (`?force=1`)
 *   rewrites that row's generated_at and would otherwise hide a missed current week.
 * Test: `npx vitest run tests/unit/check-weekly-digest-gap-363.test.ts` feeds
 *   evaluateWeeklyDigest() synthetic rows with an injected clock and checks the workflow
 *   job that runs this script. Only main() touches a database, and only when run directly.
 */

import { neon } from "@neondatabase/serverless";
import { naiveUtcTypes, parseNaiveUtcTimestamp } from "../lib/db/naive-utc-timestamp.mjs";

// #363: one weekly period (7 days) plus one day of slack. The detector runs daily at
// 09:00 UTC, so a missed Monday 07:30 run is reported on the Tuesday, 8d01h30m after the
// previous digest, and a healthy digest (at most 7d01h30m old on the next Monday) never trips it.
export const MAX_DIGEST_AGE_HOURS = 8 * 24;

// Same driver options as check-ingestion-gap.mjs; generated_at is timestamptz, so the
// naive-UTC parser never runs for it, but one setting for every raw reader keeps them alike.
export const NEON_OPTIONS = { types: naiveUtcTypes };

// A libpq-style URL, which a driver error could echo into the public Actions log.
const CONNECTION_STRING_PATTERN = /postgres(?:ql)?:\/\/\S+/gi;

/** Strip anything shaped like a connection string out of text bound for the log. */
export function redactConnectionString(text) {
  return String(text ?? "").replace(CONNECTION_STRING_PATTERN, "[redacted]");
}

/** One whitespace-free token, with `ALERT[` neutralised so a stored value cannot forge a reason. */
function token(value) {
  if (value === null || value === undefined || value === "") return "none";
  return String(value).replace(/\s+/g, "_").replace(/ALERT\[/g, "ALERT_");
}

/**
 * Pure evaluation of weekly-digest freshness — no I/O.
 *
 * @param {{week?: unknown, generated_at?: unknown} | null | undefined} latest
 *   The newest weekly_digests row by week, or nothing when the table is empty.
 * @param {number} nowMs - injectable clock for deterministic tests.
 * @returns {{ ok: boolean, exitCode: number, lines: string[] }}
 *   `lines[0]` is the OK or first ALERT line; the two state lines always end the list.
 */
export function evaluateWeeklyDigest(latest, nowMs = Date.now()) {
  if (!latest) {
    return {
      ok: false,
      exitCode: 1,
      lines: [
        "ALERT[DIGEST_NONE]: no weekly digest ever stored (weekly_digests is empty)",
        "LAST_DIGEST_WEEK=none",
        "LAST_DIGEST_GENERATED=none",
      ],
    };
  }

  const week = token(latest.week);
  const generated = parseNaiveUtcTimestamp(latest.generated_at) ?? new Date(Number.NaN);
  const readable = !Number.isNaN(generated.getTime());
  const generatedIso = readable ? generated.toISOString() : "invalid";
  const ageHours = (nowMs - generated.getTime()) / (1000 * 60 * 60);
  const stateLines = [`LAST_DIGEST_WEEK=${week}`, `LAST_DIGEST_GENERATED=${generatedIso}`];

  // Written as "not within the limit" so an unreadable timestamp (NaN age) fails closed.
  if (!(ageHours <= MAX_DIGEST_AGE_HOURS)) {
    const age = readable ? `${(ageHours / 24).toFixed(1)}d ago` : "at an unreadable time";
    return {
      ok: false,
      exitCode: 1,
      lines: [
        `ALERT[DIGEST_STALE]: newest weekly digest (${week}) was generated ${age} (${generatedIso}); ` +
          `the Monday 07:30 UTC weekly-digest cron has missed or failed at least one run`,
        ...stateLines,
      ],
    };
  }

  return {
    ok: true,
    exitCode: 0,
    lines: [
      `OK: newest weekly digest (${week}) generated ${(ageHours / 24).toFixed(1)}d ago (${generatedIso})`,
      ...stateLines,
    ],
  };
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("ERROR: DATABASE_URL is not set; cannot check the weekly digest.");
    process.exit(1);
    return;
  }

  const sql = neon(databaseUrl, NEON_OPTIONS);

  try {
    // `YYYY-Www` sorts chronologically as text (lib/services/weekly-digest.repository.ts).
    const rows = await sql`
      SELECT week, generated_at
      FROM weekly_digests
      ORDER BY week DESC
      LIMIT 1
    `;
    const result = evaluateWeeklyDigest(rows[0]);
    for (const line of result.lines) {
      if (result.ok) console.log(line);
      else console.error(line);
    }
    process.exit(result.exitCode);
  } catch (error) {
    console.error(
      `ERROR: weekly digest check failed: ${redactConnectionString(error instanceof Error ? error.message : error)}`
    );
    process.exit(1);
  }
}

// Only run the CLI when executed directly, never when imported by tests.
const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main();
}
