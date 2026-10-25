/**
 * In-memory stand-in for the Drizzle client, for #93 persistence tests.
 *
 * Why: #93 must show that the admin draft write never demotes or changes the
 *   current `rankings` row, and that the publish write is unchanged. The rule
 *   lives in the SQL the adapter sends, so the fake applies that SQL to rows.
 * What: supports the calls `createDbPersistence()` and `RankingsRepository`
 *   make (`select().from().where()[.limit()|.orderBy()]`, `insert().values()`,
 *   `update().set().where()`, `delete().where()`, `transaction()`). Conditions
 *   are rendered with Drizzle's Postgres dialect and evaluated for the
 *   `col = $n [and …]` shapes those callers use; any other shape throws. Every
 *   write is logged in `writes`. A throw inside `transaction()` restores the rows.
 * Test: used by `lib/services/ranking-db-persistence.test.ts` and
 *   `tests/unit/admin-rankings-build-93.test.ts`.
 */

import { getTableName, type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

const dialect = new PgDialect();

export interface FakeRankingRow {
  id: string;
  period: string;
  /** #186: absent means 'combined', the column default. */
  list?: string;
  algorithmVersion: string;
  isCurrent: boolean;
  publishedAt: Date | null;
  data: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface FakeToolRow {
  id: string;
  name: string;
  slug: string;
  category: string;
  status: string;
  data: Record<string, unknown>;
  /** #186: `tools.kind`, read by the per-list layout. */
  kind?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FakeWrite {
  op: "insert" | "update" | "delete";
  table: string;
  where?: string;
  params?: unknown[];
  values?: Record<string, unknown>;
}

const COLUMN_TO_FIELD: Record<string, string> = {
  period: "period",
  is_current: "isCurrent",
  status: "status",
  id: "id",
  list: "list",
};

/** #186: a row's value for `field`, with the column default for an absent `list`. */
function fieldValue(row: Record<string, unknown>, field: string): unknown {
  return field === "list" ? (row["list"] ?? "combined") : row[field];
}

/** Turn `("t"."a" = $1 and "t"."b" = $2)` into a row predicate. */
function predicate(condition: SQL | undefined): {
  test: (row: Record<string, unknown>) => boolean;
  text?: string;
  params?: unknown[];
} {
  if (!condition) return { test: () => true };
  const { sql, params } = dialect.sqlToQuery(condition);
  const clauses = sql.replace(/^\(|\)$/g, "").split(" and ");
  const checks = clauses.map((clause) => {
    const match = /^"[a-z_]+"\."([a-z_]+)" = \$(\d+)$/.exec(clause.trim());
    const field = match ? COLUMN_TO_FIELD[match[1]!] : undefined;
    if (!match || !field) throw new Error(`fake-rankings-db: unsupported condition ${sql}`);
    const value = params[Number(match[2]) - 1];
    return (row: Record<string, unknown>) => fieldValue(row, field) === value;
  });
  return { test: (row) => checks.every((check) => check(row)), text: sql, params };
}

export function createFakeRankingsDb(seed: { rankings?: FakeRankingRow[]; tools?: FakeToolRow[] } = {}) {
  const state = {
    rankings: [...(seed.rankings ?? [])],
    tools: [...(seed.tools ?? [])],
    writes: [] as FakeWrite[],
  };
  let nextId = 1;

  const rowsOf = (table: unknown): Array<Record<string, unknown>> => {
    const name = getTableName(table as never);
    if (name === "rankings") return state.rankings as unknown as Array<Record<string, unknown>>;
    if (name === "tools") return state.tools as unknown as Array<Record<string, unknown>>;
    throw new Error(`fake-rankings-db: unsupported table ${name}`);
  };

  // A query result that can be awaited directly or narrowed by limit/orderBy.
  const result = (rows: Array<Record<string, unknown>>) => {
    const copy = rows.map((row) => ({ ...row }));
    return Object.assign(Promise.resolve(copy), {
      limit: async (n: number) => copy.slice(0, n),
      orderBy: async () => copy,
    });
  };

  const client = {
    select: () => ({
      from: (table: unknown) => ({
        where: (condition?: SQL) => result(rowsOf(table).filter(predicate(condition).test)),
        orderBy: async () => rowsOf(table).map((row) => ({ ...row })),
      }),
    }),
    insert: (table: unknown) => ({
      values: (values: Record<string, unknown>) => {
        const now = new Date("2026-01-01T00:00:00Z");
        const row: Record<string, unknown> = { id: `row-${nextId++}`, createdAt: now, updatedAt: now, publishedAt: null, ...values };
        // #186: rankings are unique per (period, list).
        if (
          rowsOf(table).some(
            (existing) =>
              existing["period"] === row["period"] && fieldValue(existing, "list") === fieldValue(row, "list")
          )
        ) {
          throw new Error("fake-rankings-db: duplicate key value violates rankings_period_list_idx");
        }
        rowsOf(table).push(row);
        state.writes.push({ op: "insert", table: getTableName(table as never), values });
        return Object.assign(Promise.resolve(), { returning: async () => [{ ...row }] });
      },
    }),
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => {
        const apply = (condition?: SQL) => {
          const where = predicate(condition);
          const touched = rowsOf(table).filter(where.test);
          for (const row of touched) Object.assign(row, values);
          state.writes.push({
            op: "update",
            table: getTableName(table as never),
            values,
            ...(where.text ? { where: where.text, params: where.params } : {}),
          });
          return touched;
        };
        // Lazy: an unconditioned update runs only when awaited, never as well as `.where()`.
        return {
          then: (resolve: (value: undefined) => void, reject: (reason: unknown) => void) => {
            try {
              apply();
              resolve(undefined);
            } catch (error) {
              reject(error);
            }
          },
          where: (condition: SQL) => {
            const touched = apply(condition);
            return Object.assign(Promise.resolve(), { returning: async () => touched.map((r) => ({ ...r })) });
          },
        };
      },
    }),
    delete: (table: unknown) => ({
      where: async (condition: SQL) => {
        const where = predicate(condition);
        const rows = rowsOf(table);
        for (let i = rows.length - 1; i >= 0; i--) {
          if (where.test(rows[i]!)) rows.splice(i, 1);
        }
        state.writes.push({ op: "delete", table: getTableName(table as never), where: where.text, params: where.params });
      },
    }),
    transaction: async <T>(fn: (tx: never) => Promise<T>): Promise<T> => {
      const snapshot = state.rankings.map((row) => ({ ...row }));
      const writeCount = state.writes.length;
      try {
        return await fn(client as never);
      } catch (error) {
        state.rankings = snapshot;
        state.writes.length = writeCount;
        throw error;
      }
    },
  };

  return { client, state };
}

/** A stored ranking row with defaults. */
export function rankingRow(partial: Partial<FakeRankingRow> & { period: string }): FakeRankingRow {
  const stamp = new Date("2026-01-01T00:00:00Z");
  return {
    id: `seed-${partial.period}`,
    algorithmVersion: "7.9",
    isCurrent: false,
    publishedAt: null,
    data: [],
    createdAt: stamp,
    updatedAt: stamp,
    ...partial,
  };
}
