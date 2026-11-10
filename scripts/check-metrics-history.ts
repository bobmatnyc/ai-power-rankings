/**
 * Read-only check of the monthly metrics-history collection (#95).
 *
 * Why: each collector shard runs in its own cron invocation, so a shard that
 *   never ran, ran partially, or recorded nothing is invisible unless someone
 *   reads the ledger. Nobody can reach the production database from a laptop,
 *   so a scheduled workflow runs this and fails (email) on a bad month.
 * What: five SELECTs inside one READ ONLY Postgres transaction: history rows
 *   per collected_date; the ledger rows for the checked date; the tool count
 *   and history rows for the date; per part, how many tools kept every
 *   value since the previous collected_date (compared inside Postgres, so no
 *   value leaves the database); and, per part, eligible tools and how many of
 *   them were recorded (#95, floors from `METRICS_COVERAGE_FLOOR` or
 *   `COVERAGE_FLOOR`). Prints the counts-only report from
 *   `renderMetricsHistoryReport()`: no tool name, slug, id or metric value (the
 *   repository is public). Errors print a fixed message or the error class name.
 *   Exit 0: pass. Exit 3: a check failed. Exit 1: an error, including a failed query.
 * Test: `tests/unit/metrics-check-report-95.test.ts` (`executeCheck` arms),
 *   `tests/unit/metrics-cron-config-95.test.ts` (source contract),
 *   `tests/unit/metrics-part-coverage-pglite-95.test.ts` (PART_COVERAGE_QUERY on PGlite). Run by
 *   `.github/workflows/check-metrics-history.yml`.
 *
 * Usage: npx tsx scripts/check-metrics-history.ts [--date=YYYY-MM-DD | --scheduled]
 */

import { neon } from "@neondatabase/serverless";
import {
  type Coverage,
  type CoverageFloors,
  type DateCount,
  type FlatCount,
  type LedgerRow,
  type PartCoverage,
  parseCoverageFloors,
  renderMetricsHistoryReport,
  resolveCheckDate,
} from "../lib/metrics-history/check-report";
import { GITHUB_URL_PATHS } from "../lib/metrics-collectors/github";
import { COLLECTOR_PARTS } from "../lib/metrics-collectors/registry";
import { assertSelectOnly, redact } from "../lib/ranking-snapshot-diff";

const CONNECTION_VAR = "DATABASE_URL";

export const ROWS_QUERY =
  "SELECT collected_date::text AS collected_date, count(*)::int AS rows FROM tool_metrics_history GROUP BY collected_date ORDER BY collected_date DESC LIMIT 24";
export const LEDGER_QUERY =
  "SELECT collector, shard, shard_count, status, attempted, recorded, flagged, not_found, failed, skipped_timeout FROM metrics_collection_runs WHERE collected_date = $1 ORDER BY collector, shard";
export const COVERAGE_QUERY =
  "SELECT (SELECT count(*) FROM tools)::int AS tools, (SELECT count(*) FROM tool_metrics_history WHERE collected_date = $1::date)::int AS rows";
// #95: per part, a tool is unchanged when every leaf `value` matches the previous
// collected_date's (`as_of` is ignored). Only the two counts leave the database.
// #95: the previous date is per part, as in PART_COVERAGE_QUERY, so an off-day row does
// not leave the other parts with nothing to compare.
export const FLAT_QUERY =
  "SELECT part, count(*)::int AS compared, (count(*) FILTER (WHERE same))::int AS unchanged FROM (" +
  "SELECT p.part AS part, " +
  "(SELECT jsonb_object_agg(e.key, e.value -> 'value') FROM jsonb_each(cur.metrics -> p.part) AS e) IS NOT DISTINCT FROM " +
  "(SELECT jsonb_object_agg(e.key, e.value -> 'value') FROM jsonb_each(prev.metrics -> p.part) AS e) AS same " +
  "FROM tool_metrics_history cur CROSS JOIN unnest($2::text[]) AS p(part) " +
  "JOIN tool_metrics_history prev ON prev.tool_id = cur.tool_id " +
  "AND prev.collected_date = (SELECT max(h.collected_date) FROM tool_metrics_history h " +
  "WHERE h.collected_date < $1::date AND jsonb_typeof(h.metrics -> p.part) = 'object') " +
  "WHERE cur.collected_date = $1::date AND jsonb_typeof(cur.metrics -> p.part) = 'object' " +
  "AND jsonb_typeof(prev.metrics -> p.part) = 'object'" +
  ") AS t GROUP BY part";

// #95: per part, the eligible tools (see COVERAGE_FLOOR) and how many of them carry the
// part's key on the checked date. $3 is GITHUB_URL_PATHS, the collector's own URL fields.
// #95: the previous collection is per part: the latest earlier date holding that part. An
// off-day row (open-weight run, shard re-run) must not zero eligibility for the other parts.
export const PART_COVERAGE_QUERY =
  "SELECT p.part AS part, count(*)::int AS eligible, " +
  "(count(*) FILTER (WHERE jsonb_typeof(cur.metrics -> p.part) = 'object'))::int AS recorded " +
  "FROM tools t CROSS JOIN unnest($2::text[]) AS p(part) " +
  "LEFT JOIN tool_metrics_history cur ON cur.tool_id = t.id AND cur.collected_date = $1::date " +
  "LEFT JOIN tool_metrics_history prev ON prev.tool_id = t.id " +
  "AND prev.collected_date = (SELECT max(h.collected_date) FROM tool_metrics_history h " +
  "WHERE h.collected_date < $1::date AND jsonb_typeof(h.metrics -> p.part) = 'object') " +
  "WHERE jsonb_typeof(prev.metrics -> p.part) = 'object' " +
  "OR (p.part = 'github' AND EXISTS (SELECT 1 FROM unnest($3::text[]) AS g(path) " +
  "WHERE jsonb_typeof(t.data #> string_to_array(g.path, '.')) = 'string' " +
  "AND (t.data #>> string_to_array(g.path, '.')) LIKE '%github.com%')) " +
  "GROUP BY p.part";

export const QUERIES = [ROWS_QUERY, LEDGER_QUERY, COVERAGE_QUERY, FLAT_QUERY, PART_COVERAGE_QUERY] as const;

export interface Statement {
  text: string;
  params: unknown[];
}

/** Runs every statement in one READ ONLY transaction; resolves to one row array per statement. */
export type RunReadOnly = (statements: Statement[]) => Promise<unknown[]>;

/** #95: an error whose message carries no row data and may be printed. */
class CheckError extends Error {}

function rowsOf<T>(result: unknown): T[] {
  if (!Array.isArray(result)) throw new CheckError("a query returned no row set");
  return result as T[];
}

function count(value: unknown): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw new CheckError("a count query returned a non-count");
  return n;
}

function neonReadOnly(connectionString: string): RunReadOnly {
  const sql = neon(connectionString);
  return (statements) => sql.transaction(statements.map((s) => sql(s.text, s.params)), { readOnly: true });
}

/**
 * Runs the check and returns what to print and the exit code; never throws.
 * Any error, a failed query included, yields `Result: ERROR` and exit 1.
 */
export async function executeCheck(deps: {
  argv: readonly string[];
  now: Date;
  connectionString: string | undefined;
  /** `METRICS_COVERAGE_FLOOR`; see `parseCoverageFloors`. */
  coverageFloorSpec?: string | undefined;
  connect?: (connectionString: string) => RunReadOnly;
}): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  try {
    const { connectionString } = deps;
    if (!connectionString) throw new CheckError("the database connection variable is not set");
    let coverageFloor: CoverageFloors;
    try {
      coverageFloor = parseCoverageFloors(deps.coverageFloorSpec);
    } catch (error) {
      throw new CheckError(error instanceof Error ? error.message : "bad coverage floor");
    }
    let date: string;
    try {
      date = resolveCheckDate(deps.argv, deps.now);
    } catch (error) {
      throw new CheckError(error instanceof Error ? error.message : "bad arguments");
    }

    for (const query of QUERIES) assertSelectOnly(query);
    const run = (deps.connect ?? neonReadOnly)(connectionString);
    const results = await run([
      { text: ROWS_QUERY, params: [] },
      { text: LEDGER_QUERY, params: [date] },
      { text: COVERAGE_QUERY, params: [date] },
      { text: FLAT_QUERY, params: [date, [...COLLECTOR_PARTS]] },
      { text: PART_COVERAGE_QUERY, params: [date, [...COLLECTOR_PARTS], [...GITHUB_URL_PATHS]] },
    ]);
    if (!Array.isArray(results) || results.length !== QUERIES.length) {
      throw new CheckError("the transaction returned the wrong number of results");
    }

    const rowsPerDate = rowsOf<DateCount>(results[0]).map((r) => ({
      collected_date: String(r.collected_date),
      rows: count(r.rows),
    }));
    const coverageRow = rowsOf<Coverage>(results[2])[0];
    if (!coverageRow) throw new CheckError("the coverage query returned no row");
    const coverage = { tools: count(coverageRow.tools), rows: count(coverageRow.rows) };
    const flat = rowsOf<FlatCount>(results[3]).map((r) => ({
      part: String(r.part),
      compared: count(r.compared),
      unchanged: count(r.unchanged),
    }));
    const partCoverage = rowsOf<PartCoverage>(results[4]).map((r) => ({
      part: String(r.part),
      eligible: count(r.eligible),
      recorded: count(r.recorded),
    }));
    const previousDate = rowsPerDate.map((r) => r.collected_date).find((d) => d < date) ?? null;

    const { exitCode, report } = renderMetricsHistoryReport({
      date,
      rowsPerDate,
      ledger: rowsOf<LedgerRow>(results[1]),
      coverage,
      previousDate,
      flat,
      partCoverage,
      coverageFloor,
    });
    return { exitCode, stdout: `${report}\n`, stderr: "" };
  } catch (error: unknown) {
    const detail =
      error instanceof CheckError
        ? redact(error.message, [deps.connectionString])
        : error instanceof Error
          ? error.name
          : "unknown error";
    return { exitCode: 1, stdout: "Result: ERROR\n", stderr: `check-metrics-history failed: ${detail}\n` };
  }
}

if (process.argv[1]?.endsWith("check-metrics-history.ts")) {
  // #95: nothing but the report may reach the public log.
  const quiet = () => {};
  for (const method of ["log", "info", "warn", "error", "debug"] as const) {
    console[method] = quiet;
  }
  void executeCheck({
    argv: process.argv,
    now: new Date(),
    connectionString: process.env[CONNECTION_VAR],
    coverageFloorSpec: process.env["METRICS_COVERAGE_FLOOR"],
  }).then(
    ({ exitCode, stdout, stderr }) => {
      process.stdout.write(stdout);
      if (stderr) process.stderr.write(stderr);
      process.exit(exitCode);
    }
  );
}
