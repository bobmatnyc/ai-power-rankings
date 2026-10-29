/**
 * #325: migration 0029 matches the drizzle `providerUsageEvents` table, is additive and
 * idempotent, and applies through the existing apply-migration runner.
 *
 * Why: migrations are applied by hand through `.github/workflows/apply-migration.yml`; a
 *   column the schema declares and the SQL omits would surface only as a missing ledger
 *   row (the writer fails open), so nothing else would notice.
 * What: parses the CREATE TABLE and compares columns (name, SQL type, NOT NULL) with
 *   `getTableConfig()`; checks every drizzle index is created; checks every statement is
 *   CREATE ... IF NOT EXISTS with no ALTER/DROP/UPDATE of another table; runs
 *   `runMigrations()` with `--only` against an in-memory double and checks the statements
 *   run in order and the file is recorded in the tracking table.
 * Test: `npx vitest run tests/unit/provider-usage-migration-325.test.ts`. No database.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { providerUsageEvents } from "../../lib/db/schema";
import { type MigrationDb, runMigrations, splitStatements } from "../../scripts/apply-migrations";

const FILE = "0029_create_provider_usage_events.sql";
const SQL_TEXT = readFileSync(path.resolve(__dirname, "../../lib/db/migrations", FILE), "utf8");
const STATEMENTS = splitStatements(SQL_TEXT);

interface ParsedColumn {
  name: string;
  type: string;
  notNull: boolean;
}

function stripComments(statement: string): string {
  return statement
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .trim();
}

function parsedColumns(): ParsedColumn[] {
  const statement = STATEMENTS.find((s) => s.includes('CREATE TABLE IF NOT EXISTS "provider_usage_events"'));
  expect(statement, "CREATE TABLE provider_usage_events").toBeDefined();
  const text = statement as string;
  const body = text.slice(text.indexOf("(") + 1, text.lastIndexOf(")"));
  return body
    .split("\n")
    .map((line) => line.trim().replace(/,$/, ""))
    .filter((line) => line.startsWith('"'))
    .map((line) => {
      // The type runs until the first constraint keyword or the end of the line.
      const match = /^"([a-z_]+)" (.+?)(?= (?:PRIMARY|DEFAULT|NOT|REFERENCES)\b|$)/.exec(line);
      return {
        name: match?.[1] ?? "",
        type: (match?.[2] ?? "").replace(/\((\d+), (\d+)\)/, "($1,$2)"),
        notNull: /NOT NULL|PRIMARY KEY/.test(line),
      };
    });
}

function schemaColumns(): ParsedColumn[] {
  return getTableConfig(providerUsageEvents).columns.map((column) => ({
    name: column.name,
    type: column.getSQLType().replace(/\((\d+), ?(\d+)\)/, "($1,$2)"),
    notNull: column.notNull,
  }));
}

describe("#325 migration 0029", () => {
  it("columns match the drizzle schema", () => {
    expect(getTableConfig(providerUsageEvents).name).toBe("provider_usage_events");
    const sort = (cols: ParsedColumn[]) => [...cols].sort((a, b) => a.name.localeCompare(b.name));
    expect(sort(parsedColumns())).toEqual(sort(schemaColumns()));
  });

  it("creates every drizzle index, including the time and provider+time dashboard reads", () => {
    const indexes = getTableConfig(providerUsageEvents).indexes;
    expect(indexes.map((i) => i.config.name).sort()).toEqual([
      "provider_usage_events_created_at_idx",
      "provider_usage_events_provider_created_at_idx",
      "provider_usage_events_run_id_idx",
    ]);
    for (const index of indexes) {
      const created = STATEMENTS.find((s) => s.includes(`INDEX IF NOT EXISTS "${index.config.name}"`));
      expect(created, `index ${index.config.name}`).toBeDefined();
      expect(stripComments(created as string).startsWith("CREATE INDEX")).toBe(!index.config.unique);
    }
    expect(SQL_TEXT).toMatch(
      /"provider_usage_events_provider_created_at_idx"\s+ON "provider_usage_events" \("provider", "created_at"\)/
    );
  });

  it("links run_id to automated_ingestion_runs with ON DELETE SET NULL", () => {
    const fk = getTableConfig(providerUsageEvents).foreignKeys[0]?.reference();
    expect(getTableConfig(fk?.foreignTable as never).name).toBe("automated_ingestion_runs");
    expect(SQL_TEXT).toContain('"run_id" uuid REFERENCES "automated_ingestion_runs"("id") ON DELETE SET NULL');
  });

  it("is additive and idempotent: every statement is CREATE ... IF NOT EXISTS", () => {
    expect(STATEMENTS).toHaveLength(4);
    for (const statement of STATEMENTS) {
      const code = stripComments(statement);
      expect(code).toMatch(/^CREATE (TABLE|INDEX) IF NOT EXISTS /);
      expect(code.replace(/;\s*$/, "")).not.toContain(";");
    }
    const code = STATEMENTS.map(stripComments).join("\n").replace("ON DELETE SET NULL", "");
    expect(code).not.toMatch(/\b(ALTER|DROP|UPDATE|DELETE|INSERT|TRUNCATE)\b/i);
  });

  it("applies through scripts/apply-migrations.ts --only and records the file", async () => {
    const executed: string[] = [];
    const recorded: string[] = [];
    const db: MigrationDb = {
      trackingTableExists: async () => true,
      createTrackingTable: async () => {},
      listAppliedFilenames: async () => ["0021_drop_rankings_period_unique.sql"],
      executeStatement: async (statement) => void executed.push(statement),
      recordApplied: async (file) => void recorded.push(file),
      describeColumns: async () => [],
    };
    const files = {
      list: () => ["0021_drop_rankings_period_unique.sql", FILE],
      read: () => SQL_TEXT,
    };

    const result = await runMigrations(
      { db, files, log: () => {} },
      { dryRun: false, only: FILE, showColumns: null, force: false }
    );

    expect(result.exitCode).toBe(0);
    expect(executed).toEqual(STATEMENTS);
    expect(recorded).toEqual([FILE]);
  });
});
