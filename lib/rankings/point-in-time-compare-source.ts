/**
 * Read-only database source for the point-in-time compare (#95).
 *
 * Why: before the cron passes `usePointInTimeMetrics: true`, the owner needs a
 *   measured off/on diff of the live boards. That compare reads the production
 *   database from a dispatched workflow, so "read-only" must be enforced by
 *   Postgres and checked, not intended: a write must fail, and a connection on
 *   which the read-only mode did not apply must abort the run before any row is used.
 * What: `verifiedReadOnlyRunner()` sends each statement inside a `READ ONLY`
 *   transaction, preceded in that same transaction by a probe of
 *   `transaction_read_only`. A probe that does not answer `on` throws
 *   `ReadOnlyNotAppliedError` and the rows are discarded. Every statement first
 *   passes `assertSelectOnly()` (via `runReadOnly`), so a non-SELECT never reaches
 *   the driver. `createReadOnlyComparePersistence()` is a `RankingPersistencePort`
 *   built on that runner: its reads are memoised (both runs of a compare score the
 *   same rows) and every write method throws.
 * Test: `tests/unit/point-in-time-compare-source-95.test.ts` (mocked Neon driver and
 *   PGlite: a write fails, an unapplied read-only mode aborts).
 */

import { neon } from "@neondatabase/serverless";

import { foldHistoryRows, type MetricsHistoryRow, type MetricsHistorySnapshot } from "@/lib/metrics-history/point-in-time";
import { type DbRow, type ReadOnlyRunner, runReadOnly } from "@/lib/ranking-compare-db-source";
import type { StoredRankingList } from "@/lib/rankings/lists";
import type { RankingPersistencePort, RankingSourceTool } from "@/lib/services/ranking-generation.service";

/** Same rows and order as `createDbPersistence().loadActiveTools()`, with `kind` for the per-list layout. */
export const PIT_ACTIVE_TOOLS_QUERY =
  "SELECT id::text AS id, name, slug, category, status, data, kind FROM tools WHERE status = $1 ORDER BY slug ASC";
/** Same predicate as `createDbPersistence().loadCurrentRankings()`. */
export const PIT_CURRENT_RANKINGS_QUERY =
  "SELECT data, period FROM rankings WHERE is_current = true AND list = $1 LIMIT 1";
/** Same predicates as `selectMetricsHistoryRows()` in `lib/metrics-history/read.ts`. */
export const PIT_HISTORY_ROWS_QUERY =
  "SELECT tool_id::text AS tool_id, collected_date::text AS collected_date, metrics FROM tool_metrics_history " +
  "WHERE period <= $1 AND tool_id IS NOT NULL";
/** Same predicate as `selectLatestCollectedDate()` in `lib/metrics-history/read.ts`. */
export const PIT_LATEST_COLLECTED_QUERY =
  "SELECT MAX(collected_date)::text AS latest FROM tool_metrics_history WHERE period <= $1";
/** Per collector, the ledger totals of one collection day (counts only). */
export const PIT_LEDGER_QUERY =
  "SELECT collector, SUM(attempted)::int AS attempted, SUM(recorded)::int AS recorded, " +
  "SUM(flagged)::int AS flagged, SUM(not_found)::int AS not_found, SUM(failed)::int AS failed, " +
  "SUM(skipped_timeout)::int AS skipped_timeout FROM metrics_collection_runs WHERE collected_date = $1::date " +
  "GROUP BY collector ORDER BY collector";

export const PIT_COMPARE_QUERIES = [
  PIT_ACTIVE_TOOLS_QUERY,
  PIT_CURRENT_RANKINGS_QUERY,
  PIT_HISTORY_ROWS_QUERY,
  PIT_LATEST_COLLECTED_QUERY,
  PIT_LEDGER_QUERY,
] as const;

/** The probe sent first in every transaction; it must answer `on`. */
export const READ_ONLY_PROBE = "SELECT current_setting('transaction_read_only') AS read_only";

/** Raised when a transaction the compare opened is not read-only. The run aborts. */
export class ReadOnlyNotAppliedError extends Error {
  constructor(observed: string) {
    super(`read-only mode did not apply (transaction_read_only = ${observed}); compare aborted`);
    this.name = "ReadOnlyNotAppliedError";
  }
}

/** Raised by every write method of the compare port. */
export class ReadOnlyCompareWriteError extends Error {
  constructor(method: string) {
    super(`read-only compare refuses ${method}: it never writes`);
    this.name = "ReadOnlyCompareWriteError";
  }
}

/** One parameterised statement. */
export interface Statement {
  text: string;
  params: unknown[];
}

/**
 * Runs `statements` in order inside ONE transaction opened with `options`, and
 * resolves to one row array per statement. Neon: `sql.transaction([...], { readOnly })`.
 */
export type ReadOnlyTransactionDriver = (
  statements: Statement[],
  options: { readOnly: true }
) => Promise<DbRow[][]>;

/** The driver over Neon's HTTP API. Postgres opens the transaction as `READ ONLY`. */
export function neonTransactionDriver(connectionString: string): ReadOnlyTransactionDriver {
  const sql = neon(connectionString);
  return async (statements, options) =>
    (await sql.transaction(
      statements.map((s) => sql(s.text, s.params)),
      { readOnly: options.readOnly }
    )) as DbRow[][];
}

/**
 * A `ReadOnlyRunner` that proves each transaction is read-only before using its rows.
 *
 * Postcondition: a resolved result came from a transaction whose
 * `transaction_read_only` was `on`; otherwise it rejects with `ReadOnlyNotAppliedError`.
 */
export function verifiedReadOnlyRunner(driver: ReadOnlyTransactionDriver): ReadOnlyRunner {
  return async (text, params, options) => {
    const results = await driver([{ text: READ_ONLY_PROBE, params: [] }, { text, params }], options);
    const observed = results?.[0]?.[0]?.["read_only"];
    // #95: abort unless Postgres itself reports the transaction read-only.
    if (observed !== "on") throw new ReadOnlyNotAppliedError(String(observed));
    return results[1] ?? [];
  };
}

/** One collector's ledger totals for the collection day. */
export interface LedgerTotals {
  collector: string;
  attempted: number;
  recorded: number;
  flagged: number;
  not_found: number;
  failed: number;
  skipped_timeout: number;
}

/** The compare's port: a `RankingPersistencePort` plus the reads only the compare needs. */
export interface ComparePersistence extends RankingPersistencePort {
  loadMetricsHistoryForPeriod(period: string): Promise<Map<string, MetricsHistorySnapshot>>;
  loadLatestMetricsCollectedDate(period: string): Promise<string | null>;
  loadLedgerTotals(collectedDate: string): Promise<LedgerTotals[]>;
}

function memo<K, V>(load: (key: K) => Promise<V>): (key: K) => Promise<V> {
  const cache = new Map<K, Promise<V>>();
  return (key) => {
    let hit = cache.get(key);
    if (!hit) {
      hit = load(key);
      cache.set(key, hit);
    }
    return hit;
  };
}

const count = (value: unknown): number => Number(value ?? 0);

/**
 * The compare's persistence over `runner`. Reads are memoised per argument, so the
 * off and on runs score the same tools and the same previous boards. Every write
 * method throws `ReadOnlyCompareWriteError`.
 */
export function createReadOnlyComparePersistence(runner: ReadOnlyRunner): ComparePersistence {
  const tools = memo(async (status: string): Promise<RankingSourceTool[]> => {
    const rows = await runReadOnly(runner, PIT_ACTIVE_TOOLS_QUERY, [status]);
    return rows.map((row) => ({
      id: String(row["id"]),
      name: String(row["name"]),
      slug: String(row["slug"]),
      category: String(row["category"]),
      status: String(row["status"]),
      data: (row["data"] ?? {}) as Record<string, unknown>,
      kind: row["kind"] === null || row["kind"] === undefined ? null : String(row["kind"]),
    }));
  });
  const current = memo(async (list: StoredRankingList) => {
    const rows = await runReadOnly(runner, PIT_CURRENT_RANKINGS_QUERY, [list]);
    const row = rows[0];
    return row ? { data: row["data"], period: String(row["period"]) } : null;
  });
  const history = memo(async (period: string) => {
    const rows = await runReadOnly(runner, PIT_HISTORY_ROWS_QUERY, [period]);
    const historyRows: MetricsHistoryRow[] = rows.map((row) => ({
      toolId: String(row["tool_id"]),
      collectedDate: String(row["collected_date"]),
      metrics: (row["metrics"] ?? {}) as Record<string, unknown>,
    }));
    return foldHistoryRows(historyRows);
  });
  const latest = memo(async (period: string) => {
    const rows = await runReadOnly(runner, PIT_LATEST_COLLECTED_QUERY, [period]);
    const value = rows[0]?.["latest"];
    return value === null || value === undefined ? null : String(value);
  });
  const ledger = memo(async (collectedDate: string) => {
    const rows = await runReadOnly(runner, PIT_LEDGER_QUERY, [collectedDate]);
    return rows.map((row) => ({
      collector: String(row["collector"]),
      attempted: count(row["attempted"]),
      recorded: count(row["recorded"]),
      flagged: count(row["flagged"]),
      not_found: count(row["not_found"]),
      failed: count(row["failed"]),
      skipped_timeout: count(row["skipped_timeout"]),
    }));
  });

  const refuse = (method: string) => async (): Promise<never> => {
    throw new ReadOnlyCompareWriteError(method);
  };

  return {
    loadActiveTools: () => tools("active"),
    loadCurrentRankings: (list: StoredRankingList = "combined") => current(list),
    loadMetricsHistoryForPeriod: history,
    loadLatestMetricsCollectedDate: latest,
    loadLedgerTotals: ledger,
    saveSnapshot: refuse("saveSnapshot"),
    saveListSnapshots: refuse("saveListSnapshots"),
    saveDraft: refuse("saveDraft"),
  };
}
