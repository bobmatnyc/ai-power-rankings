/**
 * Read-only database source for the v7.9 → v7.10 compare (#101).
 *
 * Why: the compare runs against the production database from a manually
 *   dispatched workflow. "Read-only" must be enforced by Postgres, not just
 *   intended by the caller, so a mistaken or future write fails instead of
 *   landing. This module also keeps the compare off `getDb()`, which loads
 *   `.env` files in development and logs connection details.
 * What: every statement goes through `runReadOnly()`, which rejects anything
 *   that is not a single SELECT before it reaches the driver, and then runs it
 *   inside a `READ ONLY` Postgres transaction (`neonReadOnlyRunner`). Postgres
 *   rejects any write in such a transaction with SQLSTATE 25006.
 * Test: `lib/ranking-compare-db-source.test.ts`
 */

import { neon } from "@neondatabase/serverless";

import type { RankingSourceTool } from "./services/ranking-generation.service";

/** The one statement the compare runs: the same rows `loadActiveTools()` reads. */
export const ACTIVE_TOOLS_QUERY =
  "SELECT id, name, slug, category, status, data FROM tools WHERE status = $1";

/** Transaction options every runner must apply. `readOnly` is the literal `true`. */
export interface ReadOnlyTransactionOptions {
  readOnly: true;
}

export type DbRow = Record<string, unknown>;

/** Runs one parameterised statement inside a transaction opened with `options`. */
export type ReadOnlyRunner = (
  text: string,
  params: unknown[],
  options: ReadOnlyTransactionOptions
) => Promise<DbRow[]>;

// One SELECT, no statement separator. A CTE (`WITH … DELETE`) starts with WITH
// and is refused; a write hidden in a function call is refused by Postgres.
const SINGLE_SELECT = /^\s*select\s[^;]*;?\s*$/i;

/**
 * Throw unless `text` is a single SELECT statement.
 *
 * Precondition for every statement the compare sends; it fails before any
 * network call, so a write never reaches the database.
 */
export function assertSelectOnly(text: string): void {
  if (!SINGLE_SELECT.test(text)) {
    throw new Error("read-only compare refuses a statement that is not a single SELECT");
  }
}

/** Check `text`, then run it through `runner` inside a READ ONLY transaction. */
export async function runReadOnly(runner: ReadOnlyRunner, text: string, params: unknown[]): Promise<DbRow[]> {
  assertSelectOnly(text);
  return runner(text, params, { readOnly: true });
}

/** Load the active tools in the shape `computeRankings()` scores. */
export async function loadActiveToolsReadOnly(runner: ReadOnlyRunner): Promise<RankingSourceTool[]> {
  const rows = await runReadOnly(runner, ACTIVE_TOOLS_QUERY, ["active"]);
  return rows.map((row) => ({
    id: String(row["id"]),
    name: String(row["name"]),
    slug: String(row["slug"]),
    category: String(row["category"]),
    status: String(row["status"]),
    data: (row["data"] ?? {}) as Record<string, unknown>,
  }));
}

/**
 * A runner over Neon's HTTP driver. Each statement is sent as a one-statement
 * `sql.transaction([...], { readOnly: true })`, which Postgres opens as
 * `READ ONLY`. There is no session to reuse and nothing to close.
 */
export function neonReadOnlyRunner(connectionString: string): ReadOnlyRunner {
  const sql = neon(connectionString);
  return async (text, params, options) => {
    const [rows] = await sql.transaction([sql(text, params)], { readOnly: options.readOnly });
    return (rows ?? []) as DbRow[];
  };
}
