/**
 * #237: the drizzle schema, migration 0015 and the preflight column list agree.
 *
 * Why: criterion 5 — a timestamp column without `withTimezone: true` in the schema, or one
 *   the migration forgets, would leave the schema and the database disagreeing about a
 *   column's type. drizzle-kit is not used here (its snapshot is stale), so this test is
 *   the generator's replacement (same technique as metrics-history-migration-95.test.ts).
 * What: walks `getTableConfig()` over every pgTable exported by lib/db/schema.ts and
 *   lib/db/article-schema.ts and fails on any timestamp column that is not
 *   `timestamp with time zone`; holds the schema's timestamp columns equal to
 *   SCHEMA_TIMESTAMP_COLUMNS (the 42 of TIMESTAMPTZ_COLUMNS plus the 3 that later
 *   migrations create born timestamptz), and 0015's statements to TIMESTAMPTZ_COLUMNS; checks each
 *   statement is one guarded DO block using `AT TIME ZONE 'UTC'` and a lock_timeout.
 * Test: `npx vitest run tests/unit/timestamptz-237-schema.test.ts`. No database.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import * as articleSchema from "../../lib/db/article-schema";
import * as schema from "../../lib/db/schema";
import { splitStatements } from "../../scripts/apply-migrations";
import { TIMESTAMPTZ_COLUMNS, TIMESTAMPTZ_MIGRATION } from "../../scripts/migration-preflight";

const SQL_TEXT = readFileSync(path.resolve(__dirname, "../../lib/db/migrations", TIMESTAMPTZ_MIGRATION), "utf8");
const STATEMENTS = splitStatements(SQL_TEXT);

/**
 * Every timestamp column the schema declares, per table. #183: 0016 creates
 * tool_links.created_at/updated_at as timestamptz, so 0015 does not list them; a new
 * table with timestamps must be added here by name.
 */
const SCHEMA_TIMESTAMP_COLUMNS: Readonly<Record<string, readonly string[]>> = {
  ...TIMESTAMPTZ_COLUMNS,
  tool_links: ["created_at", "updated_at"],
  // #325: 0029 creates provider_usage_events.created_at as timestamptz.
  provider_usage_events: ["created_at"],
};

const TABLES: PgTable[] = [...Object.values(schema), ...Object.values(articleSchema)]
  .filter((value: unknown) => is(value, PgTable))
  .map((value) => value as unknown as PgTable);

function schemaTimestampColumns(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const table of TABLES) {
    const config = getTableConfig(table);
    const columns = config.columns.filter((c) => c.columnType === "PgTimestamp").map((c) => c.name);
    if (columns.length > 0) out[config.name] = columns;
  }
  return out;
}

describe("#237 schema and migration 0015 parity", () => {
  it("every timestamp column in both schema files is declared withTimezone", () => {
    const naive: string[] = [];
    for (const table of TABLES) {
      const config = getTableConfig(table);
      for (const column of config.columns) {
        if (column.columnType === "PgTimestamp" && column.getSQLType() !== "timestamp with time zone") {
          naive.push(`${config.name}.${column.name} (${column.getSQLType()})`);
        }
      }
    }
    expect(naive).toEqual([]);
  });

  it("the schema's timestamp columns are exactly the 45 listed: 0015's 42, tool_links' 2 (#183), provider_usage_events' 1 (#325)", () => {
    expect(schemaTimestampColumns()).toEqual(SCHEMA_TIMESTAMP_COLUMNS);
    expect(Object.values(SCHEMA_TIMESTAMP_COLUMNS).flat()).toHaveLength(45);
    expect(Object.keys(SCHEMA_TIMESTAMP_COLUMNS)).toHaveLength(16);
    expect(Object.values(TIMESTAMPTZ_COLUMNS).flat()).toHaveLength(42);
    expect(Object.keys(TIMESTAMPTZ_COLUMNS)).toHaveLength(14);
  });

  it("has one statement per table, in TIMESTAMPTZ_COLUMNS order, naming that table's columns", () => {
    const tables = Object.entries(TIMESTAMPTZ_COLUMNS);
    expect(STATEMENTS).toHaveLength(tables.length);
    tables.forEach(([table, columns], index) => {
      const statement = STATEMENTS[index] as string;
      expect(statement).toContain(`tbl constant text := '${table}';`);
      expect(statement).toContain(`cols constant text[] := ARRAY[${columns.map((c) => `'${c}'`).join(", ")}];`);
    });
  });

  it.each(STATEMENTS.map((s, i) => [i, s] as const))("statement %i is a guarded, lock-limited DO block", (_i, statement) => {
    const code = statement
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n")
      .trim();
    expect(code).toMatch(/^DO \$tz237\$[\s\S]*\$tz237\$;$/);
    expect(code).toContain("SET LOCAL lock_timeout = '5s';");
    expect(code).toContain("IF to_regclass(format('public.%I', tbl)) IS NULL THEN");
    expect(code).toContain("ELSIF kind = 'timestamp without time zone' THEN");
    expect(code).toContain("USING %I AT TIME ZONE ''UTC''");
    expect(code).not.toMatch(/::timestamptz/);
    expect(code).not.toMatch(/\b(DROP|DELETE|UPDATE|INSERT|TRUNCATE)\b/i);
  });
});

// #237 (critic LOW): a `Test:` pointer that names a missing file sends a reviewer nowhere.
describe("#237 test pointers in the migration scripts", () => {
  const ROOT = path.resolve(__dirname, "../..");
  it.each(["scripts/migration-preflight.ts", "scripts/apply-migrations.ts", "tests/unit/fixtures/timestamptz-237-fixture.ts"])(
    "every tests/ path named in %s exists",
    (file) => {
      const source = readFileSync(path.join(ROOT, file), "utf8");
      const named = [...new Set([...source.matchAll(/tests\/unit\/[\w./-]+\.(?:test\.tsx?|ts|mjs|sql)/g)].map((m) => m[0]))];
      expect(named.length).toBeGreaterThan(0);
      expect(named.filter((p) => !existsSync(path.join(ROOT, p)))).toEqual([]);
    }
  );
});
