/**
 * Child-process probe for tests/unit/timestamptz-237-tz.test.ts (#237).
 *
 * Why: the process time zone is fixed when a process starts, so comparing TZ=UTC with
 *   TZ=America/New_York needs one process per zone (same pattern as
 *   naive-utc-tz-probe.mjs, #103).
 * What: in a fresh PGlite database, builds the pre-0015 tables, inserts known rows under
 *   a UTC session, switches the session to America/New_York, dry-runs 0015 through
 *   runMigrations() to get the read-only preflight report, acknowledges it, applies,
 *   applies again under --force, and runs the rollback draft. Separately it applies a
 *   copy of 0015 with a bare cast, runs the news window predicate before and after, and
 *   parses OID 1184 wire text with the project's readers. Prints one JSON object.
 *   Run: `node --import tsx tests/unit/fixtures/timestamptz-237-probe.ts`.
 * Test: tests/unit/timestamptz-237-tz.test.ts.
 */

import { PGlite } from "@electric-sql/pglite";
import { getTableConfig, pgTable, timestamp } from "drizzle-orm/pg-core";
import { naiveUtcTypes } from "../../../lib/db/naive-utc-timestamp.mjs";
import { automatedIngestionRuns } from "../../../lib/db/schema";
import { runMigrations, splitStatements } from "../../../scripts/apply-migrations";
import {
  catalog,
  createNaiveFixture,
  insertFixtureRows,
  MIGRATION_FILE,
  MIGRATION_SQL,
  pgliteMigrationDb,
  relfilenodes,
  REVERT_SQL,
  snapshot,
} from "./timestamptz-237-fixture";

const FINGERPRINT = "sha256:fixture-database";
const quiet = () => {};

async function apply(db: PGlite, sql: string, reportText: string | null, force = false) {
  const mdb = pgliteMigrationDb(db);
  if (force) mdb.listAppliedFilenames = async () => [MIGRATION_FILE];
  const result = await runMigrations(
    {
      db: mdb,
      files: { list: () => [MIGRATION_FILE], read: () => sql },
      log: quiet,
      preflight: { fingerprint: FINGERPRINT, reports: { read: () => reportText } },
    },
    { dryRun: false, only: MIGRATION_FILE, showColumns: null, force }
  );
  return { exitCode: result.exitCode, lines: result.lines, executed: mdb.executed.length, notices: mdb.notices };
}

/** Dry run, then the acknowledged copy an Architect would commit. */
async function dryRunReport(db: PGlite) {
  const mdb = pgliteMigrationDb(db);
  const result = await runMigrations(
    {
      db: mdb,
      files: { list: () => [MIGRATION_FILE], read: () => MIGRATION_SQL },
      log: quiet,
      preflight: { fingerprint: FINGERPRINT, reports: { read: () => null } },
    },
    { dryRun: true, only: null, showColumns: null, force: false }
  );
  const start = result.lines.findIndex((l) => l.startsWith("{"));
  const report = JSON.parse(result.lines[start] as string);
  return {
    exitCode: result.exitCode,
    executed: mdb.executed.length,
    report,
    acknowledged: JSON.stringify({ ...report, acknowledged: { by: "fixture-architect", at: new Date().toISOString() } }),
  };
}

async function freshFixture(options: { omitTable?: string; omitColumn?: string } = {}) {
  const db = new PGlite();
  await db.exec(`SET TIME ZONE 'UTC'`);
  const tables = await createNaiveFixture(db, options);
  await insertFixtureRows(db, tables);
  await db.exec(`SET TIME ZONE 'America/New_York'`);
  return { db, tables };
}

/**
 * Criterion 2, no database: the three wire forms through the #103 shim and through
 * drizzle's real mappers for a zone-less column (old code) and a withTimezone column.
 */
function parseWireForms() {
  const [oldColumn, newColumn] = getTableConfig(
    pgTable("wire_probe", { old: timestamp("old"), tz: timestamp("tz", { withTimezone: true }) })
  ).columns;
  const shim1114 = naiveUtcTypes.getTypeParser(1114, "text");
  const shim1184 = naiveUtcTypes.getTypeParser(1184, "text");
  const forms = {
    naive: "2026-10-23 06:00:03.123",
    utcOffset: "2026-10-23 06:00:03.123+00",
    edtOffset: "2026-10-23 02:00:03.123-04",
  };
  const ms = (v: unknown) => (v as Date).getTime();
  return Object.fromEntries(
    Object.entries(forms).map(([name, text]) => [
      name,
      {
        shim1114: ms(shim1114(text)),
        shim1184: ms(shim1184(text)),
        drizzleOld: ms(oldColumn?.mapFromDriverValue(text)),
        drizzleNew: ms(newColumn?.mapFromDriverValue(text)),
      },
    ])
  );
}

async function main() {
  // Criteria 1, 4, 6, 7 and the AC 8 happy path.
  const { db, tables } = await freshFixture();
  const sessionZone = (await db.query<{ TimeZone: string }>("SHOW timezone")).rows[0]?.TimeZone;
  const before = await snapshot(db, tables);
  const catalogBefore = await catalog(db);
  const nodesBefore = await relfilenodes(db);
  const dry = await dryRunReport(db);
  const first = await apply(db, MIGRATION_SQL, dry.acknowledged);
  const after = await snapshot(db, tables);
  const catalogAfter = await catalog(db);
  const nodesAfter = await relfilenodes(db);
  const second = await apply(db, MIGRATION_SQL, dry.acknowledged, true);
  const afterSecond = await snapshot(db, tables);
  const catalogSecond = await catalog(db);
  const nodesSecond = await relfilenodes(db);

  // Criterion 6: a row with no value gets the current instant.
  const startedMs = Date.now();
  await db.exec(`INSERT INTO automated_ingestion_runs (fixture_row) VALUES (9)`);
  const fresh = (
    await db.query<{ started_ms: string; created_ms: string }>(
      `SELECT (extract(epoch from started_at) * 1000)::bigint::text AS started_ms,
              (extract(epoch from created_at) * 1000)::bigint::text AS created_ms
         FROM automated_ingestion_runs WHERE fixture_row = 9`
    )
  ).rows[0];
  const defaultSkewMs = [Number(fresh?.started_ms) - startedMs, Number(fresh?.created_ms) - startedMs];

  // OID 1184 wire text under a UTC session, read by the project's parsers.
  await db.exec(`SET TIME ZONE 'UTC'`);
  const wire = await db.query<{ started_at: string }>(
    `SELECT started_at FROM automated_ingestion_runs WHERE fixture_row = 1`,
    [],
    { parsers: { 1184: (v: string) => v } }
  );
  const wireText = wire.rows[0]?.started_at ?? "";
  const wireOid = wire.fields[0]?.dataTypeID;
  const startedColumn = getTableConfig(automatedIngestionRuns).columns.find((c) => c.name === "started_at");
  const readers = {
    shim: (naiveUtcTypes.getTypeParser(1184, "text")(wireText) as Date).getTime(),
    drizzle: (startedColumn?.mapFromDriverValue(wireText) as Date).getTime(),
  };
  await db.exec(`SET TIME ZONE 'America/New_York'`);

  // Rollback draft (plan section 5): the original wall clocks come back.
  for (const statement of splitStatements(REVERT_SQL)) await db.query(statement);
  const reverted = await snapshot(db, tables);
  const catalogReverted = await catalog(db);
  const revertedText = (
    await db.query<{ v: string }>(`SELECT started_at::text AS v FROM automated_ingestion_runs WHERE fixture_row IN (1, 3) ORDER BY fixture_row`)
  ).rows.map((r) => r.v);
  await db.close();

  // Criterion 4: a missing table and a missing column are skipped and listed.
  const partial = await freshFixture({ omitTable: "ranking_versions", omitColumn: "news.date" });
  const partialDry = await dryRunReport(partial.db);
  const skipped = await apply(partial.db, MIGRATION_SQL, partialDry.acknowledged);
  const partialCatalog = await catalog(partial.db);
  await partial.db.close();

  // Failure check: a bare cast reads the wall clock in the New York session.
  const bad = await freshFixture();
  const badBefore = await snapshot(bad.db, bad.tables);
  const badSql = MIGRATION_SQL.split("USING %I AT TIME ZONE ''UTC''").join("USING %I::timestamptz");
  const badDry = await dryRunReport(bad.db);
  const badRun = await apply(bad.db, badSql, badDry.acknowledged);
  const badAfter = await snapshot(bad.db, bad.tables);
  await bad.db.close();

  // news.ts getRecentWithin predicate: a value 26h old, window 1 day.
  const win = new PGlite();
  await win.exec(`SET TIME ZONE 'UTC'`);
  await win.exec(`CREATE TABLE articles (published_date timestamp, created_at timestamp DEFAULT now() NOT NULL)`);
  await win.exec(`INSERT INTO articles (published_date) VALUES ((now() AT TIME ZONE 'UTC') - interval '26 hours')`);
  const windowCount = async (zone: string) => {
    await win.exec(`SET TIME ZONE '${zone}'`);
    const r = await win.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM articles WHERE coalesce(published_date, created_at) >= now() - make_interval(days => 1)`
    );
    return r.rows[0]?.n;
  };
  const windowBefore = { UTC: await windowCount("UTC"), NY: await windowCount("America/New_York") };
  await win.exec(`SET TIME ZONE 'America/New_York'`);
  for (const statement of splitStatements(MIGRATION_SQL)) await win.query(statement);
  const windowAfter = { UTC: await windowCount("UTC"), NY: await windowCount("America/New_York") };
  await win.close();

  process.stdout.write(
    JSON.stringify({
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      parse: parseWireForms(),
      sessionZone,
      dryRun: { exitCode: dry.exitCode, executed: dry.executed, report: dry.report },
      first: { exitCode: first.exitCode, executed: first.executed, lines: first.lines },
      second: { exitCode: second.exitCode, executed: second.executed, notices: second.notices },
      before,
      after,
      afterSecond,
      reverted,
      catalogBefore,
      catalogAfter,
      catalogSecond,
      catalogReverted,
      revertedText,
      nodesBefore,
      nodesAfter,
      nodesSecond,
      defaultSkewMs,
      wireText,
      wireOid,
      readers,
      skipped: { exitCode: skipped.exitCode, lines: skipped.lines, notices: skipped.notices, catalog: partialCatalog },
      bad: { exitCode: badRun.exitCode, before: badBefore, after: badAfter },
      windowBefore,
      windowAfter,
    })
  );
}

main().catch((error) => {
  process.stderr.write(String(error instanceof Error ? error.stack : error));
  process.exit(1);
});
