/**
 * #361: the --show-columns snapshot prints each column's nullability and the table's indexes.
 *
 * Why: after an apply the snapshot could not confirm a NOT NULL constraint or an index.
 * What: the formatter against mocked rows (nullable, NOT NULL, unique, non-unique, none,
 *   missing table); the runner's failure paths (a catalog query error, a table missing after
 *   an apply); and the two catalog queries against PGlite inside a READ ONLY transaction.
 */

import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type MigrationDb, runMigrations } from "../../scripts/apply-migrations";
import {
  type ColumnRow,
  DESCRIBE_COLUMNS_SQL,
  DESCRIBE_INDEXES_SQL,
  formatTableSnapshot,
  type IndexRow,
  parseColumnRow,
  parseIndexRow,
} from "../../scripts/migration-table-snapshot";

const COLUMNS: ColumnRow[] = [
  { column_name: "id", data_type: "uuid", column_default: "gen_random_uuid()", is_nullable: "NO" },
  { column_name: "slug", data_type: "text", column_default: null, is_nullable: "NO" },
  { column_name: "notes", data_type: "text", column_default: null, is_nullable: "YES" },
];

const INDEXES: IndexRow[] = [
  { index_name: "tools_pkey", columns: "id", is_unique: true },
  { index_name: "tools_slug_kind_idx", columns: "slug, kind", is_unique: false },
];

describe("formatTableSnapshot", () => {
  it("prints nullability per column and each index with its columns and uniqueness", () => {
    expect(formatTableSnapshot("tools", COLUMNS, INDEXES)).toEqual([
      "  id, uuid, gen_random_uuid(), NOT NULL",
      "  slug, text, NULL, NOT NULL",
      "  notes, text, NULL, nullable",
      "Indexes of tools:",
      "  tools_pkey (id), unique",
      "  tools_slug_kind_idx (slug, kind), not unique",
    ]);
  });

  it("says so when an existing table has no indexes", () => {
    expect(formatTableSnapshot("tools", COLUMNS.slice(0, 1), [])).toEqual([
      "  id, uuid, gen_random_uuid(), NOT NULL",
      "Indexes of tools:",
      "  (no indexes)",
    ]);
  });

  it("reports a missing table instead of an empty index list", () => {
    expect(formatTableSnapshot("nope", [], [])).toEqual(["  (no columns found for nope — does the table exist?)"]);
  });
});

describe("row parsers", () => {
  it("throw on a row whose shape they do not recognise rather than print blanks", () => {
    expect(() => parseColumnRow({ column_name: "id", data_type: "uuid", column_default: null })).toThrow(
      /unexpected information_schema\.columns row/
    );
    expect(() => parseIndexRow({ index_name: "x", columns: "id", is_unique: "t" })).toThrow(/unexpected pg_index row/);
  });
});

function fakeDb(overrides: Partial<MigrationDb> = {}): MigrationDb & { writes: string[] } {
  const writes: string[] = [];
  return {
    writes,
    trackingTableExists: async () => true,
    createTrackingTable: async () => void writes.push("createTrackingTable"),
    listAppliedFilenames: async () => [],
    executeStatement: async (statement) => void writes.push(statement),
    recordApplied: async (file) => void writes.push(`record ${file}`),
    describeColumns: async () => COLUMNS,
    describeIndexes: async () => INDEXES,
    ...overrides,
  };
}

const FILES = { list: () => ["0099_add_x.sql"], read: () => "ALTER TABLE tools ADD COLUMN x integer;" };

describe("runMigrations --show-columns (#361)", () => {
  it("prints nullability and indexes in a dry run without writing", async () => {
    const db = fakeDb();
    const result = await runMigrations(
      { db, files: FILES, log: () => {} },
      { dryRun: true, only: null, showColumns: "tools", force: false }
    );
    expect(result.exitCode).toBe(0);
    expect(db.writes).toEqual([]);
    const output = result.lines.join("\n");
    expect(output).toContain("  notes, text, NULL, nullable");
    expect(output).toContain("  tools_pkey (id), unique");
  });

  it("prints indexes before and after an apply", async () => {
    const result = await runMigrations(
      { db: fakeDb(), files: FILES, log: () => {} },
      { dryRun: false, only: "0099_add_x.sql", showColumns: "tools", force: false }
    );
    expect(result.exitCode).toBe(0);
    expect(result.lines.filter((line) => line === "Indexes of tools:")).toHaveLength(2);
  });

  it("fails the run and applies nothing when the index query errors", async () => {
    const db = fakeDb({
      describeIndexes: async () => {
        throw new Error("permission denied for pg_index");
      },
    });
    await expect(
      runMigrations(
        { db, files: FILES, log: () => {} },
        { dryRun: false, only: "0099_add_x.sql", showColumns: "tools", force: false }
      )
    ).rejects.toThrow("permission denied for pg_index");
    expect(db.writes).toEqual([]);
  });

  it("exits non-zero when the table has no columns after an apply", async () => {
    const result = await runMigrations(
      { db: fakeDb({ describeColumns: async () => [] }), files: FILES, log: () => {} },
      { dryRun: false, only: "0099_add_x.sql", showColumns: "toolz", force: false }
    );
    expect(result.exitCode).toBe(1);
    expect(result.appliedNow).toEqual(["0099_add_x.sql"]);
    expect(result.lines.join("\n")).toContain("ERROR: applied 0099_add_x.sql, but toolz has no columns afterwards");
    expect(result.lines.join("\n")).not.toContain("Done — applied");
  });

  it("keeps a dry run green when the table does not exist yet", async () => {
    const result = await runMigrations(
      { db: fakeDb({ describeColumns: async () => [], describeIndexes: async () => [] }), files: FILES, log: () => {} },
      { dryRun: true, only: null, showColumns: "new_table", force: false }
    );
    expect(result.exitCode).toBe(0);
    expect(result.lines.join("\n")).toContain("(no columns found for new_table — does the table exist?)");
  });
});

describe("catalog queries against PGlite (#361)", () => {
  let pg: PGlite;

  beforeAll(async () => {
    pg = new PGlite();
    await pg.exec(`
      CREATE TABLE tools (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        slug text NOT NULL,
        kind text,
        notes text
      );
      CREATE UNIQUE INDEX tools_slug_key ON tools (slug);
      CREATE INDEX tools_kind_slug_idx ON tools (kind, slug) INCLUDE (notes);
      CREATE INDEX tools_lower_slug_idx ON tools (lower(slug));
    `);
  });

  afterAll(async () => {
    await pg.close();
  });

  async function readOnly(text: string, table: string): Promise<Record<string, unknown>[]> {
    return pg.transaction(async (tx) => {
      await tx.exec("SET TRANSACTION READ ONLY");
      return (await tx.query<Record<string, unknown>>(text, [table])).rows;
    });
  }

  it("reads columns with nullability and indexes with key columns and uniqueness", async () => {
    const columns = (await readOnly(DESCRIBE_COLUMNS_SQL, "tools")).map(parseColumnRow);
    const indexes = (await readOnly(DESCRIBE_INDEXES_SQL, "tools")).map(parseIndexRow);
    expect(formatTableSnapshot("tools", columns, indexes)).toEqual([
      "  id, uuid, gen_random_uuid(), NOT NULL",
      "  slug, text, NULL, NOT NULL",
      "  kind, text, NULL, nullable",
      "  notes, text, NULL, nullable",
      "Indexes of tools:",
      "  tools_kind_slug_idx (kind, slug), not unique",
      "  tools_lower_slug_idx (lower(slug)), not unique",
      "  tools_pkey (id), unique",
      "  tools_slug_key (slug), unique",
    ]);
  });

  it("returns no rows for a table that does not exist", async () => {
    expect(await readOnly(DESCRIBE_COLUMNS_SQL, "missing")).toEqual([]);
    expect(await readOnly(DESCRIBE_INDEXES_SQL, "missing")).toEqual([]);
  });
});
