#!/usr/bin/env node

/**
 * Apply pending SQL migrations from lib/db/migrations/ to the configured database.
 *
 * Why: #134 — migration 0013 shipped with the #133 deploy but was never applied, and
 * production ingestion was down from 2026-09-04 until someone noticed. Nobody can pull a
 * production DATABASE_URL to a laptop, so the apply has to happen from CI
 * (.github/workflows/apply-migration.yml), which needs three things this script did not
 * have: a dry run that inspects without writing, a single-file apply so one known
 * migration can be run without dragging every other pending file along, and a way to read
 * back the resulting columns. It also must never echo the connection string into a public
 * Actions log.
 * What: Reads the migration filenames on disk, compares them against the filenames
 * recorded in the `_drizzle_migrations` tracking table, and applies the pending ones —
 * or, with --dry-run, only reports the comparison. All database access goes through the
 * MigrationDb interface so the decision logic is testable without a database.
 * Test: `tests/unit/apply-migrations.test.ts`
 */

import fs from "fs";
import path from "path";

export const MIGRATIONS_DIR = "lib/db/migrations";
export const TRACKING_TABLE = "_drizzle_migrations";
export const STATEMENT_BREAKPOINT = "--> statement-breakpoint";

/** #134: --only and --show-columns values are shape-checked before they reach any query. */
export const MIGRATION_FILE_PATTERN = /^[0-9]{4}_[a-z0-9_]+\.sql$/;
export const TABLE_NAME_PATTERN = /^[a-z_][a-z0-9_]*$/;

export interface ColumnRow {
  column_name: string;
  data_type: string;
  column_default: string | null;
}

/**
 * The complete set of database operations this script performs.
 *
 * Why: #134 — the dry-run guarantee ("no statement from any migration file executes") is
 * only checkable if every write is a named method a test double can assert was not called.
 * Read-only members are trackingTableExists, listAppliedFilenames and describeColumns;
 * everything else writes.
 */
export interface MigrationDb {
  trackingTableExists(): Promise<boolean>;
  createTrackingTable(): Promise<void>;
  listAppliedFilenames(): Promise<string[]>;
  executeStatement(statement: string): Promise<void>;
  recordApplied(filename: string): Promise<void>;
  describeColumns(table: string): Promise<ColumnRow[]>;
}

export interface MigrationFiles {
  list(): string[];
  read(filename: string): string;
}

export interface CliOptions {
  dryRun: boolean;
  only: string | null;
  showColumns: string | null;
  force: boolean;
}

export interface MigrationDeps {
  db: MigrationDb;
  files: MigrationFiles;
  log?: (line: string) => void;
}

export interface MigrationPlan {
  files: string[];
  applied: string[];
  pending: string[];
  toApply: string[];
  /** Files in `toApply` that already have a tracking row, so must not get a second one. */
  skipRecord: string[];
  errors: string[];
}

export interface MigrationResult {
  exitCode: number;
  lines: string[];
  appliedNow: string[];
}

/**
 * #134: Strips anything URL-shaped out of text bound for stdout.
 *
 * Why: the Actions log for a public repository is world-readable, and both the pg pool and
 * the Neon client can put the connection string (or its host) into an error message. The
 * scheme match is deliberately broad — any `scheme://…` run, not just postgres:// — and
 * the literal DATABASE_URL value and its password are removed separately, so a client that
 * reports a bare host:port or a bare password is covered too.
 */
export function redactConnectionString(text: string, databaseUrl?: string): string {
  let out = text.replace(/\b[a-z][a-z0-9+.-]*:\/\/\S+/gi, "[redacted-url]");

  const url = databaseUrl ?? process.env["DATABASE_URL"];
  if (url) {
    out = out.split(url).join("[redacted-url]");

    // A password only gets its own pass when it is long enough that removing every
    // occurrence cannot plausibly mangle unrelated prose.
    const password = url.match(/^[a-z][a-z0-9+.-]*:\/\/[^:/@]+:([^@]+)@/i)?.[1];
    if (password && password.length >= 8) {
      out = out.split(decodeURIComponent(password)).join("[redacted]").split(password).join("[redacted]");
    }

    const host = url.match(/^[a-z][a-z0-9+.-]*:\/\/[^@]*@([^/?#]+)/i)?.[1];
    if (host && host.length >= 8) {
      out = out.split(host).join("[redacted-host]");
    }
  }

  return out;
}

/**
 * #134: Parses the CLI flags. Returns collected errors rather than throwing so the caller
 * can report every problem at once and exit non-zero.
 */
export function parseArgs(argv: string[]): { options: CliOptions; errors: string[] } {
  const options: CliOptions = { dryRun: false, only: null, showColumns: null, force: false };
  const errors: string[] = [];

  const takeValue = (flag: string, inline: string | undefined, index: number): { value: string | null; next: number } => {
    if (inline !== undefined) {
      return { value: inline, next: index };
    }
    const next = argv[index + 1];
    if (next === undefined || next.startsWith("--")) {
      errors.push(`${flag} requires a value`);
      return { value: null, next: index };
    }
    return { value: next, next: index + 1 };
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    const eq = arg.indexOf("=");
    const flag = eq === -1 ? arg : arg.slice(0, eq);
    const inline = eq === -1 ? undefined : arg.slice(eq + 1);

    if (flag === "--dry-run") {
      if (inline !== undefined) {
        errors.push("--dry-run takes no value");
      }
      options.dryRun = true;
    } else if (flag === "--force") {
      if (inline !== undefined) {
        errors.push("--force takes no value");
      }
      options.force = true;
    } else if (flag === "--only") {
      const { value, next } = takeValue("--only", inline, i);
      i = next;
      if (value !== null) {
        if (!MIGRATION_FILE_PATTERN.test(value)) {
          errors.push(`--only value ${JSON.stringify(value)} is not a migration filename (expected NNNN_name.sql, no path)`);
        } else {
          options.only = value;
        }
      }
    } else if (flag === "--show-columns") {
      const { value, next } = takeValue("--show-columns", inline, i);
      i = next;
      if (value !== null) {
        if (!TABLE_NAME_PATTERN.test(value)) {
          errors.push(`--show-columns value ${JSON.stringify(value)} is not a valid table name`);
        } else {
          options.showColumns = value;
        }
      }
    } else {
      errors.push(`unknown argument: ${arg}`);
    }
  }

  // #134: --force overrides the one guard that stops a recorded migration re-running, so
  // it is only ever allowed against a single named file — never across everything pending.
  if (options.force && options.only === null) {
    errors.push("--force is only valid together with --only <file>");
  }

  return { options, errors };
}

/**
 * #134: Splits a migration file into executable statements.
 *
 * Why: the previous splitter dropped any chunk whose first characters were `--`, which
 * silently discarded every statement in 0013 — both its ALTER TABLEs sit under a leading
 * comment line — while still recording the file as applied. A chunk is now skipped only
 * when nothing but comments and whitespace remains after stripping full-line `--`
 * comments; the chunk itself is executed verbatim, comments included.
 */
export function splitStatements(migrationSql: string): string[] {
  return migrationSql
    .split(STATEMENT_BREAKPOINT)
    .map((chunk) => chunk.trim())
    .filter((chunk) => {
      const withoutComments = chunk
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim();
      return withoutComments.length > 0;
    });
}

/**
 * #134: Decides what would be applied, without touching the database.
 *
 * `only` is refused (a non-empty `errors`) when the named file is not on disk or is
 * already recorded as applied — re-running a recorded migration is the failure this whole
 * change exists to avoid, so it must never be a silent no-op or a silent re-apply.
 *
 * `force` lifts the second refusal only, and only for the one named file: the old splitter
 * could record a migration whose statements it had silently dropped, so production may
 * hold a row for 0013 with neither of its columns present. A forced file keeps its
 * existing tracking row (`skipRecord`) rather than gaining a duplicate.
 */
export function planMigrations(
  filesOnDisk: string[],
  appliedFilenames: string[],
  only: string | null,
  force = false
): MigrationPlan {
  const appliedSet = new Set(appliedFilenames);
  const files = [...filesOnDisk].sort();
  const applied = files.filter((file) => appliedSet.has(file));
  const pending = files.filter((file) => !appliedSet.has(file));
  const errors: string[] = [];
  const skipRecord: string[] = [];
  let toApply: string[] = pending;

  if (only !== null) {
    if (!files.includes(only)) {
      errors.push(`--only ${only}: no such file in ${MIGRATIONS_DIR}/`);
      toApply = [];
    } else if (appliedSet.has(only)) {
      if (force) {
        toApply = [only];
        skipRecord.push(only);
      } else {
        errors.push(`--only ${only}: already recorded as applied in ${TRACKING_TABLE}; refusing to re-apply (pass --force to re-execute it anyway)`);
        toApply = [];
      }
    } else {
      toApply = [only];
    }
  }

  return { files, applied, pending, toApply, skipRecord, errors };
}

function formatColumns(table: string, rows: ColumnRow[]): string[] {
  if (rows.length === 0) {
    return [`  (no columns found for ${table} — does the table exist?)`];
  }
  return rows.map(
    (row) => `  ${row.column_name}, ${row.data_type}, ${row.column_default ?? "NULL"}`
  );
}

/**
 * #134: Runs the whole flow against injected dependencies and returns an exit code instead
 * of calling process.exit, so tests can assert the outcome and the writes that did or did
 * not happen.
 */
export async function runMigrations(deps: MigrationDeps, options: CliOptions): Promise<MigrationResult> {
  const lines: string[] = [];
  const appliedNow: string[] = [];
  const emit = (line: string) => {
    lines.push(line);
    (deps.log ?? console.log)(line);
  };

  const { db, files } = deps;
  const mode = options.dryRun
    ? "DRY RUN (no writes)"
    : options.only
      ? `single file: ${options.only}${options.force ? " (forced)" : ""}`
      : "apply all pending";
  emit(`Migration runner — mode: ${mode}`);

  const filesOnDisk = files.list();
  emit(`\nMigration files on disk (${filesOnDisk.length}):`);
  for (const file of filesOnDisk) {
    emit(`  ${file}`);
  }

  // The tracking table is created on demand in normal mode, but a dry run must not write
  // anything at all — so a missing table is reported and treated as "nothing recorded".
  const tableExists = await db.trackingTableExists();
  let appliedFilenames: string[] = [];
  if (tableExists) {
    appliedFilenames = await db.listAppliedFilenames();
  } else if (options.dryRun) {
    emit(`\nTracking table ${TRACKING_TABLE} does not exist (it would be created on a real run); treating every migration as pending.`);
  } else {
    await db.createTrackingTable();
    emit(`\nCreated tracking table ${TRACKING_TABLE}.`);
  }

  const plan = planMigrations(filesOnDisk, appliedFilenames, options.only, options.force);

  emit(`\nRecorded as applied (${plan.applied.length}):`);
  for (const file of plan.applied) {
    emit(`  ${file}`);
    // #134: a tracking row is not proof the statements ran — the old splitter dropped
    // every chunk that opened with a comment while still recording the file. The dry run
    // is where someone compares this list against the columns below, so say what to do
    // when they disagree.
    if (options.dryRun) {
      emit(`    recorded as applied; use --only ${file} --force if --show-columns shows its columns missing`);
    }
  }
  emit(`\nPending (${plan.pending.length}):`);
  for (const file of plan.pending) {
    emit(`  ${file}`);
  }

  const willApply = !options.dryRun && plan.errors.length === 0 && plan.toApply.length > 0;

  if (options.showColumns) {
    const before = await db.describeColumns(options.showColumns);
    emit(`\nColumns of ${options.showColumns}${willApply ? " (before)" : ""}:`);
    for (const line of formatColumns(options.showColumns, before)) {
      emit(line);
    }
  }

  if (plan.errors.length > 0) {
    for (const error of plan.errors) {
      emit(`\nERROR: ${error}`);
    }
    return { exitCode: 1, lines, appliedNow };
  }

  if (options.dryRun) {
    emit(`\nDry run complete — nothing was written. ${plan.pending.length} migration(s) pending.`);
    return { exitCode: 0, lines, appliedNow };
  }

  if (plan.toApply.length === 0) {
    emit("\nNothing to apply — every migration on disk is already recorded.");
    return { exitCode: 0, lines, appliedNow };
  }

  if (options.only !== null) {
    const untouched = plan.pending.filter((file) => file !== options.only);
    emit(`\nOther pending migrations left untouched (${untouched.length}): ${untouched.join(", ") || "none"}`);
  }

  // #134: every migration file must be re-runnable. Each statement and the tracking-row
  // INSERT are separate calls over neon-http with no enclosing transaction, so any failure
  // part-way leaves some statements applied and the file still pending — and --force
  // deliberately re-executes a file that already has a row. Guard every statement
  // (IF EXISTS / IF NOT EXISTS, or an equivalent) so a second run is a no-op.
  for (const file of plan.toApply) {
    emit(`\nApplying ${file}...`);

    let statements: string[];
    try {
      statements = splitStatements(files.read(file));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      emit(`\nERROR: reading ${file} failed: ${redactConnectionString(message)}`);
      return { exitCode: 1, lines, appliedNow };
    }
    emit(`  ${statements.length} statement(s)`);

    // The two halves report separately: a failed statement means nothing was recorded,
    // while a failed INSERT means the DDL landed and only the bookkeeping is missing.
    for (let index = 0; index < statements.length; index++) {
      try {
        await db.executeStatement(statements[index] as string);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        emit(
          `\nERROR: applying ${file} failed while executing statement ${index + 1} of ${statements.length}: ${redactConnectionString(message)}`
        );
        return { exitCode: 1, lines, appliedNow };
      }
    }

    if (plan.skipRecord.includes(file)) {
      emit(`  re-executed under --force; kept the existing ${TRACKING_TABLE} row for ${file}`);
    } else {
      try {
        await db.recordApplied(file);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        emit(
          `\nERROR: statements for ${file} executed but recording it in ${TRACKING_TABLE} failed: ${redactConnectionString(message)}`
        );
        emit(
          `  The DDL landed; ${file} is still pending, so re-running with --only ${file} will re-execute its statements — safe only because migrations are guarded (IF EXISTS / IF NOT EXISTS).`
        );
        return { exitCode: 1, lines, appliedNow };
      }
    }

    appliedNow.push(file);
    emit(`  applied ${file}`);
  }

  if (options.showColumns) {
    const after = await db.describeColumns(options.showColumns);
    emit(`\nColumns of ${options.showColumns} (after):`);
    for (const line of formatColumns(options.showColumns, after)) {
      emit(line);
    }
  }

  emit(`\nDone — applied ${appliedNow.length} migration(s): ${appliedNow.join(", ")}`);
  return { exitCode: 0, lines, appliedNow };
}

/** Reads migration filenames and contents from lib/db/migrations/ under the cwd. */
export function createFileSource(dir = path.join(process.cwd(), MIGRATIONS_DIR)): MigrationFiles {
  return {
    list: () =>
      fs
        .readdirSync(dir)
        .filter((file) => file.endsWith(".sql"))
        .sort(),
    read: (filename: string) => fs.readFileSync(path.join(dir, filename), "utf-8"),
  };
}

/**
 * #134: Builds the real database adapter directly from DATABASE_URL rather than through
 * lib/db/connection's getDb(), which logs the Neon endpoint id — part of the connection
 * string, and this job's log is public.
 */
async function createNeonDb(): Promise<MigrationDb> {
  const url = process.env["DATABASE_URL"];
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }

  const { neon } = await import("@neondatabase/serverless");
  const { drizzle } = await import("drizzle-orm/neon-http");
  const { sql } = await import("drizzle-orm");
  const db = drizzle(neon(url));

  // drizzle's neon-http result exposes `rows`; normalise so a plain-array shape also works.
  const rowsOf = (result: unknown): Record<string, unknown>[] => {
    if (Array.isArray(result)) return result as Record<string, unknown>[];
    const rows = (result as { rows?: unknown }).rows;
    return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
  };

  return {
    async trackingTableExists() {
      const result = await db.execute(sql`SELECT to_regclass(${`public.${TRACKING_TABLE}`}) IS NOT NULL AS present`);
      return rowsOf(result)[0]?.["present"] === true;
    },
    async createTrackingTable() {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS _drizzle_migrations (
          id SERIAL PRIMARY KEY,
          hash TEXT NOT NULL,
          created_at BIGINT NOT NULL
        );
      `);
    },
    async listAppliedFilenames() {
      const result = await db.execute(sql`SELECT hash FROM _drizzle_migrations`);
      return rowsOf(result).map((row) => String(row["hash"]));
    },
    async executeStatement(statement: string) {
      await db.execute(sql.raw(statement));
    },
    async recordApplied(filename: string) {
      await db.execute(sql`
        INSERT INTO _drizzle_migrations (hash, created_at)
        VALUES (${filename}, ${Date.now()});
      `);
    },
    async describeColumns(table: string) {
      const result = await db.execute(sql`
        SELECT column_name, data_type, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ${table}
        ORDER BY ordinal_position
      `);
      return rowsOf(result).map((row) => ({
        column_name: String(row["column_name"]),
        data_type: String(row["data_type"]),
        column_default: row["column_default"] === null || row["column_default"] === undefined ? null : String(row["column_default"]),
      }));
    },
  };
}

async function applyMigrations(argv: string[] = process.argv.slice(2)): Promise<number> {
  const { options, errors } = parseArgs(argv);
  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`ERROR: ${error}`);
    }
    console.error(
      "Usage: tsx scripts/apply-migrations.ts [--dry-run] [--only <NNNN_name.sql> [--force]] [--show-columns <table>]"
    );
    return 1;
  }

  try {
    const db = await createNeonDb();
    const result = await runMigrations({ db, files: createFileSource() }, options);
    return result.exitCode;
  } catch (error) {
    // #134: never let a driver error carry the connection string into a public Actions log.
    const message = error instanceof Error ? error.message : String(error);
    console.error(`ERROR: migration run failed: ${redactConnectionString(message)}`);
    return 1;
  }
}

// Only run the CLI when this file is the entrypoint (`tsx scripts/apply-migrations.ts`),
// never when a test imports the exported logic. Deliberately avoids both `require.main`
// and `import.meta`, either of which breaks under one of the two module systems this file
// is loaded in (tsx CJS for the CLI, Vite ESM for the vitest suite).
const entrypoint = process.argv[1] ?? "";
if (/apply-migrations\.(ts|js|mjs|cjs)$/.test(entrypoint)) {
  void applyMigrations().then((code) => {
    process.exit(code);
  });
}

export { applyMigrations };
