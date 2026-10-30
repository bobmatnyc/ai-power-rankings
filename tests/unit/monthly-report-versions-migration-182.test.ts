/**
 * #182: migration 0031 creates `monthly_report_versions`, matches the drizzle
 * schema, is idempotent, and applies through the existing apply-migration runner.
 *
 * Why: migrations here are applied by hand through
 *   `.github/workflows/apply-migration.yml`; a column the schema declares and the
 *   SQL omits would surface only as a 500 at the first generation.
 * What: parses the CREATE TABLE in the file and compares its columns (name, SQL
 *   type, NOT NULL) and its index names and uniqueness with `getTableConfig()` of
 *   the drizzle table; checks every statement carries IF NOT EXISTS and is CREATE
 *   only, so it touches no existing table; runs `runMigrations()` from
 *   `scripts/apply-migrations.ts` with `--only` against an in-memory database double.
 * Test: `npx vitest run tests/unit/monthly-report-versions-migration-182.test.ts`. No database.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { monthlyReportVersions } from "../../lib/db/schema";
import { type MigrationDb, runMigrations, splitStatements } from "../../scripts/apply-migrations";

const FILE = "0031_create_monthly_report_versions.sql";
const SQL_TEXT = readFileSync(path.resolve(__dirname, "../../lib/db/migrations", FILE), "utf8");
const STATEMENTS = splitStatements(SQL_TEXT);

interface ParsedColumn {
  name: string;
  type: string;
  notNull: boolean;
}

function parsedColumns(table: string): ParsedColumn[] {
  const statement = STATEMENTS.find((s) => s.includes(`CREATE TABLE IF NOT EXISTS "${table}"`));
  expect(statement, `CREATE TABLE for ${table}`).toBeDefined();
  const text = statement as string;
  const body = text.slice(text.indexOf("(") + 1, text.lastIndexOf(")"));
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

function schemaColumns(): ParsedColumn[] {
  return getTableConfig(monthlyReportVersions).columns.map((column) => ({
    name: column.name,
    // Born timestamptz (#237): the SQL says `timestamptz`, drizzle says `timestamp with time zone`.
    type: column.getSQLType() === "timestamp with time zone" ? "timestamptz" : column.getSQLType(),
    notNull: column.notNull,
  }));
}

describe("#182 migration 0031", () => {
  it("is numbered 0031: 0030 is taken on main", () => {
    expect(FILE.slice(0, 4)).toBe("0031");
  });

  it("monthly_report_versions columns match the drizzle schema", () => {
    expect(getTableConfig(monthlyReportVersions).name).toBe("monthly_report_versions");
    const sort = (cols: ParsedColumn[]) => [...cols].sort((a, b) => a.name.localeCompare(b.name));
    expect(sort(parsedColumns("monthly_report_versions"))).toEqual(sort(schemaColumns()));
  });

  it("declares every drizzle index, with the same uniqueness, and keys (period, version) uniquely", () => {
    for (const index of getTableConfig(monthlyReportVersions).indexes) {
      const { name, unique } = index.config;
      const created = STATEMENTS.find((s) => s.includes(`INDEX IF NOT EXISTS "${name}"`));
      expect(created, `index ${name}`).toBeDefined();
      expect((created as string).startsWith("CREATE UNIQUE INDEX")).toBe(Boolean(unique));
    }
    expect(SQL_TEXT).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS "monthly_report_versions_period_version_idx"\s+ON "monthly_report_versions" \("period", "version"\)/
    );
  });

  it("is CREATE-only and idempotent: every statement is guarded with IF NOT EXISTS", () => {
    expect(STATEMENTS).toHaveLength(3);
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
      .join("\n");
    expect(code).not.toMatch(/\b(ALTER|DROP|UPDATE|DELETE|INSERT|TRUNCATE)\b/i);
  });

  it("applies through scripts/apply-migrations.ts --only, executing all three statements", async () => {
    const executed: string[] = [];
    const recorded: string[] = [];
    const db: MigrationDb = {
      trackingTableExists: async () => true,
      createTrackingTable: async () => {},
      listAppliedFilenames: async () => ["0029_create_provider_usage_events.sql"],
      executeStatement: async (statement) => void executed.push(statement),
      recordApplied: async (file) => void recorded.push(file),
      describeColumns: async () => [],
    };
    const files = {
      list: () => ["0029_create_provider_usage_events.sql", FILE],
      read: () => SQL_TEXT,
    };

    const result = await runMigrations(
      { db, files, log: () => {} },
      { dryRun: false, only: FILE, showColumns: null, force: false }
    );

    expect(result.exitCode).toBe(0);
    expect(executed).toEqual(STATEMENTS);
    expect(executed[0]).toContain('CREATE TABLE IF NOT EXISTS "monthly_report_versions"');
    expect(recorded).toEqual([FILE]);
  });
});
