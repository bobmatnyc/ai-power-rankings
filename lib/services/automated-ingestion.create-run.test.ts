import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression tests for #134 — createRun() against a database that is behind the
 * Drizzle schema.
 *
 * Why: The production cron returned HTTP 200 on 2026-09-05 and 2026-09-06 while
 * logging `column "articles_skipped_stale" of relation
 * "automated_ingestion_runs" does not exist`, and wrote no row to
 * automated_ingestion_runs at all. #133 added articles_skipped_stale and
 * candidate_outcomes to the schema; migration 0013 that adds them to the
 * database is applied by hand and had not been run. updateRun() already retries
 * without those two columns, but createRun runs first, so the run died before
 * its row existed. The earlier review of #133 read createRun's `.values()`,
 * saw neither new column, and concluded it was safe — but Drizzle's insert
 * builder names EVERY column of the table (passing `default` for the omitted
 * ones) and a bare `.returning()` lists them all a second time, so both halves
 * of the statement referenced columns the database did not have.
 *
 * What: `getDb()` is replaced by a simulated Postgres that rejects a
 * configurable set of columns with a real 42703 error. Statement text is not
 * hand-written: `insert` delegates to a real Drizzle query builder (pg-proxy,
 * which needs no connection) and `execute` renders its SQL object through the
 * real PgDialect, so what the simulator inspects is the SQL Drizzle actually
 * generates. Pre-fix createRun reaches the simulator through `insert`, post-fix
 * through `execute`; either way the statement is real.
 *
 * Test: `npx vitest run lib/services/automated-ingestion.create-run.test.ts`.
 * Stash the fix (`git stash`) and re-run: the first three tests fail, the first
 * two with the same 42703 production saw. An implementation that catches 42703
 * and returns an id without inserting also fails — every passing assertion
 * compares against the id the simulated database handed back.
 */

const { fixture, RUN_ID } = vi.hoisted(() => {
  const runId = "11111111-2222-4333-8444-555555555555";

  const state = {
    /** Columns the simulated database does not have (migration not applied). */
    missingColumns: [] as string[],
    /** Every statement the simulated database was asked to run, in order. */
    statements: [] as string[],
    /** When set, thrown for every statement instead of a 42703. */
    failWith: null as unknown,
  };

  /** Runs one statement against the simulated database. */
  function run(statement: string): Array<Record<string, unknown>> {
    state.statements.push(statement);
    if (state.failWith !== null) throw state.failWith;

    const missing = state.missingColumns.find((column) =>
      new RegExp(`\\b${column}\\b`).test(statement)
    );
    if (missing) {
      const error = new Error(
        `column "${missing}" of relation "automated_ingestion_runs" does not exist`
      ) as Error & { code: string };
      error.code = "42703";
      throw error;
    }

    return [{ id: runId }];
  }

  function reset(): void {
    state.missingColumns = [];
    state.statements = [];
    state.failWith = null;
  }

  return { fixture: { state, run, reset }, RUN_ID: runId };
});

// Relative path — tsconfig excludes *.test.ts from `include`, so the "@/..."
// alias never resolves inside this file itself; see
// automated-ingestion.updateRun.test.ts for the full explanation.
vi.mock("../db/connection", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const { PgDialect } = await import("drizzle-orm/pg-core");
  const dialect = new PgDialect();

  // A real Drizzle instance whose driver is the simulated database above. Only
  // pre-#134 createRun uses this path (db.insert(...).values(...).returning()),
  // and it is here so that path generates its real statement rather than one
  // this fixture invents.
  const builder = drizzle(async (statement) => ({
    rows: fixture.run(statement).map((row) => [row["id"]]),
  }));

  return {
    getDb: () => ({
      insert: (table: Parameters<typeof builder.insert>[0]) => builder.insert(table),
      // neon-http and neon-serverless both resolve execute() to an object with a
      // `rows` array of column-keyed objects. pg-proxy returns bare value arrays
      // instead, so the production shape is restored here rather than borrowed
      // from the proxy driver.
      execute: async (query: Parameters<PgDialect["sqlToQuery"]>[0]) => ({
        rows: fixture.run(dialect.sqlToQuery(query).sql),
      }),
    }),
  };
});

import {
  AutomatedIngestionService,
  isUndefinedColumnError,
  isUndefinedNewRunColumnError,
} from "./automated-ingestion.service";

/** The two columns migration 0013 adds, which production had not applied. */
const MIGRATION_0013_COLUMNS = ["articles_skipped_stale", "candidate_outcomes"];

describe("createRun against a database behind the schema (#134)", () => {
  beforeEach(() => {
    fixture.reset();
    vi.clearAllMocks();
  });

  it("creates the run row when migration 0013 has not been applied", async () => {
    fixture.state.missingColumns = [...MIGRATION_0013_COLUMNS];

    const runId = await new AutomatedIngestionService().createRun("daily_news");

    // The id must come from the database, not from a catch block inventing one.
    expect(runId).toBe(RUN_ID);
    // One statement, no retry: the insert never named a missing column.
    expect(fixture.state.statements).toHaveLength(1);
  });

  it("names neither migration-0013 column anywhere in the statement", async () => {
    await new AutomatedIngestionService().createRun("daily_news");

    const [statement] = fixture.state.statements;
    expect(statement).toBeDefined();
    for (const column of MIGRATION_0013_COLUMNS) {
      // Both halves matter: pre-fix the column appeared in the INSERT target
      // list (as `default`) AND again in the bare RETURNING.
      expect(statement).not.toContain(column);
    }
    // The row still carries the create-time values it always did.
    expect(statement).toContain("articles_skipped_semantic");
    expect(statement).toContain('returning "id"');
  });

  it("retries on the base column set when an older column is also missing", async () => {
    fixture.state.missingColumns = [...MIGRATION_0013_COLUMNS, "articles_skipped_semantic"];

    const runId = await new AutomatedIngestionService().createRun("manual");

    expect(runId).toBe(RUN_ID);
    expect(fixture.state.statements).toHaveLength(2);
    const retry = fixture.state.statements[1] as string;
    expect(retry).toContain('"run_type"');
    expect(retry).toContain('"status"');
    expect(retry).toContain('"started_at"');
    expect(retry).not.toContain("articles_skipped_semantic");
  });

  it("propagates an error that is not an undefined column", async () => {
    fixture.state.failWith = new Error("terminating connection due to administrator command");

    await expect(new AutomatedIngestionService().createRun("daily_news")).rejects.toThrow(
      "terminating connection due to administrator command"
    );
    // One attempt only — a non-42703 failure must not be retried or swallowed.
    expect(fixture.state.statements).toHaveLength(1);
  });
});

describe("isUndefinedColumnError", () => {
  it("matches any undefined-column error, whichever column it names", () => {
    expect(isUndefinedColumnError({ code: "42703", message: 'column "anything" does not exist' })).toBe(
      true
    );
    expect(isUndefinedColumnError({ message: "error: undefined_column" })).toBe(true);
  });

  it("rejects other error classes and non-objects", () => {
    expect(isUndefinedColumnError({ code: "23505", message: "duplicate key value" })).toBe(false);
    expect(isUndefinedColumnError(new Error("connection terminated"))).toBe(false);
    expect(isUndefinedColumnError(null)).toBe(false);
    expect(isUndefinedColumnError("42703")).toBe(false);
  });

  it("stays broader than the #132 helper it backs", () => {
    const unrelated = { code: "42703", message: 'column "some_other_column" does not exist' };
    expect(isUndefinedColumnError(unrelated)).toBe(true);
    // updateRun's retry must not fire for a column outside migration 0013.
    expect(isUndefinedNewRunColumnError(unrelated)).toBe(false);
  });
});
