/**
 * Regression coverage for the migration runner's CLI contract (issue #134).
 *
 * Why: production ingestion was down from 2026-09-04 because migration 0013 was never
 * applied, and the fix is to run the apply from CI — where a mistake is expensive and
 * unobservable. The three failure modes that would make the CI path worse than useless are
 * a --dry-run that still writes, an --only that re-applies a migration already recorded,
 * and an --only that exits 0 on a filename that does not exist. Each has a test here that
 * fails on the wrong implementation. The statement splitter is covered too: it used to drop
 * every chunk beginning with a `--` comment, which meant applying 0013 executed nothing
 * while still recording it as applied.
 *
 * Test: Runs under `npm run test:unit`. Drives the exported logic through a recording
 * MigrationDb double — no database, no network, no filesystem.
 */

import { describe, expect, it } from "vitest";
import {
  type ColumnRow,
  type MigrationDb,
  type MigrationFiles,
  parseArgs,
  planMigrations,
  redactConnectionString,
  runMigrations,
  splitStatements,
} from "../../scripts/apply-migrations";

const FILES = ["0000_oval_manta.sql", "0001_easy_mesmero.sql", "0012_semantic.sql", "0013_candidate.sql"];

interface FakeDb extends MigrationDb {
  calls: string[];
  executed: string[];
  recorded: string[];
}

function createFakeDb(options: { applied?: string[]; tableExists?: boolean; columns?: ColumnRow[] } = {}): FakeDb {
  const applied = [...(options.applied ?? [])];
  const calls: string[] = [];
  const executed: string[] = [];
  const recorded: string[] = [];

  return {
    calls,
    executed,
    recorded,
    async trackingTableExists() {
      calls.push("trackingTableExists");
      return options.tableExists ?? true;
    },
    async createTrackingTable() {
      calls.push("createTrackingTable");
    },
    async listAppliedFilenames() {
      calls.push("listAppliedFilenames");
      return applied;
    },
    async executeStatement(statement: string) {
      calls.push("executeStatement");
      executed.push(statement);
    },
    async recordApplied(filename: string) {
      calls.push("recordApplied");
      recorded.push(filename);
      applied.push(filename);
    },
    async describeColumns() {
      calls.push("describeColumns");
      return options.columns ?? [{ column_name: "id", data_type: "uuid", column_default: null }];
    },
  };
}

function createFakeFiles(contents: Record<string, string> = {}): MigrationFiles {
  return {
    list: () => [...FILES],
    read: (filename: string) => contents[filename] ?? `ALTER TABLE t ADD COLUMN ${filename.slice(0, 4)} integer;`,
  };
}

const WRITE_CALLS = ["createTrackingTable", "executeStatement", "recordApplied"];

function writesMade(db: FakeDb): string[] {
  return db.calls.filter((call) => WRITE_CALLS.includes(call));
}

describe("parseArgs", () => {
  it("defaults to a full apply with no flags", () => {
    const { options, errors } = parseArgs([]);
    expect(errors).toEqual([]);
    expect(options).toEqual({ dryRun: false, only: null, showColumns: null });
  });

  it("accepts --dry-run, --only and --show-columns in both spaced and = forms", () => {
    const spaced = parseArgs(["--dry-run", "--only", "0013_candidate.sql", "--show-columns", "automated_ingestion_runs"]);
    expect(spaced.errors).toEqual([]);
    expect(spaced.options).toEqual({
      dryRun: true,
      only: "0013_candidate.sql",
      showColumns: "automated_ingestion_runs",
    });

    const inline = parseArgs(["--only=0013_candidate.sql", "--show-columns=automated_ingestion_runs"]);
    expect(inline.errors).toEqual([]);
    expect(inline.options.only).toBe("0013_candidate.sql");
    expect(inline.options.showColumns).toBe("automated_ingestion_runs");
  });

  it("rejects a --only value that is a path rather than a bare migration filename", () => {
    const { options, errors } = parseArgs(["--only", "../../etc/passwd.sql"]);
    expect(options.only).toBeNull();
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("--only");
  });

  it("rejects a --show-columns value that is not a plain table name", () => {
    const { options, errors } = parseArgs(["--show-columns", "users; DROP TABLE x"]);
    expect(options.showColumns).toBeNull();
    expect(errors).toHaveLength(1);
  });

  it("reports a flag given without its value, and an unknown flag", () => {
    expect(parseArgs(["--only"]).errors).toEqual(["--only requires a value"]);
    expect(parseArgs(["--only", "--dry-run"]).errors).toEqual(["--only requires a value"]);
    expect(parseArgs(["--wat"]).errors).toEqual(["unknown argument: --wat"]);
  });
});

describe("planMigrations", () => {
  it("splits disk files into applied and pending, and applies every pending file by default", () => {
    const plan = planMigrations(FILES, ["0000_oval_manta.sql", "0001_easy_mesmero.sql"], null);
    expect(plan.errors).toEqual([]);
    expect(plan.applied).toEqual(["0000_oval_manta.sql", "0001_easy_mesmero.sql"]);
    expect(plan.pending).toEqual(["0012_semantic.sql", "0013_candidate.sql"]);
    expect(plan.toApply).toEqual(["0012_semantic.sql", "0013_candidate.sql"]);
  });

  it("narrows to exactly one file when --only names a pending migration", () => {
    const plan = planMigrations(FILES, ["0000_oval_manta.sql"], "0013_candidate.sql");
    expect(plan.errors).toEqual([]);
    expect(plan.toApply).toEqual(["0013_candidate.sql"]);
    expect(plan.pending).toContain("0012_semantic.sql");
  });

  it("refuses --only on a file already recorded as applied", () => {
    const plan = planMigrations(FILES, ["0013_candidate.sql"], "0013_candidate.sql");
    expect(plan.toApply).toEqual([]);
    expect(plan.errors).toHaveLength(1);
    expect(plan.errors[0]).toContain("already recorded as applied");
  });

  it("refuses --only on a file that is not on disk", () => {
    const plan = planMigrations(FILES, [], "0099_nope.sql");
    expect(plan.toApply).toEqual([]);
    expect(plan.errors[0]).toContain("no such file");
  });
});

describe("splitStatements", () => {
  it("keeps a statement whose chunk opens with a comment line (the 0013 regression)", () => {
    const sql = [
      "-- Migration: Add stale-skip counter",
      "-- Description: #132",
      "",
      'ALTER TABLE "automated_ingestion_runs" ADD COLUMN IF NOT EXISTS "articles_skipped_stale" integer DEFAULT 0;',
      "--> statement-breakpoint",
      "",
      "-- Add candidate_outcomes column",
      'ALTER TABLE "automated_ingestion_runs" ADD COLUMN IF NOT EXISTS "candidate_outcomes" jsonb DEFAULT \'[]\';',
      "--> statement-breakpoint",
    ].join("\n");

    const statements = splitStatements(sql);
    expect(statements).toHaveLength(2);
    expect(statements[0]).toContain("articles_skipped_stale");
    expect(statements[1]).toContain("candidate_outcomes");
  });

  it("drops chunks that are only comments or whitespace", () => {
    expect(splitStatements("-- just a note\n\n--> statement-breakpoint\n\n")).toEqual([]);
  });
});

describe("runMigrations --dry-run", () => {
  it("writes nothing and exits 0", async () => {
    const db = createFakeDb({ applied: ["0000_oval_manta.sql"] });
    const result = await runMigrations(
      { db, files: createFakeFiles(), log: () => {} },
      { dryRun: true, only: null, showColumns: null }
    );

    expect(result.exitCode).toBe(0);
    expect(writesMade(db)).toEqual([]);
    expect(db.executed).toEqual([]);
    expect(result.appliedNow).toEqual([]);
    expect(result.lines.join("\n")).toContain("Pending (3)");
  });

  it("reports a missing tracking table instead of creating it", async () => {
    const db = createFakeDb({ tableExists: false });
    const result = await runMigrations(
      { db, files: createFakeFiles(), log: () => {} },
      { dryRun: true, only: null, showColumns: null }
    );

    expect(result.exitCode).toBe(0);
    expect(db.calls).not.toContain("createTrackingTable");
    expect(result.lines.join("\n")).toContain("does not exist");
  });

  it("still executes no statement when --only is combined with --dry-run", async () => {
    const db = createFakeDb();
    const result = await runMigrations(
      { db, files: createFakeFiles(), log: () => {} },
      { dryRun: true, only: "0013_candidate.sql", showColumns: null }
    );

    expect(result.exitCode).toBe(0);
    expect(db.executed).toEqual([]);
  });

  it("reads columns without writing when --show-columns is combined with --dry-run", async () => {
    const db = createFakeDb();
    const result = await runMigrations(
      { db, files: createFakeFiles(), log: () => {} },
      { dryRun: true, only: null, showColumns: "automated_ingestion_runs" }
    );

    expect(result.exitCode).toBe(0);
    expect(db.calls.filter((c) => c === "describeColumns")).toHaveLength(1);
    expect(writesMade(db)).toEqual([]);
    expect(result.lines.join("\n")).toContain("id, uuid, NULL");
  });
});

describe("runMigrations --only", () => {
  it("exits non-zero and applies nothing when the file is already recorded", async () => {
    const db = createFakeDb({ applied: ["0013_candidate.sql"] });
    const result = await runMigrations(
      { db, files: createFakeFiles(), log: () => {} },
      { dryRun: false, only: "0013_candidate.sql", showColumns: null }
    );

    expect(result.exitCode).toBe(1);
    expect(db.executed).toEqual([]);
    expect(db.recorded).toEqual([]);
    expect(result.lines.join("\n")).toContain("refusing to re-apply");
  });

  it("exits non-zero when the file does not exist on disk", async () => {
    const db = createFakeDb();
    const result = await runMigrations(
      { db, files: createFakeFiles(), log: () => {} },
      { dryRun: false, only: "0099_nope.sql", showColumns: null }
    );

    expect(result.exitCode).toBe(1);
    expect(db.executed).toEqual([]);
  });

  it("applies exactly the named file and leaves the other pending ones untouched", async () => {
    const db = createFakeDb({ applied: ["0000_oval_manta.sql"] });
    const result = await runMigrations(
      { db, files: createFakeFiles({ "0013_candidate.sql": "ALTER TABLE a ADD COLUMN b integer;" }), log: () => {} },
      { dryRun: false, only: "0013_candidate.sql", showColumns: null }
    );

    expect(result.exitCode).toBe(0);
    expect(result.appliedNow).toEqual(["0013_candidate.sql"]);
    expect(db.recorded).toEqual(["0013_candidate.sql"]);
    expect(db.executed).toEqual(["ALTER TABLE a ADD COLUMN b integer;"]);
    expect(result.lines.join("\n")).toContain("0001_easy_mesmero.sql");
  });

  it("prints the columns before and after the apply when --show-columns is combined", async () => {
    const db = createFakeDb();
    const result = await runMigrations(
      { db, files: createFakeFiles(), log: () => {} },
      { dryRun: false, only: "0013_candidate.sql", showColumns: "automated_ingestion_runs" }
    );

    expect(result.exitCode).toBe(0);
    expect(db.calls.filter((c) => c === "describeColumns")).toHaveLength(2);
    const output = result.lines.join("\n");
    expect(output).toContain("(before)");
    expect(output).toContain("(after)");
  });
});

describe("runMigrations default behaviour", () => {
  it("creates the tracking table and applies every pending migration in order", async () => {
    const db = createFakeDb({ tableExists: false });
    const result = await runMigrations(
      { db, files: createFakeFiles(), log: () => {} },
      { dryRun: false, only: null, showColumns: null }
    );

    expect(result.exitCode).toBe(0);
    expect(db.calls).toContain("createTrackingTable");
    expect(result.appliedNow).toEqual(FILES);
    expect(db.recorded).toEqual(FILES);
  });

  it("stops with a non-zero exit when a statement throws, and never records that file", async () => {
    const db = createFakeDb();
    db.executeStatement = async () => {
      throw new Error("relation does not exist");
    };
    const result = await runMigrations(
      { db, files: createFakeFiles(), log: () => {} },
      { dryRun: false, only: null, showColumns: null }
    );

    expect(result.exitCode).toBe(1);
    expect(db.recorded).toEqual([]);
    expect(result.lines.join("\n")).toContain("relation does not exist");
  });
});

describe("redactConnectionString", () => {
  it("removes a postgres connection string from an error message", () => {
    const message = 'connect ECONNREFUSED for postgresql://neondb_owner:npg_secret@ep-x.aws.neon.tech/neondb?sslmode=require';
    const redacted = redactConnectionString(message, undefined);
    expect(redacted).not.toContain("npg_secret");
    expect(redacted).not.toContain("ep-x.aws.neon.tech");
    expect(redacted).toContain("[redacted-url]");
  });

  it("removes the host and password even when they appear on their own", () => {
    const url = "postgresql://neondb_owner:npg_longsecret@ep-dark-firefly-adp1p3v8.aws.neon.tech/neondb";
    const message = "host ep-dark-firefly-adp1p3v8.aws.neon.tech rejected password npg_longsecret";
    const redacted = redactConnectionString(message, url);
    expect(redacted).not.toContain("npg_longsecret");
    expect(redacted).not.toContain("ep-dark-firefly-adp1p3v8");
  });
});
