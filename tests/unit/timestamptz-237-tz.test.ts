/**
 * #237: migration 0015 on a real Postgres (PGlite), under TZ=UTC and TZ=America/New_York.
 *
 * Why: the migration's correctness claims are about Postgres zone and catalog behaviour,
 *   and a process's zone is fixed at start, so each zone runs in its own child process
 *   (the #103 pattern in naive-utc-timestamp-tz.test.ts).
 * What: runs tests/unit/fixtures/timestamptz-237-probe.ts once per zone and asserts, in
 *   both: the instant of every value is kept to the microsecond with the ALTER run in an
 *   America/New_York session, NULLs and counts included (criterion 1); OID 1184 text
 *   reads as the same instant through the #103 shim and the drizzle mapper (2); a second
 *   apply changes nothing and rewrites nothing, and a missing table or column is skipped
 *   and listed (4); defaults survive and fill the current instant (6); index names
 *   survive (7). It also checks the dry run wrote nothing, the rollback draft restores
 *   the wall clocks, a bare-cast copy of the file shifts values (the test can fail), and
 *   the news window predicate stops depending on the session zone.
 * Test: `npx vitest run tests/unit/timestamptz-237-tz.test.ts`. No network, no server.
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TIMESTAMPTZ_COLUMNS } from "../../scripts/migration-preflight";

const REPO_ROOT = path.resolve(__dirname, "../..");
const PROBE = path.join(REPO_ROOT, "tests/unit/fixtures/timestamptz-237-probe.ts");
const ZONES = ["UTC", "America/New_York"] as const;
const COLUMN_COUNT = Object.values(TIMESTAMPTZ_COLUMNS).flat().length;

type Snapshot = Record<string, { rows: Array<Record<string, string | number | null>>; counts: Record<string, number> }>;
interface Catalog {
  columns: Array<{ t: string; c: string; data_type: string; column_default: string | null }>;
  indexes: Array<{ indexname: string; indexdef: string }>;
}
interface ProbeOutput {
  tz: string;
  parse: Record<"naive" | "utcOffset" | "edtOffset", { shim1114: number; shim1184: number; drizzleOld: number; drizzleNew: number }>;
  sessionZone: string;
  dryRun: { exitCode: number; executed: number; report: { measurements: { session_timezone: string; missing: string[] } } };
  first: { exitCode: number; executed: number; lines: string[] };
  second: { exitCode: number; executed: number; notices: string[] };
  before: Snapshot;
  after: Snapshot;
  afterSecond: Snapshot;
  reverted: Snapshot;
  catalogBefore: Catalog;
  catalogAfter: Catalog;
  catalogSecond: Catalog;
  catalogReverted: Catalog;
  revertedText: string[];
  nodesBefore: Record<string, number>;
  nodesAfter: Record<string, number>;
  nodesSecond: Record<string, number>;
  defaultSkewMs: number[];
  wireText: string;
  wireOid: number;
  readers: { shim: number; drizzle: number };
  skipped: { exitCode: number; lines: string[]; notices: string[]; catalog: Catalog };
  bad: { exitCode: number; before: Snapshot; after: Snapshot };
  windowBefore: { UTC: number; NY: number };
  windowAfter: { UTC: number; NY: number };
}

function probe(tz: string): ProbeOutput {
  const child = spawnSync(process.execPath, ["--import", "tsx", PROBE], {
    cwd: REPO_ROOT,
    env: { ...process.env, TZ: tz },
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  expect(child.status, child.stderr).toBe(0);
  return JSON.parse(child.stdout) as ProbeOutput;
}

/** Rows 1-3 only: the probe inserts row 9 after the apply to test defaults. */
function fixtureRows(snapshot: Snapshot): Snapshot {
  return Object.fromEntries(
    Object.entries(snapshot).map(([table, s]) => [table, { ...s, rows: s.rows.filter((r) => Number(r["fixture_row"]) <= 3) }])
  );
}

/** Rows 1 and 3 hold literal values; row 2 holds DEFAULT now(), which differs per run. */
function knownRows(snapshot: Snapshot): Snapshot {
  return Object.fromEntries(
    Object.entries(snapshot).map(([table, s]) => [table, { ...s, rows: s.rows.filter((r) => [1, 3].includes(Number(r["fixture_row"]))) }])
  );
}

const INSTANT_MS = 1792735203123; // 2026-10-23T06:00:03.123Z
const SUMMER_US = String(INSTANT_MS * 1000 + 456);

describe("#237 migration 0015 under two process time zones", () => {
  const outputs = Object.fromEntries(ZONES.map((tz) => [tz, probe(tz)])) as Record<(typeof ZONES)[number], ProbeOutput>;

  it.each(ZONES)("%s: runs the probe in that zone, with the ALTER in an America/New_York session", (tz) => {
    expect(outputs[tz].tz).toBe(tz);
    expect(outputs[tz].sessionZone).toBe("America/New_York");
  });

  it.each(ZONES)("%s: criterion 1 — every value keeps its instant to the microsecond, NULLs and counts too", (tz) => {
    const o = outputs[tz];
    expect(o.first.exitCode, o.first.lines.join("\n")).toBe(0);
    expect(o.after).toEqual(o.before);
    expect(o.before["automated_ingestion_runs"]?.rows[0]?.["started_at"]).toBe(SUMMER_US);
    expect(o.after["automated_ingestion_runs"]?.rows[1]?.["completed_at"]).toBeNull();
  });

  it.each(ZONES)("%s: every in-scope column is timestamptz after the apply", (tz) => {
    const o = outputs[tz];
    expect(o.catalogBefore.columns.every((c) => c.data_type === "timestamp without time zone")).toBe(true);
    expect(o.catalogAfter.columns).toHaveLength(COLUMN_COUNT);
    expect(o.catalogAfter.columns.every((c) => c.data_type === "timestamp with time zone")).toBe(true);
    expect(o.first.lines).toContain(`  converted ${COLUMN_COUNT} column(s); skipped 0: none`);
  });

  it.each(ZONES)("%s: criterion 2 — OID 1184 text reads as the same instant via the shim and drizzle", (tz) => {
    const o = outputs[tz];
    expect(o.wireOid).toBe(1184);
    expect(o.wireText).toBe("2026-10-23 06:00:03.123456+00");
    expect(o.readers).toEqual({ shim: 1792735203123, drizzle: 1792735203123 });
  });

  it.each(ZONES)("%s: criterion 4 — a second apply succeeds, changes nothing and rewrites no table", (tz) => {
    const o = outputs[tz];
    expect(o.second.exitCode).toBe(0);
    expect(o.second.executed).toBe(14);
    expect(o.second.notices).toHaveLength(COLUMN_COUNT);
    expect(o.second.notices.every((n) => /^#237 skip [a-z_]+\.[a-z_]+: already timestamp with time zone$/.test(n))).toBe(true);
    expect(o.afterSecond).toEqual(o.after);
    expect(o.catalogSecond).toEqual(o.catalogAfter);
    expect(o.nodesSecond).toEqual(o.nodesAfter);
  });

  it.each(ZONES)("%s: criterion 4 — a missing table and a missing column are skipped and listed", (tz) => {
    const s = outputs[tz].skipped;
    expect(s.exitCode, s.lines.join("\n")).toBe(0);
    expect(s.notices).toEqual(["#237 skip news.date: column missing", "#237 skip ranking_versions: table missing"]);
    expect(s.lines).toContain(`  converted ${COLUMN_COUNT - 2} column(s); skipped 2: news.date, ranking_versions.created_at`);
    expect(s.catalog.columns.every((c) => c.data_type === "timestamp with time zone")).toBe(true);
  });

  it.each(ZONES)("%s: criterion 6 — DEFAULT now() survives and fills the current instant", (tz) => {
    const o = outputs[tz];
    const defaults = (c: Catalog) => c.columns.map((col) => `${col.t}.${col.c}=${col.column_default}`);
    expect(defaults(o.catalogAfter)).toEqual(defaults(o.catalogBefore));
    // 29 defaulted columns in the schema (the plan's table counted 25).
    expect(o.catalogAfter.columns.filter((c) => c.column_default === "now()")).toHaveLength(29);
    for (const skew of o.defaultSkewMs) expect(Math.abs(skew)).toBeLessThan(60_000);
  });

  it.each(ZONES)("%s: criterion 7 — every index keeps its name and its timestamp column", (tz) => {
    const o = outputs[tz];
    expect(o.catalogAfter.indexes).toEqual(o.catalogBefore.indexes);
    const names = o.catalogAfter.indexes.map((i) => i.indexname);
    for (const name of [
      "tools_created_at_idx",
      "tools_updated_at_idx",
      "rankings_published_idx",
      "news_published_idx",
      "news_created_at_idx",
      "monthly_summaries_generated_at_idx",
      "state_of_ai_summaries_generated_at_idx",
      "idx_automated_ingestion_runs_created_at",
      "idx_articles_published_date",
      "idx_articles_ingested_at",
      "idx_article_processing_created",
      "idx_ranking_versions_created_at",
    ]) {
      expect(names).toContain(name);
    }
  });

  it.each(ZONES)("%s: the type change rewrites each table once (relfilenode measured)", (tz) => {
    const o = outputs[tz];
    const changed = Object.keys(o.nodesBefore).filter((t) => o.nodesBefore[t] !== o.nodesAfter[t]);
    expect(changed.sort()).toEqual(Object.keys(TIMESTAMPTZ_COLUMNS).sort());
  });

  it.each(ZONES)("%s: criterion 8 — the dry run measured the session zone and wrote nothing", (tz) => {
    const d = outputs[tz].dryRun;
    expect(d.exitCode).toBe(0);
    expect(d.executed).toBe(0);
    expect(d.report.measurements.session_timezone).toBe("UTC");
    // #237: the apply prints the zone the acknowledged report measured.
    expect(outputs[tz].first.lines).toContain(
      `\nPreflight report for 0015_timestamptz_utc.sql: acknowledged, measured on this database; measured session TimeZone UTC; TimeZone overrides: none.`
    );
    expect(d.report.measurements.missing).toEqual([]);
  });

  it.each(ZONES)("%s: the rollback draft restores the original wall clocks", (tz) => {
    const o = outputs[tz];
    expect(o.catalogReverted.columns.every((c) => c.data_type === "timestamp without time zone")).toBe(true);
    const rowsOf = (s: Snapshot) => Object.fromEntries(Object.entries(fixtureRows(s)).map(([t, v]) => [t, v.rows]));
    expect(rowsOf(o.reverted)).toEqual(rowsOf(o.before));
    expect(o.revertedText).toEqual(["2026-10-23 06:00:03.123456", "2026-01-15 23:59:59.999999"]);
  });

  it.each(ZONES)("%s: a bare cast in place of AT TIME ZONE 'UTC' shifts every value (the check can fail)", (tz) => {
    const b = outputs[tz].bad;
    expect(b.exitCode).toBe(0);
    expect(b.after).not.toEqual(b.before);
    // 06:00:03 UTC wall clock read as EDT is 10:00:03 UTC: four hours late.
    expect(Number(b.after["tools"]?.rows[0]?.["created_at"]) - Number(b.before["tools"]?.rows[0]?.["created_at"])).toBe(
      4 * 3600 * 1_000_000
    );
  });

  it.each(ZONES)("%s: the news window predicate no longer depends on the session zone", (tz) => {
    const o = outputs[tz];
    // Before: a 26h-old zone-less value is inside a 1-day window in a New York session.
    expect(o.windowBefore).toEqual({ UTC: 0, NY: 1 });
    expect(o.windowAfter).toEqual({ UTC: 0, NY: 0 });
  });

  it.each(ZONES)("%s: criterion 2 — the shim reads all three wire forms as the same instant", (tz) => {
    const p = outputs[tz].parse;
    for (const form of ["naive", "utcOffset", "edtOffset"] as const) {
      expect(p[form].shim1114, form).toBe(INSTANT_MS);
    }
    // OID 1184 stays on the driver default, which reads the offset (criterion 3c).
    expect(p.utcOffset.shim1184).toBe(INSTANT_MS);
    expect(p.edtOffset.shim1184).toBe(INSTANT_MS);
  });

  it.each(ZONES)("%s: criterion 2 — the withTimezone drizzle mapper reads offset text as the instant", (tz) => {
    const p = outputs[tz].parse;
    expect(p.utcOffset.drizzleNew).toBe(INSTANT_MS);
    expect(p.edtOffset.drizzleNew).toBe(INSTANT_MS);
    // Deploy window (plan section 3): new code on a still-naive column reads the process
    // zone. Correct on a UTC runtime only.
    expect(p.naive.drizzleNew).toBe(tz === "UTC" ? INSTANT_MS : INSTANT_MS + 4 * 3600_000);
  });

  it.each(ZONES)("%s: pin — the old zone-less mapper reads `+00` text correctly but not `-04`", (tz) => {
    const p = outputs[tz].parse;
    expect(p.naive.drizzleOld).toBe(INSTANT_MS);
    // V8 ignores the appended `+0000` after `+00`: old code on a migrated column is right
    // while the database session zone is UTC.
    expect(p.utcOffset.drizzleOld).toBe(INSTANT_MS);
    // ...but after a `-04` offset the appended `+0000` wins and the offset is dropped:
    // four hours early. Old code needs a UTC session (the preflight report measures it).
    expect(p.edtOffset.drizzleOld).toBe(INSTANT_MS - 4 * 3600_000);
  });

  it("gives identical results in both process zones", () => {
    const strip = (o: ProbeOutput) => ({
      before: knownRows(o.before),
      after: knownRows(o.after),
      catalogAfter: o.catalogAfter,
      readers: o.readers,
      notices: o.skipped.notices,
    });
    expect(strip(outputs["America/New_York"])).toEqual(strip(outputs.UTC));
  });
});
