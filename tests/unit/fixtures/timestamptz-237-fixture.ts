/**
 * PGlite fixture for the #237 timestamptz migration tests.
 *
 * Why: the migration's claims (instant kept under a non-UTC session, defaults and index
 *   names kept, guard skips, idempotence) are about real Postgres catalog and zone
 *   behaviour, which the in-memory MigrationDb double cannot show. PGlite is Postgres
 *   compiled to WASM: no server, no network, no credentials.
 * What: builds the 14 in-scope tables as they are before 0015 — every drizzle timestamp
 *   column as zone-less `timestamp` with its DEFAULT now() and NOT NULL, every other
 *   column as nullable `text`, plus the drizzle b-tree indexes — and adapts a PGlite
 *   instance to the MigrationDb interface of scripts/apply-migrations.ts, with
 *   `readOnlyQueries` in a READ ONLY transaction.
 * Test: used by tests/unit/fixtures/timestamptz-237-probe.ts and
 *   tests/unit/timestamptz-237-preflight.test.ts.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { getTableConfig, type PgTable } from "drizzle-orm/pg-core";
import {
  articleProcessingLogs,
  articleRankingsChanges,
  articles,
  rankingVersions,
} from "../../../lib/db/article-schema";
import {
  automatedIngestionRuns,
  companies,
  metricsCollectionRuns,
  migrations,
  monthlySummaries,
  news,
  rankings,
  stateOfAiSummaries,
  toolMetricsHistory,
  tools,
} from "../../../lib/db/schema";
import type { MigrationDb } from "../../../scripts/apply-migrations";

export const REPO_ROOT = path.resolve(__dirname, "../../..");
export const MIGRATION_FILE = "0015_timestamptz_utc.sql";
export const MIGRATION_SQL = readFileSync(path.join(REPO_ROOT, "lib/db/migrations", MIGRATION_FILE), "utf8");
export const REVERT_SQL = readFileSync(path.join(REPO_ROOT, "tests/unit/fixtures/0015-revert-timestamptz.sql"), "utf8");

export const SCHEMA_TABLES: readonly PgTable[] = [
  tools,
  rankings,
  news,
  companies,
  migrations,
  monthlySummaries,
  stateOfAiSummaries,
  automatedIngestionRuns,
  toolMetricsHistory,
  metricsCollectionRuns,
  articles,
  articleRankingsChanges,
  articleProcessingLogs,
  rankingVersions,
];

export interface FixtureColumn {
  name: string;
  isTimestamp: boolean;
  notNull: boolean;
  hasDefault: boolean;
}

export interface FixtureTable {
  name: string;
  columns: FixtureColumn[];
  btreeIndexes: Array<{ name: string; columns: string[] }>;
}

/** The 14 tables as fixture descriptions, read from the drizzle schema. */
export function fixtureTables(): FixtureTable[] {
  return SCHEMA_TABLES.map((table) => {
    const config = getTableConfig(table);
    return {
      name: config.name,
      columns: config.columns.map((column) => ({
        name: column.name,
        isTimestamp: column.columnType === "PgTimestamp",
        notNull: column.columnType === "PgTimestamp" && column.notNull,
        hasDefault: column.columnType === "PgTimestamp" && column.hasDefault,
      })),
      btreeIndexes: config.indexes
        .filter((index) => index.config.method === "btree")
        .map((index) => ({
          name: index.config.name as string,
          columns: index.config.columns.map((c) => (c as { name?: string }).name ?? ""),
        }))
        .filter((index) => index.columns.every((c) => c !== "")),
    };
  });
}

/** Timestamp columns per table, in schema order. */
export function timestampColumns(table: FixtureTable): string[] {
  return table.columns.filter((c) => c.isTimestamp).map((c) => c.name);
}

/**
 * Creates the pre-0015 tables. `omitTable` drops one table and `omitColumn`
 * (`table.column`) one column, for the guard-skip case.
 */
export async function createNaiveFixture(
  db: PGlite,
  options: { omitTable?: string; omitColumn?: string } = {}
): Promise<FixtureTable[]> {
  const tables = fixtureTables()
    .filter((t) => t.name !== options.omitTable)
    .map((t) => ({ ...t, columns: t.columns.filter((c) => `${t.name}.${c.name}` !== options.omitColumn) }))
    .map((t) => ({
      ...t,
      btreeIndexes: t.btreeIndexes.filter((i) => i.columns.every((c) => t.columns.some((col) => col.name === c))),
    }));
  for (const table of tables) {
    const defs = table.columns.map((c) =>
      c.isTimestamp
        ? `"${c.name}" timestamp${c.hasDefault ? " DEFAULT now()" : ""}${c.notNull ? " NOT NULL" : ""}`
        : `"${c.name}" text`
    );
    await db.exec(`CREATE TABLE public."${table.name}" ("fixture_row" int, ${defs.join(", ")})`);
    for (const index of table.btreeIndexes) {
      await db.exec(`CREATE INDEX "${index.name}" ON public."${table.name}" (${index.columns.map((c) => `"${c}"`).join(", ")})`);
    }
  }
  return tables;
}

/** Known UTC wall clocks with microseconds, in summer (EDT) and winter (EST). */
export const SUMMER = "2026-10-23 06:00:03.123456";
export const WINTER = "2026-01-15 23:59:59.999999";

/**
 * Inserts three rows per table: 1 = every timestamp column SUMMER, 2 = NULL where
 * nullable, DEFAULT where defaulted, SUMMER otherwise, 3 = every timestamp column WINTER.
 */
export async function insertFixtureRows(db: PGlite, tables: FixtureTable[]): Promise<void> {
  for (const table of tables) {
    const ts = table.columns.filter((c) => c.isTimestamp);
    const names = ts.map((c) => `"${c.name}"`).join(", ");
    const lit = (v: string) => ts.map(() => `'${v}'`).join(", ");
    const row2 = ts.map((c) => (c.hasDefault ? "DEFAULT" : c.notNull ? `'${SUMMER}'` : "NULL")).join(", ");
    await db.exec(
      `INSERT INTO public."${table.name}" ("fixture_row", ${names}) VALUES (1, ${lit(SUMMER)}), (2, ${row2}), (3, ${lit(WINTER)})`
    );
  }
}

/** A MigrationDb over PGlite; `executed` and `notices` record what ran. */
export function pgliteMigrationDb(db: PGlite): MigrationDb & { executed: string[]; notices: string[] } {
  const executed: string[] = [];
  const notices: string[] = [];
  const applied: string[] = [];
  return {
    executed,
    notices,
    trackingTableExists: async () => true,
    createTrackingTable: async () => {},
    listAppliedFilenames: async () => [...applied],
    async executeStatement(statement) {
      executed.push(statement);
      await db.query(statement, [], { onNotice: (n) => void notices.push(n.message ?? "") });
    },
    recordApplied: async (file) => void applied.push(file),
    describeColumns: async () => [],
    async readOnlyQueries(statements) {
      return db.transaction(async (tx) => {
        await tx.exec("SET TRANSACTION READ ONLY");
        const out: Record<string, unknown>[][] = [];
        for (const statement of statements) {
          out.push((await tx.query<Record<string, unknown>>(statement)).rows);
        }
        return out;
      });
    },
  };
}

/** Per table, per column: catalog type, default, and every row's epoch in microseconds. */
export async function snapshot(db: PGlite, tables: FixtureTable[]) {
  const out: Record<string, unknown> = {};
  for (const table of tables) {
    const cols = timestampColumns(table);
    const select = cols
      .map((c) => `(extract(epoch from "${c}") * 1000000)::bigint::text AS "${c}"`)
      .join(", ");
    const rows = (await db.query(`SELECT fixture_row, ${select} FROM public."${table.name}" ORDER BY fixture_row`)).rows;
    const counts = (
      await db.query(
        `SELECT count(*)::int AS n, ${cols.map((c) => `count("${c}")::int AS "${c}"`).join(", ")} FROM public."${table.name}"`
      )
    ).rows[0];
    out[table.name] = { rows, counts };
  }
  return out;
}

export async function catalog(db: PGlite) {
  const columns = (
    await db.query<{ t: string; c: string; data_type: string; column_default: string | null }>(
      `SELECT table_name AS t, column_name AS c, data_type, column_default FROM information_schema.columns
        WHERE table_schema = 'public' AND data_type LIKE 'timestamp%' ORDER BY 1, 2`
    )
  ).rows;
  const indexes = (
    await db.query<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' ORDER BY 1`
    )
  ).rows;
  return { columns, indexes };
}

export async function relfilenodes(db: PGlite): Promise<Record<string, number>> {
  const rows = (
    await db.query<{ relname: string; relfilenode: number }>(
      `SELECT relname, relfilenode::int AS relfilenode FROM pg_class WHERE relkind = 'r' AND relnamespace = 'public'::regnamespace`
    )
  ).rows;
  return Object.fromEntries(rows.map((r) => [r.relname, r.relfilenode]));
}
