/**
 * #95: migration 0014 matches the drizzle schema, is idempotent, and applies
 * through the existing apply-migration runner.
 *
 * Why: migrations here are applied by hand through
 *   `.github/workflows/apply-migration.yml`; a CREATE that the runner drops, or a
 *   column the schema declares and the SQL omits, would surface only as a 500 at
 *   the first cron run on the 1st.
 * What: parses each CREATE TABLE in the file and compares its columns (name, SQL
 *   type, NOT NULL) and its index names with `getTableConfig()` of the drizzle
 *   tables; checks every statement carries IF NOT EXISTS; runs
 *   `runMigrations()` from `scripts/apply-migrations.ts` with `--only` against an
 *   in-memory database double and checks every statement was executed in order.
 * Test: `npx vitest run tests/unit/metrics-history-migration-95.test.ts`. No database.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { metricsCollectionRuns, toolMetricsHistory } from "../../lib/db/schema";
import { type MigrationDb, runMigrations, splitStatements } from "../../scripts/apply-migrations";

const FILE = "0014_add_tool_metrics_history.sql";
const SQL_TEXT = readFileSync(path.resolve(__dirname, "../../lib/db/migrations", FILE), "utf8");
const STATEMENTS = splitStatements(SQL_TEXT);

interface ParsedColumn {
  name: string;
  type: string;
  notNull: boolean;
}

/** Columns of `CREATE TABLE IF NOT EXISTS "<table>" ( ... );` in the migration. */
function parsedColumns(table: string): ParsedColumn[] {
  const statement = STATEMENTS.find((s) => s.includes(`CREATE TABLE IF NOT EXISTS "${table}"`));
  expect(statement, `CREATE TABLE for ${table}`).toBeDefined();
  const body = (statement as string).slice((statement as string).indexOf("(") + 1, (statement as string).lastIndexOf(")"));
  return body
    .split("\n")
    .map((line) => line.trim().replace(/,$/, ""))
    .filter((line) => line.startsWith('"'))
    .map((line) => {
      const match = /^"([a-z_]+)" ([a-z]+)/.exec(line);
      return {
        name: match?.[1] ?? "",
        type: match?.[2] ?? "",
        notNull: /NOT NULL|PRIMARY KEY/.test(line),
      };
    });
}

function schemaColumns(table: typeof toolMetricsHistory | typeof metricsCollectionRuns): ParsedColumn[] {
  return getTableConfig(table).columns.map((column) => ({
    name: column.name,
    // #237: 0014 creates these as `timestamp`; 0015 converts them to timestamptz.
    type: column.getSQLType() === "timestamp with time zone" ? "timestamp" : column.getSQLType(),
    notNull: column.notNull,
  }));
}

describe("#95 migration 0014", () => {
  it.each([
    ["tool_metrics_history", toolMetricsHistory],
    ["metrics_collection_runs", metricsCollectionRuns],
  ] as const)("%s columns match the drizzle schema", (name, table) => {
    expect(getTableConfig(table).name).toBe(name);
    const sort = (cols: ParsedColumn[]) => [...cols].sort((a, b) => a.name.localeCompare(b.name));
    expect(sort(parsedColumns(name))).toEqual(sort(schemaColumns(table)));
  });

  it("declares every drizzle index, with the same uniqueness", () => {
    for (const table of [toolMetricsHistory, metricsCollectionRuns]) {
      for (const index of getTableConfig(table).indexes) {
        const { name, unique } = index.config;
        const created = STATEMENTS.find((s) => s.includes(`INDEX IF NOT EXISTS "${name}"`));
        expect(created, `index ${name}`).toBeDefined();
        expect((created as string).startsWith("CREATE UNIQUE INDEX")).toBe(Boolean(unique));
      }
    }
  });

  it("keys the history upsert and the ledger upsert on unique indexes", () => {
    expect(SQL_TEXT).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS "tool_metrics_history_tool_date_idx"\s+ON "tool_metrics_history" \("tool_id", "collected_date"\)/);
    expect(SQL_TEXT).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS "metrics_collection_runs_date_collector_shard_idx"\s+ON "metrics_collection_runs" \("collected_date", "collector", "shard"\)/
    );
  });

  it("is CREATE-only and idempotent: every statement is guarded with IF NOT EXISTS", () => {
    expect(STATEMENTS).toHaveLength(6);
    for (const statement of STATEMENTS) {
      const code = statement
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim();
      expect(code).toMatch(/^CREATE (UNIQUE )?(TABLE|INDEX) IF NOT EXISTS /);
      // One statement per chunk: neon-http runs a single statement per call.
      expect(code.replace(/;\s*$/, "")).not.toContain(";");
    }
    const code = STATEMENTS.join("\n")
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n")
      .replace('REFERENCES "tools"("id") ON DELETE SET NULL', "");
    expect(code).not.toMatch(/\b(ALTER|DROP|UPDATE|DELETE|INSERT|TRUNCATE)\b/i);
  });

  it("applies through scripts/apply-migrations.ts --only, executing all six statements", async () => {
    const executed: string[] = [];
    const recorded: string[] = [];
    const db: MigrationDb = {
      trackingTableExists: async () => true,
      createTrackingTable: async () => {},
      listAppliedFilenames: async () => ["0013_add_candidate_outcome_tracking.sql"],
      executeStatement: async (statement) => void executed.push(statement),
      recordApplied: async (file) => void recorded.push(file),
      describeColumns: async () => [],
    };
    const files = {
      list: () => ["0013_add_candidate_outcome_tracking.sql", FILE],
      read: () => SQL_TEXT,
    };

    const result = await runMigrations(
      { db, files, log: () => {} },
      { dryRun: false, only: FILE, showColumns: null, force: false }
    );

    expect(result.exitCode).toBe(0);
    expect(executed).toEqual(STATEMENTS);
    expect(executed[0]).toContain('CREATE TABLE IF NOT EXISTS "tool_metrics_history"');
    expect(recorded).toEqual([FILE]);
  });
});
