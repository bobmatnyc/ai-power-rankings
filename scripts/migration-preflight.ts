/**
 * Read-only preflight report and apply gate for migrations that rewrite tables.
 *
 * Why: #237 — migration 0015 rewrites 14 tables under ACCESS EXCLUSIVE locks, and the
 *   production row counts, table sizes and session `TimeZone` are unknown. Nobody may
 *   apply it on unknowns (acceptance criterion 8): the apply must refuse unless a
 *   read-only report of those measurements exists for the same database and has been
 *   acknowledged. A missing, unreadable or mismatched report refuses; it never warns
 *   and continues.
 * What: `PREFLIGHT_REQUIRED` names the gated migration files. `measurePreflight` runs
 *   SELECT/SHOW statements only (asserted per statement, and run by the adapter in a
 *   READ ONLY transaction) and returns the report the dry run prints.
 *   `checkPreflightReport` decides whether a committed report lets the apply proceed.
 *   `summarizeConversion` reads the catalog after the apply so skipped columns are listed
 *   and an unconverted one fails the run.
 * Test: `tests/unit/timestamptz-237-preflight.test.ts`, and the PGlite run per process
 *   zone in `tests/unit/timestamptz-237-tz.test.ts`.
 */

import { createHash } from "crypto";
import fs from "fs";
import path from "path";

export const TIMESTAMPTZ_MIGRATION = "0015_timestamptz_utc.sql";

/**
 * #237: every timestamp column 0015 converts, in schema order. The parity test holds this
 * list equal to the drizzle schema and to the migration file.
 */
export const TIMESTAMPTZ_COLUMNS: Readonly<Record<string, readonly string[]>> = {
  tools: ["score_updated_at", "created_at", "updated_at"],
  rankings: ["published_at", "created_at", "updated_at"],
  news: ["published_at", "date", "created_at", "updated_at"],
  companies: ["created_at", "updated_at"],
  migrations: ["started_at", "completed_at", "created_at"],
  monthly_summaries: ["generated_at", "created_at", "updated_at"],
  state_of_ai_summaries: ["generated_at", "created_at", "updated_at"],
  automated_ingestion_runs: ["started_at", "completed_at", "created_at"],
  tool_metrics_history: ["created_at", "updated_at"],
  metrics_collection_runs: ["started_at", "finished_at", "created_at", "updated_at"],
  articles: ["published_date", "ingested_at", "processed_at", "created_at", "updated_at"],
  article_rankings_changes: ["applied_at", "rolled_back_at", "created_at"],
  article_processing_logs: ["started_at", "completed_at", "created_at"],
  ranking_versions: ["created_at"],
};

export interface PreflightSpec {
  /** Table → columns the migration converts. */
  columns: Readonly<Record<string, readonly string[]>>;
  /** `information_schema.columns.data_type` every listed column must have after the apply. */
  targetType: string;
  /** The type the migration converts from; any third type is "present, other type". */
  sourceType: string;
}

/** #237: migrations whose apply is refused without an acknowledged preflight report. */
export const PREFLIGHT_REQUIRED: Readonly<Record<string, PreflightSpec>> = {
  [TIMESTAMPTZ_MIGRATION]: {
    columns: TIMESTAMPTZ_COLUMNS,
    targetType: "timestamp with time zone",
    sourceType: "timestamp without time zone",
  },
};

/** Committed, acknowledged reports live here: `<dir>/<migration>.report.json`. */
export const PREFLIGHT_REPORT_DIR = "lib/db/preflight";
export const REPORT_KIND = "migration-preflight-report";
export const REPORT_VERSION = 1;

/** Runs SELECT/SHOW statements in one READ ONLY transaction; one row array per statement. */
export type ReadOnlyQuery = (statements: string[]) => Promise<Record<string, unknown>[][]>;

export interface PreflightReport {
  kind: typeof REPORT_KIND;
  version: typeof REPORT_VERSION;
  migration: string;
  database_fingerprint: string;
  measured_at: string;
  measurements: PreflightMeasurements;
  acknowledged: { by: string; at: string } | null;
}

export interface TableCounts {
  rows: number;
  newest_created_at: string | null;
  columns: Record<string, { non_null: number; infinite: number }>;
}

export interface TimezoneOverride {
  scope: "database-level" | "role-level" | "role-in-database-level";
  timezone: string;
}

export interface PreflightMeasurements {
  session_timezone: string;
  now_tstz: string;
  now_naive: string;
  now_utc_naive: string;
  /**
   * TimeZone settings that apply to this database or the connecting role, labelled by
   * scope only. #237: no database or role name and no other setting text, because the
   * report and the job log are public.
   */
  timezone_overrides: TimezoneOverride[];
  public_tables: string[];
  timestamp_columns: Record<string, unknown>[];
  sizes: Record<string, unknown>[];
  row_counts: Record<string, TableCounts>;
  /** In-scope tables or `table.column` entries the catalog does not have. */
  missing: string[];
  /** #237: in-scope columns that exist with a non-timestamp type, as `table.column (type)`. */
  other_type: string[];
}

const IDENTIFIER = /^[a-z_][a-z0-9_]*$/;
const READ_ONLY_SQL = /^\s*(SELECT|SHOW)\b/i;

/**
 * #237: refuses any statement that is not a single SELECT or SHOW.
 *
 * Why: the dry run must not write. The adapter's READ ONLY transaction enforces that on
 *   the server; this check stops a write from being built at all.
 * What: throws unless the text starts with SELECT or SHOW and holds no `;` other than a
 *   trailing one.
 * Test: `assertReadOnlySql` cases in tests/unit/timestamptz-237-preflight.test.ts.
 */
export function assertReadOnlySql(statement: string): void {
  const body = statement.trim().replace(/;$/, "");
  if (!READ_ONLY_SQL.test(body) || body.includes(";")) {
    throw new Error(`preflight: refusing a statement that is not a single SELECT/SHOW: ${body.slice(0, 60)}`);
  }
}

function ident(name: string): string {
  if (!IDENTIFIER.test(name)) {
    throw new Error(`preflight: not a plain identifier: ${JSON.stringify(name)}`);
  }
  return `"${name}"`;
}

/** The catalog and session statements, in the order `measurePreflight` reads them. */
export const CATALOG_STATEMENTS: readonly string[] = [
  "SHOW timezone",
  "SELECT current_setting('TimeZone') AS tz, now()::text AS now_tstz, now()::timestamp::text AS now_naive, (now() AT TIME ZONE 'UTC')::text AS now_utc_naive",
  // #237: TimeZone overrides for this database and the connecting role only, as a fixed
  // scope label and the zone. Never the database or role name, never other settings.
  "SELECT CASE WHEN s.setdatabase <> 0 AND s.setrole <> 0 THEN 'role-in-database-level' WHEN s.setdatabase <> 0 THEN 'database-level' ELSE 'role-level' END AS scope, substr(c, 10) AS timezone FROM pg_db_role_setting s CROSS JOIN LATERAL unnest(s.setconfig) AS c WHERE lower(c) LIKE 'timezone=%' AND s.setdatabase IN (0, (SELECT oid FROM pg_database WHERE datname = current_database())) AND s.setrole IN (0, (SELECT oid FROM pg_roles WHERE rolname = current_user)) ORDER BY 1, 2",
  "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1",
  // #237: no type filter, so an in-scope column with another type is seen as present.
  "SELECT table_name, column_name, data_type, column_default, is_nullable FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position",
  "SELECT relname, pg_total_relation_size(oid)::text AS total_bytes, pg_relation_size(oid)::text AS heap_bytes FROM pg_class WHERE relkind = 'r' AND relnamespace = 'public'::regnamespace ORDER BY pg_total_relation_size(oid) DESC",
];

/**
 * #237: one count statement per present in-scope table: rows, `count(col)` and
 * infinity values per present column, and the newest `created_at` as text.
 */
export function countStatement(table: string, columns: readonly string[]): string {
  const parts = ["count(*)::text AS row_total"];
  for (const column of columns) {
    parts.push(`count(${ident(column)})::text AS ${ident(`nn_${column}`)}`);
    parts.push(
      `count(*) FILTER (WHERE ${ident(column)} IN ('infinity', '-infinity'))::text AS ${ident(`inf_${column}`)}`
    );
  }
  parts.push(columns.includes("created_at") ? "max(created_at)::text AS newest_created_at" : "NULL::text AS newest_created_at");
  return `SELECT ${parts.join(", ")} FROM public.${ident(table)}`;
}

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

/**
 * #237: measures what criterion 8 requires before the apply, SELECT/SHOW only.
 *
 * What: reads the session zone, role/database zone overrides, the public table list, the
 *   timestamp column types and the table sizes, then counts rows, non-null values and
 *   infinity values for every in-scope column the catalog has. In-scope tables or
 *   columns the catalog lacks go to `missing`. `acknowledged` is always null here; the
 *   Architect fills it in the committed copy.
 * Test: tests/unit/timestamptz-237-preflight.test.ts ("carries no database or role name",
 *   "present with another type") and tests/unit/timestamptz-237-tz.test.ts (dry run).
 */
export async function measurePreflight(
  query: ReadOnlyQuery,
  migration: string,
  spec: PreflightSpec,
  databaseFingerprint: string,
  now: Date = new Date()
): Promise<PreflightReport> {
  for (const statement of CATALOG_STATEMENTS) assertReadOnlySql(statement);
  const [show, session, roles, tables, columns, sizes] = await query([...CATALOG_STATEMENTS]);
  const present = new Set((tables ?? []).map((row) => text(row["table_name"])));
  const typeOf = new Map((columns ?? []).map((row) => [`${text(row["table_name"])}.${text(row["column_name"])}`, text(row["data_type"])]));
  const inScope = new Set(Object.entries(spec.columns).flatMap(([table, cols]) => cols.map((c) => `${table}.${c}`)));

  const missing: string[] = [];
  const otherType: string[] = [];
  const counted: Array<[string, string[]]> = [];
  for (const [table, wanted] of Object.entries(spec.columns)) {
    if (!present.has(table)) {
      missing.push(table);
      continue;
    }
    const have: string[] = [];
    for (const column of wanted) {
      const type = typeOf.get(`${table}.${column}`);
      if (type === undefined) missing.push(`${table}.${column}`);
      else if (type.startsWith("timestamp")) have.push(column);
      else otherType.push(`${table}.${column} (${type})`);
    }
    counted.push([table, have]);
  }

  const countSql = counted.map(([table, have]) => countStatement(table, have));
  for (const statement of countSql) assertReadOnlySql(statement);
  const countRows = countSql.length > 0 ? await query(countSql) : [];

  const rowCounts: Record<string, TableCounts> = {};
  counted.forEach(([table, have], index) => {
    const row = countRows[index]?.[0] ?? {};
    const perColumn: TableCounts["columns"] = {};
    for (const column of have) {
      perColumn[column] = { non_null: Number(row[`nn_${column}`]), infinite: Number(row[`inf_${column}`]) };
    }
    const newest = row["newest_created_at"];
    rowCounts[table] = {
      rows: Number(row["row_total"]),
      newest_created_at: newest === null || newest === undefined ? null : String(newest),
      columns: perColumn,
    };
  });

  const sessionRow = session?.[0] ?? {};
  return {
    kind: REPORT_KIND,
    version: REPORT_VERSION,
    migration,
    database_fingerprint: databaseFingerprint,
    measured_at: now.toISOString(),
    measurements: {
      session_timezone: text(show?.[0]?.["TimeZone"] ?? show?.[0]?.["timezone"] ?? sessionRow["tz"]),
      now_tstz: text(sessionRow["now_tstz"]),
      now_naive: text(sessionRow["now_naive"]),
      now_utc_naive: text(sessionRow["now_utc_naive"]),
      timezone_overrides: (roles ?? []).map((row) => ({
        scope: text(row["scope"]) as TimezoneOverride["scope"],
        timezone: text(row["timezone"]),
      })),
      public_tables: [...present],
      timestamp_columns: (columns ?? []).filter(
        (row) =>
          text(row["data_type"]).startsWith("timestamp") || inScope.has(`${text(row["table_name"])}.${text(row["column_name"])}`)
      ),
      sizes: sizes ?? [],
      row_counts: rowCounts,
      missing,
      other_type: otherType,
    },
    acknowledged: null,
  };
}

/** #237: zone names Postgres treats as UTC, lower-cased. */
const UTC_ZONES = new Set(
  ["utc", "uct", "gmt", "gmt0", "gmt+0", "gmt-0", "greenwich", "universal", "zulu"].flatMap((z) => [z, `etc/${z}`])
);

/** #237: true when `zone` names UTC (UTC, Etc/UTC, GMT, Zulu, ...), case-insensitively. */
export function isUtcZone(zone: string): boolean {
  return UTC_ZONES.has(zone.trim().toLowerCase());
}

/** #237: `role-level=America/New_York, ...`, or `none`. */
export function describeOverrides(overrides: readonly TimezoneOverride[]): string {
  return overrides.length === 0 ? "none" : overrides.map((o) => `${o.scope}=${o.timezone}`).join(", ");
}

export type ReportVerdict ={ ok: true; report: PreflightReport } | { ok: false; reason: string };

function isDateText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value));
}

/**
 * #237: decides whether a committed preflight report lets a gated apply run.
 *
 * Why: criterion 8 — an apply with no reported measurements must not proceed, and a
 *   report for another database or another migration is no report at all.
 * What: `raw` is the file text, or null when there is none. Returns ok only when the text
 *   parses as a v1 report for `migration` and `fingerprint`, carries the measurements
 *   (session zone and row counts), measured a UTC session zone with no TimeZone override,
 *   and has `acknowledged.by` plus an `acknowledged.at` no earlier than `measured_at`.
 *   Every other input gives `ok: false` with the reason.
 * Test: `checkPreflightReport` cases in tests/unit/timestamptz-237-preflight.test.ts.
 */
export function checkPreflightReport(raw: string | null, migration: string, fingerprint: string | null): ReportVerdict {
  if (fingerprint === null || fingerprint.length === 0) {
    return { ok: false, reason: "this database has no fingerprint (DATABASE_URL missing or unparseable)" };
  }
  if (raw === null) return { ok: false, reason: "no preflight report on file" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "the preflight report is not valid JSON" };
  }
  if (typeof parsed !== "object" || parsed === null) return { ok: false, reason: "the preflight report is not an object" };
  const report = parsed as Partial<PreflightReport>;

  if (report.kind !== REPORT_KIND || report.version !== REPORT_VERSION) {
    return { ok: false, reason: `the preflight report is not a ${REPORT_KIND} v${REPORT_VERSION}` };
  }
  if (report.migration !== migration) {
    return { ok: false, reason: `the preflight report is for ${String(report.migration)}, not ${migration}` };
  }
  if (report.database_fingerprint !== fingerprint) {
    return { ok: false, reason: "the preflight report was measured on a different database (fingerprint mismatch)" };
  }
  if (!isDateText(report.measured_at)) return { ok: false, reason: "the preflight report has no valid measured_at" };
  const m = report.measurements;
  if (typeof m !== "object" || m === null || typeof m.session_timezone !== "string" || m.session_timezone === "") {
    return { ok: false, reason: "the preflight report has no session_timezone measurement" };
  }
  if (typeof m.row_counts !== "object" || m.row_counts === null) {
    return { ok: false, reason: "the preflight report has no row_counts measurement" };
  }
  // #237: `DEFAULT now()` rows hold the session wall clock, and 0015 reads every value as
  // UTC. That is only right when the session zone was UTC with nothing overriding it.
  if (!isUtcZone(m.session_timezone)) {
    return { ok: false, reason: `the measured session TimeZone is ${m.session_timezone}, not UTC; 0015 needs a re-plan` };
  }
  if (!Array.isArray(m.timezone_overrides)) {
    return { ok: false, reason: "the preflight report has no timezone_overrides measurement" };
  }
  if (m.timezone_overrides.length > 0) {
    return { ok: false, reason: `TimeZone overrides are set (${describeOverrides(m.timezone_overrides)}); 0015 needs a re-plan` };
  }
  const ack = report.acknowledged;
  if (typeof ack !== "object" || ack === null || typeof ack.by !== "string" || ack.by.trim() === "") {
    return { ok: false, reason: "the preflight report is not acknowledged (acknowledged.by is empty)" };
  }
  if (!isDateText(ack.at) || Date.parse(ack.at) < Date.parse(report.measured_at)) {
    return { ok: false, reason: "the preflight report's acknowledged.at is missing or earlier than measured_at" };
  }
  return { ok: true, report: report as PreflightReport };
}

/**
 * #237: a stable, one-way identifier for the target database.
 *
 * Why: "the same database" must be checkable from a report committed to a public repo,
 *   which may carry no host, user or password.
 * What: `sha256:` plus 16 hex digits of a SHA-256 over a fixed label, the host and the
 *   database name. The password and query string are not part of it, so a credential
 *   rotation keeps the fingerprint. Returns null for a missing or unparseable URL.
 * Test: `databaseFingerprint` cases in tests/unit/timestamptz-237-preflight.test.ts.
 */
export function databaseFingerprint(url: string | undefined): string | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!parsed.hostname) return null;
  const digest = createHash("sha256")
    .update(`ai-power-rankings migration preflight\n${parsed.hostname.toLowerCase()}\n${parsed.pathname.replace(/^\//, "")}`)
    .digest("hex");
  return `sha256:${digest.slice(0, 16)}`;
}

/** Reads `<dir>/<migration>.report.json`; null when absent. A read error propagates. */
export function createReportSource(dir = path.join(process.cwd(), PREFLIGHT_REPORT_DIR)) {
  return {
    read(migration: string): string | null {
      const file = path.join(dir, `${migration}.report.json`);
      return fs.existsSync(file) ? fs.readFileSync(file, "utf-8") : null;
    },
  };
}

export interface ConversionSummary {
  converted: string[];
  skipped: string[];
  /** Present, still in the source type. */
  unconverted: string[];
  /** #237: present with a type that is neither source nor target. Fails like unconverted. */
  otherType: string[];
}

/**
 * #237: what the guarded migration did, read back from the catalog.
 *
 * Why: the migration skips a missing table or column with a NOTICE, and the HTTP driver
 *   does not surface notices. A skip must still show in the apply summary, and a present
 *   column left in the old type must fail the run rather than report success.
 * What: `rows` are `information_schema.columns` rows (table_name, column_name,
 *   data_type), read with no type filter. Each spec column is converted (target type),
 *   skipped (absent), unconverted (still the source type) or otherType (present with any
 *   other type).
 * Test: `summarizeConversion` cases in tests/unit/timestamptz-237-preflight.test.ts.
 */
export function summarizeConversion(spec: PreflightSpec, rows: Record<string, unknown>[]): ConversionSummary {
  const types = new Map(rows.map((row) => [`${text(row["table_name"])}.${text(row["column_name"])}`, text(row["data_type"])]));
  const summary: ConversionSummary = { converted: [], skipped: [], unconverted: [], otherType: [] };
  for (const [table, columns] of Object.entries(spec.columns)) {
    for (const column of columns) {
      const key = `${table}.${column}`;
      const type = types.get(key);
      if (type === undefined) summary.skipped.push(key);
      else if (type === spec.targetType) summary.converted.push(key);
      else if (type === spec.sourceType) summary.unconverted.push(`${key} (${type})`);
      else summary.otherType.push(`${key} (${type})`);
    }
  }
  return summary;
}

/**
 * #237: why a finished apply must not be recorded, or [] when it may.
 *
 * Why: a skip is only acceptable when the acknowledged report already measured that table
 *   or column as missing; anything else is a surprise the Architect never saw. An apply
 *   that converted nothing did nothing, whatever the catalog says.
 * What: fails on a present column still in the source type or in another type, on a
 *   skipped `table.column` that the report's `missing` lists neither as itself nor as its
 *   table, and on zero converted columns.
 * Test: `conversionFailures` cases in tests/unit/timestamptz-237-preflight.test.ts.
 */
export function conversionFailures(summary: ConversionSummary, report: PreflightReport): string[] {
  const failures: string[] = [];
  const failed = [...summary.unconverted, ...summary.otherType];
  if (failed.length > 0) failures.push(`left ${failed.length} column(s) unconverted: ${failed.join(", ")}`);
  const measured = new Set(report.measurements.missing);
  const unexpected = summary.skipped.filter((key) => !measured.has(key) && !measured.has(key.split(".")[0] as string));
  if (unexpected.length > 0) {
    failures.push(`skipped ${unexpected.length} column(s) the acknowledged report did not measure as missing: ${unexpected.join(", ")}`);
  }
  if (summary.converted.length === 0) failures.push("converted 0 columns");
  return failures;
}

/** Catalog read for `summarizeConversion`. */
export const CONVERSION_STATEMENT =
  "SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public'";
