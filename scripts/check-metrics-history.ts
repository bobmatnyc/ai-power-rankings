/**
 * Read-only check of the monthly metrics-history collection (#95).
 *
 * Why: each collector shard runs in its own cron invocation, so a shard that
 *   never ran, or ran partially, is invisible unless someone reads the ledger.
 *   Nobody can reach the production database from a laptop.
 * What: two SELECTs inside one READ ONLY Postgres transaction: history rows
 *   per collected_date, and the ledger rows for the checked date. Prints the
 *   counts-only report from `renderMetricsHistoryReport()`: no tool name,
 *   slug, id or metric value (the repository is public). Errors print a fixed
 *   message or the error class name only.
 *   Exit 0: every shard ok. Exit 3: a shard missing or not ok. Exit 1: an error.
 * Test: report logic in `tests/unit/metrics-cron-config-95.test.ts`. Run by
 *   `.github/workflows/check-metrics-history.yml` (dispatch only).
 *
 * Usage: npx tsx scripts/check-metrics-history.ts [--date=YYYY-MM-DD]
 */

import { neon } from "@neondatabase/serverless";
import { type DateCount, type LedgerRow, renderMetricsHistoryReport } from "@/lib/metrics-history/check-report";
import { assertSelectOnly, redact } from "@/lib/ranking-snapshot-diff";

const CONNECTION_VAR = "DATABASE_URL";

const ROWS_QUERY =
  "SELECT collected_date::text AS collected_date, count(*)::int AS rows FROM tool_metrics_history GROUP BY collected_date ORDER BY collected_date DESC LIMIT 24";
const LEDGER_QUERY =
  "SELECT collector, shard, shard_count, status, attempted, recorded, flagged, not_found, failed, skipped_timeout FROM metrics_collection_runs WHERE collected_date = $1 ORDER BY collector, shard";

/** #95: an error whose message carries no row data and may be printed. */
class CheckError extends Error {}

function parseDate(): string {
  const arg = process.argv.find((a) => a.startsWith("--date="))?.slice("--date=".length);
  if (!arg) return new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(arg)) throw new CheckError("--date must be YYYY-MM-DD");
  return arg;
}

async function main(): Promise<number> {
  const connectionString = process.env[CONNECTION_VAR];
  if (!connectionString) throw new CheckError("the database connection variable is not set");
  const date = parseDate();

  assertSelectOnly(ROWS_QUERY);
  assertSelectOnly(LEDGER_QUERY);
  const sql = neon(connectionString);
  const [rowsPerDate, ledger] = await sql.transaction([sql(ROWS_QUERY, []), sql(LEDGER_QUERY, [date])], {
    readOnly: true,
  });

  const { exitCode, report } = renderMetricsHistoryReport({
    date,
    rowsPerDate: (rowsPerDate ?? []) as DateCount[],
    ledger: (ledger ?? []) as LedgerRow[],
  });
  process.stdout.write(`${report}\n`);
  return exitCode;
}

// #95: nothing but the report may reach the public log.
const quiet = () => {};
for (const method of ["log", "info", "warn", "error", "debug"] as const) {
  console[method] = quiet;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    const detail =
      error instanceof CheckError
        ? redact(error.message, [process.env[CONNECTION_VAR]])
        : error instanceof Error
          ? error.name
          : "unknown error";
    process.stdout.write("Result: ERROR\n");
    process.stderr.write(`check-metrics-history failed: ${detail}\n`);
    process.exit(1);
  });
