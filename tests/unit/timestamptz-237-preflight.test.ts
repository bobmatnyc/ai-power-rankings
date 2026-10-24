/**
 * #237 criterion 8: the apply of 0015 refuses to run on unknowns.
 *
 * Why: production row counts, sizes and the session zone are unknown. An apply with no
 *   reported measurements must not proceed, and a fail-open gate (warn and continue) is
 *   the specific wrong implementation this rejects.
 * What: unit cases for the read-only statement check, the report verdict, the database
 *   fingerprint and the post-apply conversion summary; then drives `runMigrations()` (the
 *   apply entry point scripts/apply-migrations.ts calls) against a PGlite database with
 *   no report, a malformed report, an unreadable report, an unacknowledged report and a
 *   report for another database, and asserts exit 1 before any statement ran and every
 *   column still zone-less. Also: the READ ONLY transaction rejects a write, and a run
 *   that leaves a column unconverted fails and is not recorded.
 * Test: `npx vitest run tests/unit/timestamptz-237-preflight.test.ts`. PGlite, no network.
 */

import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type CliOptions, runMigrations } from "../../scripts/apply-migrations";
import {
  assertReadOnlySql,
  CATALOG_STATEMENTS,
  checkPreflightReport,
  countStatement,
  databaseFingerprint,
  type PreflightReport,
  measurePreflight,
  PREFLIGHT_REQUIRED,
  summarizeConversion,
  TIMESTAMPTZ_COLUMNS,
  TIMESTAMPTZ_MIGRATION,
} from "../../scripts/migration-preflight";
import { catalog, createNaiveFixture, insertFixtureRows, MIGRATION_SQL, pgliteMigrationDb } from "./fixtures/timestamptz-237-fixture";

const FILE = TIMESTAMPTZ_MIGRATION;
const THIS_DB = "sha256:this-database";
const OTHER_DB = "sha256:other-database";

function report(overrides: Partial<PreflightReport> = {}): PreflightReport {
  return {
    kind: "migration-preflight-report",
    version: 1,
    migration: FILE,
    database_fingerprint: THIS_DB,
    measured_at: "2026-10-24T08:00:00.000Z",
    measurements: {
      session_timezone: "UTC",
      now_tstz: "",
      now_naive: "",
      now_utc_naive: "",
      timezone_overrides: [],
      public_tables: [],
      timestamp_columns: [],
      sizes: [],
      row_counts: {},
      missing: [],
    },
    acknowledged: { by: "architect", at: "2026-10-24T09:00:00.000Z" },
    ...overrides,
  };
}

describe("#237 preflight helpers", () => {
  it("assertReadOnlySql accepts SELECT and SHOW and refuses anything else", () => {
    expect(() => assertReadOnlySql("SELECT 1")).not.toThrow();
    expect(() => assertReadOnlySql("  show timezone;")).not.toThrow();
    for (const bad of ["ALTER TABLE t ADD c int", "SELECT 1; DROP TABLE t", "INSERT INTO t VALUES (1)", "WITH x AS (DELETE FROM t) SELECT 1"]) {
      expect(() => assertReadOnlySql(bad), bad).toThrow(/not a single SELECT\/SHOW/);
    }
  });

  it("every statement the dry run builds is a single SELECT or SHOW", () => {
    for (const statement of CATALOG_STATEMENTS) assertReadOnlySql(statement);
    for (const [table, columns] of Object.entries(TIMESTAMPTZ_COLUMNS)) assertReadOnlySql(countStatement(table, columns));
    expect(() => countStatement("t; drop", ["a"])).toThrow(/not a plain identifier/);
  });

  it.each([
    ["no report on file", null, THIS_DB, /no preflight report on file/],
    ["malformed JSON", "{ not json", THIS_DB, /not valid JSON/],
    ["a JSON array", "[]", THIS_DB, /not a migration-preflight-report/],
    ["another database", JSON.stringify(report({ database_fingerprint: OTHER_DB })), THIS_DB, /different database/],
    ["another migration", JSON.stringify(report({ migration: "0014_add_tool_metrics_history.sql" })), THIS_DB, /is for 0014/],
    ["no acknowledgement", JSON.stringify(report({ acknowledged: null })), THIS_DB, /not acknowledged/],
    ["blank acknowledgement", JSON.stringify(report({ acknowledged: { by: " ", at: "2026-10-24T09:00:00Z" } })), THIS_DB, /not acknowledged/],
    ["acknowledged before measured", JSON.stringify(report({ acknowledged: { by: "a", at: "2026-10-23T00:00:00Z" } })), THIS_DB, /earlier than measured_at/],
    ["no session zone", JSON.stringify(report({ measurements: { ...report().measurements, session_timezone: "" } })), THIS_DB, /session_timezone/],
    ["no database fingerprint", JSON.stringify(report()), null, /no fingerprint/],
  ])("checkPreflightReport refuses %s", (_name, raw, fingerprint, reason) => {
    const verdict = checkPreflightReport(raw, FILE, fingerprint);
    expect(verdict.ok).toBe(false);
    expect(verdict.ok ? "" : verdict.reason).toMatch(reason);
  });

  it("checkPreflightReport accepts an acknowledged report for this database and migration", () => {
    expect(checkPreflightReport(JSON.stringify(report()), FILE, THIS_DB).ok).toBe(true);
  });

  it("databaseFingerprint ignores the password and hides the host", () => {
    const a = databaseFingerprint("postgresql://user:one@db-a.example.test/main?sslmode=require");
    expect(a).toMatch(/^sha256:[0-9a-f]{16}$/);
    expect(databaseFingerprint("postgresql://user:two@db-a.example.test/main")).toBe(a);
    expect(databaseFingerprint("postgresql://user:one@db-b.example.test/main")).not.toBe(a);
    expect(databaseFingerprint("postgresql://user:one@db-a.example.test/other")).not.toBe(a);
    expect(a).not.toContain("example");
    expect(databaseFingerprint(undefined)).toBeNull();
    expect(databaseFingerprint("not a url")).toBeNull();
  });

  it("summarizeConversion sorts columns into converted, skipped and unconverted", () => {
    const spec = { columns: { t: ["a", "b", "c"] }, targetType: "timestamp with time zone" };
    const rows = [
      { table_name: "t", column_name: "a", data_type: "timestamp with time zone" },
      { table_name: "t", column_name: "c", data_type: "timestamp without time zone" },
    ];
    expect(summarizeConversion(spec, rows)).toEqual({
      converted: ["t.a"],
      skipped: ["t.b"],
      unconverted: ["t.c (timestamp without time zone)"],
    });
  });

  it("gates exactly 0015", () => {
    expect(Object.keys(PREFLIGHT_REQUIRED)).toEqual([FILE]);
  });
});

describe("#237 criterion 8: the apply of 0015 refuses on PGlite before any ALTER", () => {
  let db: PGlite;
  const APPLY: CliOptions = { dryRun: false, only: FILE, showColumns: null, force: false };

  beforeAll(async () => {
    db = new PGlite();
    await insertFixtureRows(db, await createNaiveFixture(db));
  });
  afterAll(async () => {
    await db.close();
  });

  async function run(read: () => string | null, options: CliOptions = APPLY, preflight = true, sql = MIGRATION_SQL) {
    const mdb = pgliteMigrationDb(db);
    const recorded: string[] = [];
    mdb.recordApplied = async (file) => void recorded.push(file);
    const result = await runMigrations(
      {
        db: mdb,
        files: { list: () => ["0014_add_tool_metrics_history.sql", FILE], read: () => sql },
        log: () => {},
        ...(preflight ? { preflight: { fingerprint: THIS_DB, reports: { read } } } : {}),
      },
      options
    );
    return { ...result, executed: mdb.executed, recorded, output: result.lines.join("\n") };
  }

  async function allNaive() {
    const { columns } = await catalog(db);
    return columns.length === 42 && columns.every((c) => c.data_type === "timestamp without time zone");
  }

  it.each([
    ["no report", () => null, /no preflight report on file/],
    ["a malformed report", () => "{ not json", /not valid JSON/],
    ["a report for another database", () => JSON.stringify(report({ database_fingerprint: OTHER_DB })), /different database/],
    ["an unacknowledged report", () => JSON.stringify(report({ acknowledged: null })), /not acknowledged/],
    [
      "an unreadable report",
      () => {
        throw new Error("EACCES: permission denied");
      },
      /could not be read \(EACCES/,
    ],
  ])("refuses with %s: exit 1, no statement executed, nothing recorded", async (_name, read, reason) => {
    const result = await run(read as () => string | null);
    expect(result.exitCode).toBe(1);
    expect(result.output).toMatch(new RegExp(`ERROR: refusing to apply ${FILE}: .*${reason.source}`));
    expect(result.output).not.toContain("Applying");
    expect(result.executed).toEqual([]);
    expect(result.recorded).toEqual([]);
    expect(await allNaive()).toBe(true);
  });

  it("refuses when no preflight source is configured at all", async () => {
    const result = await run(() => JSON.stringify(report()), APPLY, false);
    expect(result.exitCode).toBe(1);
    expect(result.output).toMatch(/no preflight source configured/);
    expect(result.executed).toEqual([]);
    expect(await allNaive()).toBe(true);
  });

  it("refuses a bare run (no --only) that would include 0015", async () => {
    const result = await run(() => null, { dryRun: false, only: null, showColumns: null, force: false });
    expect(result.exitCode).toBe(1);
    expect(result.executed).toEqual([]);
    expect(await allNaive()).toBe(true);
  });

  it("the dry run's READ ONLY transaction rejects a write", async () => {
    const mdb = pgliteMigrationDb(db);
    await expect(mdb.readOnlyQueries?.(["CREATE TABLE should_not_exist (a int)"])).rejects.toThrow(/read-only transaction/);
  });

  it("an apply that leaves a present column unconverted fails and is not recorded", async () => {
    const result = await run(() => JSON.stringify(report()), APPLY, true, "SELECT 1");
    expect(result.exitCode).toBe(1);
    expect(result.output).toMatch(/left 42 column\(s\) unconverted/);
    expect(result.recorded).toEqual([]);
  });
});

// #237 (scan M1): the report and the job log are public, so the report names no
// database and no role, and carries no setting other than TimeZone.
describe("#237 the preflight report carries no database or role name", () => {
  const ROLE = "zq_role_kumquat_237";
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();
    await insertFixtureRows(db, await createNaiveFixture(db));
    await db.exec(`CREATE ROLE ${ROLE}`);
    await db.exec(`GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${ROLE}`);
    await db.exec(`ALTER ROLE ${ROLE} SET TimeZone = 'America/New_York'`);
    await db.exec(`ALTER ROLE ${ROLE} SET work_mem = '8MB'`);
    await db.exec(`ALTER DATABASE postgres SET TimeZone = 'Europe/Paris'`);
    // Overrides for another database: not this database, so not reported.
    await db.exec(`ALTER DATABASE template1 SET TimeZone = 'Asia/Tokyo'`);
    await db.exec(`ALTER ROLE ${ROLE} IN DATABASE template1 SET TimeZone = 'Asia/Tokyo'`);
    await db.exec(`SET SESSION AUTHORIZATION ${ROLE}`);
  });
  afterAll(async () => {
    await db.close();
  });

  it("labels this database's and this role's TimeZone overrides by scope only", async () => {
    const mdb = pgliteMigrationDb(db);
    const report = await measurePreflight(mdb.readOnlyQueries!, FILE, PREFLIGHT_REQUIRED[FILE]!, THIS_DB);
    expect(report.measurements.timezone_overrides).toEqual([
      { scope: "database-level", timezone: "Europe/Paris" },
      { scope: "role-level", timezone: "America/New_York" },
    ]);
    const json = JSON.stringify(report);
    for (const name of [ROLE, "template1", '"postgres"', "work_mem", "Asia/Tokyo"]) {
      expect(json, name).not.toContain(name);
    }
  });
});
