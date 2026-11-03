/**
 * The --show-columns table snapshot of scripts/apply-migrations.ts: columns with their
 * nullability, and the table's indexes.
 *
 * Why: #361 — the snapshot printed name, type and default only, so after an apply it could
 * not confirm a NOT NULL constraint or an index; confirming the 0031 indexes took a separate
 * check. Kept out of apply-migrations.ts, which sits at the 500-line cap.
 * What: two read-only catalog queries (information_schema.columns, pg_catalog index
 * tables), strict row parsers that throw on a row shape they do not recognise, and the
 * formatter for the printed lines.
 * Test: `tests/unit/apply-migrations-table-snapshot-361.test.ts`
 */

export interface ColumnRow {
  column_name: string;
  data_type: string;
  column_default: string | null;
  /** #361: information_schema.columns.is_nullable, which is exactly 'YES' or 'NO'. */
  is_nullable: "YES" | "NO";
}

/** #361: one index of the table; `columns` lists key columns (or expressions) in order. */
export interface IndexRow {
  index_name: string;
  columns: string;
  is_unique: boolean;
}

/** Read-only: one row per column of public.$1, in table order. */
export const DESCRIBE_COLUMNS_SQL = `SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = $1
ORDER BY ordinal_position`;

/**
 * #361: read-only, one row per index of public.$1. pg_indexes (the view the issue names)
 * gives only the CREATE INDEX text; pg_index gives the unique flag directly, and
 * pg_get_indexdef(oid, k, true) names each key column, so no definition text is parsed.
 * INCLUDE columns (k > indnkeyatts) are not key columns and are left out.
 */
export const DESCRIBE_INDEXES_SQL = `SELECT i.relname AS index_name,
  ix.indisunique AS is_unique,
  array_to_string(ARRAY(
    SELECT pg_catalog.pg_get_indexdef(ix.indexrelid, k, true)
    FROM generate_series(1, ix.indnkeyatts) AS k
    ORDER BY k
  ), ', ') AS columns
FROM pg_catalog.pg_index ix
JOIN pg_catalog.pg_class t ON t.oid = ix.indrelid
JOIN pg_catalog.pg_class i ON i.oid = ix.indexrelid
JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public' AND t.relname = $1
ORDER BY i.relname`;

/** #361: throws on an unrecognised row so a driver or query change cannot print blanks. */
export function parseColumnRow(row: Record<string, unknown>): ColumnRow {
  const name = row["column_name"];
  const type = row["data_type"];
  const nullable = row["is_nullable"];
  if (typeof name !== "string" || typeof type !== "string" || (nullable !== "YES" && nullable !== "NO")) {
    throw new Error(`unexpected information_schema.columns row: ${JSON.stringify(row)}`);
  }
  const fallback = row["column_default"];
  return {
    column_name: name,
    data_type: type,
    column_default: fallback === null || fallback === undefined ? null : String(fallback),
    is_nullable: nullable,
  };
}

/** #361: throws on an unrecognised row, as parseColumnRow does. */
export function parseIndexRow(row: Record<string, unknown>): IndexRow {
  const name = row["index_name"];
  const columns = row["columns"];
  const unique = row["is_unique"];
  if (typeof name !== "string" || typeof columns !== "string" || typeof unique !== "boolean") {
    throw new Error(`unexpected pg_index row: ${JSON.stringify(row)}`);
  }
  return { index_name: name, columns, is_unique: unique };
}

/**
 * #361: the printed snapshot of one table, under the caller's heading.
 *
 * What: `name, type, default, NOT NULL|nullable` per column, then an `Indexes of <table>:`
 * block with `name (columns), unique|not unique` per index. No columns means the table does
 * not exist, so the index block is replaced by that note rather than a misleading "(none)".
 * Test: `tests/unit/apply-migrations-table-snapshot-361.test.ts`
 */
export function formatTableSnapshot(table: string, columns: ColumnRow[], indexes: IndexRow[]): string[] {
  if (columns.length === 0) {
    return [`  (no columns found for ${table} — does the table exist?)`];
  }
  const lines = columns.map(
    (row) =>
      `  ${row.column_name}, ${row.data_type}, ${row.column_default ?? "NULL"}, ${row.is_nullable === "NO" ? "NOT NULL" : "nullable"}`
  );
  lines.push(`Indexes of ${table}:`);
  if (indexes.length === 0) {
    lines.push("  (no indexes)");
  }
  for (const index of indexes) {
    lines.push(`  ${index.index_name} (${index.columns}), ${index.is_unique ? "unique" : "not unique"}`);
  }
  return lines;
}
