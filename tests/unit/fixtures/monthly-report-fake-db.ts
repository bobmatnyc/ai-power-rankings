/**
 * An in-memory stand-in for the drizzle client, for the monthly report tests (#182).
 *
 * Why: the merged generator reads two tables (`monthly_report_versions`, then
 *   the read-only `monthly_summaries`) and writes only the first. The tests
 *   must see every write, including one aimed at a read-only table, to prove
 *   that none happens.
 * What: `createFakeDb(state)` answers `select().from().where().orderBy().limit()`
 *   chains over `state.tables`, keyed by SQL table name, and `insert().values()
 *   .returning()` into the same. Every insert, upsert, update or delete is
 *   appended to `state.writes`; an upsert, update or delete always throws, and
 *   a duplicate `(period, version)` insert into `monthly_report_versions`
 *   throws like the unique index would. The caller must mock drizzle-orm's
 *   `eq` and `desc` as `fakeEq` and `fakeDesc` below.
 * Test: used by `tests/unit/whats-new-auto-regenerate.test.ts` and
 *   `tests/unit/monthly-report-182.test.ts`.
 */

import type { Table } from "drizzle-orm";

// The tests that use this fixture mock "drizzle-orm" with a factory that
// imports this file, so it reads drizzle's table symbols instead of importing
// `getTableName` / `getTableColumns` (a runtime import would never resolve).
const TABLE_NAME = Symbol.for("drizzle:Name");
const TABLE_COLUMNS = Symbol.for("drizzle:Columns");

function getTableName(table: Table): string {
  return (table as unknown as Record<symbol, string>)[TABLE_NAME]!;
}

function getTableColumns(table: Table): Record<string, { name: string }> {
  return (table as unknown as Record<symbol, Record<string, { name: string }>>)[TABLE_COLUMNS]!;
}

export type FakeRow = Record<string, unknown>;

export interface FakeDbState {
  tables: Record<string, FakeRow[]>;
  writes: Array<{ op: "insert" | "upsert" | "update" | "delete"; table: string }>;
  failInsert: boolean;
}

interface EqCondition {
  eq: string;
  value: unknown;
}
interface DescOrder {
  desc: string;
}

/** Replacement for drizzle-orm `eq`: keeps the SQL column name and the value. */
export const fakeEq = (column: { name: string }, value: unknown): EqCondition => ({ eq: column.name, value });
/** Replacement for drizzle-orm `desc`: keeps the SQL column name. */
export const fakeDesc = (column: { name: string }): DescOrder => ({ desc: column.name });

/** Maps a table's SQL column names to the row keys drizzle returns. */
function columnKeys(table: Table): Map<string, string> {
  const keys = new Map<string, string>();
  for (const [key, column] of Object.entries(getTableColumns(table))) {
    keys.set(column.name, key);
  }
  return keys;
}

function compare(a: unknown, b: unknown): number {
  const left = a instanceof Date ? a.getTime() : (a as number | string);
  const right = b instanceof Date ? b.getTime() : (b as number | string);
  return left < right ? -1 : left > right ? 1 : 0;
}

export function createFakeDb(state: FakeDbState) {
  return {
    select(fields?: Record<string, { name: string }>) {
      return {
        from(table: Table) {
          const name = getTableName(table);
          const keys = columnKeys(table);
          const conditions: EqCondition[] = [];
          let orders: DescOrder[] = [];
          let limit: number | undefined;

          const run = (): FakeRow[] => {
            let rows = [...(state.tables[name] ?? [])];
            for (const { eq, value } of conditions) {
              const key = keys.get(eq)!;
              rows = rows.filter((row) => row[key] === value);
            }
            for (const order of [...orders].reverse()) {
              const key = keys.get(order.desc)!;
              rows.sort((a, b) => compare(b[key], a[key]));
            }
            if (limit !== undefined) rows = rows.slice(0, limit);
            if (!fields) return rows.map((row) => ({ ...row }));
            return rows.map((row) =>
              Object.fromEntries(
                Object.entries(fields).map(([alias, column]) => [alias, row[keys.get(column.name)!]])
              )
            );
          };

          const query = {
            where(condition: EqCondition) {
              conditions.push(condition);
              return query;
            },
            orderBy(...order: DescOrder[]) {
              orders = order;
              return query;
            },
            limit(n: number) {
              limit = n;
              return query;
            },
            then<T>(resolve: (rows: FakeRow[]) => T, reject?: (error: unknown) => T) {
              return Promise.resolve().then(run).then(resolve, reject);
            },
          };
          return query;
        },
      };
    },

    insert(table: Table) {
      const name = getTableName(table);
      return {
        values(values: FakeRow) {
          return {
            async returning() {
              state.writes.push({ op: "insert", table: name });
              if (state.failInsert) throw new Error("database write failed");
              const rows = (state.tables[name] ??= []);
              if (
                name === "monthly_report_versions" &&
                rows.some((row) => row.period === values.period && row.version === values.version)
              ) {
                throw new Error("duplicate key value violates unique constraint");
              }
              const now = new Date();
              const row = {
                id: `id-${name}-${rows.length + 1}`,
                createdAt: now,
                generatedAt: now,
                metadata: {},
                ...values,
              };
              rows.push(row);
              return [{ ...row }];
            },
            onConflictDoUpdate() {
              return {
                async returning() {
                  state.writes.push({ op: "upsert", table: name });
                  throw new Error(`fake db: upsert into ${name}`);
                },
              };
            },
          };
        },
      };
    },

    update(table: Table) {
      state.writes.push({ op: "update", table: getTableName(table) });
      throw new Error(`fake db: update of ${getTableName(table)}`);
    },

    delete(table: Table) {
      state.writes.push({ op: "delete", table: getTableName(table) });
      throw new Error(`fake db: delete from ${getTableName(table)}`);
    },
  };
}
