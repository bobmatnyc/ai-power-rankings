/**
 * #183: migration 0016 matches the drizzle schema, is additive and guarded, and applies
 * through the existing apply-migration runner.
 *
 * Why: plan criterion 8 — the schema, `getTableConfig()` and the SQL must agree on every
 *   new column name, type, nullability, index and CHECK, or the app selects a column the
 *   database lacks. drizzle-kit is not used here (stale snapshot), so this test is its
 *   replacement (same technique as metrics-history-migration-95.test.ts).
 * What: parses the ADD COLUMN list and the tool_links CREATE TABLE and compares them with
 *   the drizzle tables; checks every drizzle index and CHECK is created by the file with
 *   the same columns, uniqueness, predicate and text; checks every statement is guarded
 *   and the file holds no DROP, type change or row write; runs `runMigrations()` with
 *   `--only` against an in-memory double.
 * Test: `npx vitest run tests/unit/tool-kind-links-migration-183.test.ts`. No database.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { getTableConfig, type PgTable } from "drizzle-orm/pg-core";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { toolLinks, tools } from "../../lib/db/schema";
import { type MigrationDb, runMigrations, splitStatements } from "../../scripts/apply-migrations";

const FILE = "0016_add_tool_kind_and_links.sql";
const SQL_TEXT = readFileSync(path.resolve(__dirname, "../../lib/db/migrations", FILE), "utf8");
const STATEMENTS = splitStatements(SQL_TEXT);
const NEW_TOOLS_COLUMNS = [
  "kind",
  "subcategory",
  "open_weight",
  "licence",
  "parameters_b",
  "active_parameters_b",
  "context_window",
  "price_in_per_mtok",
  "price_out_per_mtok",
  "release_date",
  "hf_repo",
];

interface ParsedColumn {
  name: string;
  type: string;
  notNull: boolean;
}

function code(statement: string): string {
  return statement
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .trim();
}

function parseColumnLine(line: string): ParsedColumn {
  const match = /"([a-z_]+)" ([a-z]+)/.exec(line);
  return { name: match?.[1] ?? "", type: match?.[2] ?? "", notNull: /NOT NULL|PRIMARY KEY/.test(line) };
}

/** The `ADD COLUMN IF NOT EXISTS` lines of the tools ALTER. */
function addedToolsColumns(): ParsedColumn[] {
  return SQL_TEXT.split("\n")
    .filter((line) => line.includes("ADD COLUMN IF NOT EXISTS"))
    .map((line) => parseColumnLine(line.replace("ADD COLUMN IF NOT EXISTS", "")));
}

function toolLinksCreateColumns(): ParsedColumn[] {
  const statement = STATEMENTS.find((s) => s.includes('CREATE TABLE IF NOT EXISTS "tool_links"')) as string;
  expect(statement).toBeDefined();
  return statement
    .slice(statement.indexOf("(") + 1, statement.lastIndexOf(")"))
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith('"'))
    .map(parseColumnLine);
}

// The file spells `timestamptz`; getSQLType() spells the long form.
const SQL_TYPE_ALIAS: Record<string, string> = { "timestamp with time zone": "timestamptz" };

function schemaColumns(table: PgTable, only?: string[]): ParsedColumn[] {
  return getTableConfig(table)
    .columns.filter((c) => !only || only.includes(c.name))
    .map((c) => ({ name: c.name, type: SQL_TYPE_ALIAS[c.getSQLType()] ?? c.getSQLType(), notNull: c.notNull }));
}

const byName = (cols: ParsedColumn[]) => [...cols].sort((a, b) => a.name.localeCompare(b.name));
const dialect = new PgDialect();

describe("#183 migration 0016 parity with the drizzle schema", () => {
  it("adds exactly the eleven tools columns, with the schema's types and nullability", () => {
    expect(byName(addedToolsColumns())).toEqual(byName(schemaColumns(tools, NEW_TOOLS_COLUMNS)));
    expect(addedToolsColumns().map((c) => c.name)).toEqual(NEW_TOOLS_COLUMNS);
    expect(SQL_TEXT).toContain(`ADD COLUMN IF NOT EXISTS "kind" text DEFAULT 'harness' NOT NULL`);
    expect(getTableConfig(tools).columns.find((c) => c.name === "kind")?.default).toBe("harness");
  });

  it("adds no vendor_company_id column: the vendor is tools.company_id", () => {
    expect(SQL_TEXT).not.toContain("vendor_company_id");
    expect(getTableConfig(tools).columns.map((c) => c.name)).not.toContain("vendor_company_id");
  });

  it("creates tool_links with the schema's columns", () => {
    expect(getTableConfig(toolLinks).name).toBe("tool_links");
    expect(byName(toolLinksCreateColumns())).toEqual(byName(schemaColumns(toolLinks)));
  });

  it("references tools(id) ON DELETE CASCADE from both link columns", () => {
    for (const column of ["model_tool_id", "harness_tool_id"]) {
      expect(SQL_TEXT).toContain(`"${column}" uuid NOT NULL REFERENCES "tools"("id") ON DELETE CASCADE`);
    }
    const fks = getTableConfig(toolLinks).foreignKeys.map((fk) => fk.reference());
    expect(fks.map((fk) => [fk.columns[0]?.name, fk.foreignColumns[0]?.name, getTableConfig(fk.foreignTable).name])).toEqual([
      ["model_tool_id", "id", "tools"],
      ["harness_tool_id", "id", "tools"],
    ]);
    expect(getTableConfig(toolLinks).foreignKeys.map((fk) => fk.onDelete)).toEqual(["cascade", "cascade"]);
  });

  it.each([
    ["tools", tools, ["tools_kind_idx", "tools_kind_subcategory_idx", "tools_open_weight_idx"]],
    ["tool_links", toolLinks, ["tool_links_model_harness_idx", "tool_links_harness_idx"]],
  ] as const)("creates every new %s index with the schema's columns, uniqueness and predicate", (table, pg, names) => {
    for (const name of names) {
      const index = getTableConfig(pg).indexes.find((i) => i.config.name === name);
      expect(index, `drizzle index ${name}`).toBeDefined();
      const { unique, columns, where } = index!.config;
      const cols = columns.map((c) => `"${(c as { name: string }).name}"`).join(", ");
      const predicate = where ? ` WHERE ${dialect.sqlToQuery(where).sql}` : "";
      const expected = `CREATE ${unique ? "UNIQUE " : ""}INDEX IF NOT EXISTS "${name}"\nON "${table}" (${cols})${predicate};`;
      expect(STATEMENTS.map(code)).toContain(expected);
    }
  });

  it.each([
    ["tools", tools, 3],
    ["tool_links", toolLinks, 2],
  ] as const)("adds every %s CHECK with the schema's text, guarded by name", (table, pg, count) => {
    const checks = getTableConfig(pg).checks;
    expect(checks).toHaveLength(count);
    for (const check of checks) {
      const statement = STATEMENTS.find((s) => s.includes(`ADD CONSTRAINT "${check.name}"`));
      expect(statement, `constraint ${check.name}`).toBeDefined();
      expect(statement).toContain(`CHECK (${dialect.sqlToQuery(check.value).sql});`);
      expect(statement).toContain(`WHERE conname = '${check.name}' AND conrelid = 'public.${table}'::regclass`);
    }
  });

  it("has no trigger: the tool_links kind rule is a writer check plus a test query (Q-A5)", () => {
    expect(code(SQL_TEXT)).not.toMatch(/\b(TRIGGER|FUNCTION)\b/i);
  });
});

describe("#183 migration 0016 is additive and guarded", () => {
  it("has twelve statements, each guarded so a re-run is a no-op", () => {
    expect(STATEMENTS).toHaveLength(12);
    for (const statement of STATEMENTS) {
      const body = code(statement);
      if (body.startsWith("DO ")) {
        expect(body).toMatch(/^DO \$k183\$\nBEGIN\n {2}SET LOCAL lock_timeout = '5s';[\s\S]*\nEND\n\$k183\$;$/);
        const isAddColumn = body.includes("ADD COLUMN");
        if (isAddColumn) expect(body.match(/ADD COLUMN/g)).toHaveLength(body.match(/ADD COLUMN IF NOT EXISTS/g)?.length ?? -1);
        else expect(body).toContain("IF NOT EXISTS (\n    SELECT 1 FROM pg_constraint");
      } else {
        expect(body).toMatch(/^CREATE (UNIQUE )?(TABLE|INDEX) IF NOT EXISTS /);
        // One statement per chunk: neon-http runs a single statement per call.
        expect(body.replace(/;\s*$/, "")).not.toContain(";");
      }
    }
  });

  it("holds no DROP, type change or row write", () => {
    const body = code(SQL_TEXT).replace(/ON DELETE CASCADE/g, "");
    expect(body).not.toMatch(/\b(DROP|UPDATE|DELETE|INSERT|TRUNCATE|RENAME)\b/i);
    expect(body).not.toMatch(/ALTER COLUMN|\bTYPE\b|USING/i);
  });

  it("applies through scripts/apply-migrations.ts --only, executing all twelve statements, needing no preflight", async () => {
    const executed: string[] = [];
    const recorded: string[] = [];
    const db: MigrationDb = {
      trackingTableExists: async () => true,
      createTrackingTable: async () => {},
      listAppliedFilenames: async () => ["0014_add_tool_metrics_history.sql", "0015_timestamptz_utc.sql"],
      executeStatement: async (statement) => void executed.push(statement),
      recordApplied: async (file) => void recorded.push(file),
      describeColumns: async () => [],
    };
    const files = {
      list: () => ["0014_add_tool_metrics_history.sql", "0015_timestamptz_utc.sql", FILE],
      read: () => SQL_TEXT,
    };
    const result = await runMigrations({ db, files, log: () => {} }, { dryRun: false, only: FILE, showColumns: null, force: false });
    expect(result.exitCode).toBe(0);
    expect(executed).toEqual(STATEMENTS);
    expect(recorded).toEqual([FILE]);
  });
});
