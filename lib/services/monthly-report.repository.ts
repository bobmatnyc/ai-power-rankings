/**
 * The database boundary of the monthly report (#182).
 *
 * Why: #182 merges the two monthly generators into one and keeps every
 *   generated version (#114). The merged generator writes only
 *   `monthly_report_versions`, append-only. The predecessor tables
 *   `monthly_summaries` and `state_of_ai_summaries` keep their existing rows
 *   readable, and no code path writes to them any more.
 * What: The readers return the newest version of a period from
 *   `monthly_report_versions` and fall back to the period's
 *   `monthly_summaries` row only when the period has no version. A legacy row
 *   reads as version 0. `appendReportVersion` inserts the period's next
 *   version and never updates a row; a concurrent insert of the same version
 *   fails on the unique `(period, version)` index instead of overwriting.
 *   Every function throws when the database is unavailable or a read fails,
 *   never an empty result (#162). One exception: a read of
 *   `monthly_report_versions` that fails because the table does not exist yet
 *   (SQLSTATE 42P01, migration 0031 not applied) counts as "no versions" and
 *   is logged as a degradation, so the legacy content is served as before
 *   #182. `appendReportVersion` still throws then. None needs an OpenRouter
 *   key (#54).
 * Test: `tests/unit/monthly-report-182.test.ts`,
 *   `tests/unit/monthly-report-missing-table-182.test.ts`,
 *   `tests/unit/whats-new-auto-regenerate.test.ts`,
 *   `tests/unit/whats-new-permalink.test.ts`.
 */

import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/connection";
import { loggers } from "@/lib/logger";
import {
  type MonthlyReportVersion,
  type MonthlySummary,
  type NewMonthlyReportVersion,
  monthlyReportVersions,
  monthlySummaries,
} from "@/lib/db/schema";

/**
 * A stored monthly report: the `MonthlySummary` shape plus its version and
 * who generated it. A legacy `monthly_summaries` row is version 0.
 */
export type StoredMonthlyReport = MonthlySummary & { version: number; generatedBy: string };

/** One stored summary period and when its newest content was written (#54). */
export interface StoredSummaryPeriod {
  period: string;
  updatedAt: Date;
}

/** One retrievable version of a period's report, newest first in listings. */
export interface StoredReportVersionInfo {
  period: string;
  version: number;
  generatedAt: Date;
  generatedBy: string;
  /** "legacy" is the read-only `monthly_summaries` row, version 0. */
  source: "versions" | "legacy";
}

/** Generator name recorded on a legacy `monthly_summaries` row, which has no such column. */
const LEGACY_GENERATED_BY = "legacy:monthly_summaries";

function requireDb(): NonNullable<ReturnType<typeof getDb>> {
  const db = getDb();
  if (!db) {
    throw new Error("Database connection not available");
  }
  return db;
}

/**
 * Maps a version row to the summary shape the pages read. `createdAt` is the
 * period's first version (datePublished); `updatedAt` is this version's
 * generation time (dateModified, sitemap lastmod).
 */
function toReport(row: MonthlyReportVersion, firstCreatedAt: Date): StoredMonthlyReport {
  return {
    id: row.id,
    period: row.period,
    content: row.content,
    dataHash: row.dataHash,
    metadata: row.metadata,
    generatedAt: row.generatedAt,
    createdAt: firstCreatedAt,
    updatedAt: row.generatedAt,
    version: row.version,
    generatedBy: row.generatedBy,
  };
}

function legacyReport(row: MonthlySummary): StoredMonthlyReport {
  return { ...row, version: 0, generatedBy: LEGACY_GENERATED_BY };
}

/** Postgres SQLSTATE `undefined_table`. */
const UNDEFINED_TABLE = "42P01";

/** True when `error` (or its `cause`) carries SQLSTATE 42P01. */
export function isUndefinedTableError(error: unknown): boolean {
  const codeOf = (value: unknown): unknown =>
    value && typeof value === "object" ? (value as { code?: unknown }).code : undefined;
  const cause = error && typeof error === "object" ? (error as { cause?: unknown }).cause : undefined;
  return codeOf(error) === UNDEFINED_TABLE || codeOf(cause) === UNDEFINED_TABLE;
}

/**
 * Runs a read of `monthly_report_versions`. #182: before migration 0031 is
 * applied the table does not exist; that one error reads as no rows, so the
 * legacy tables are served unchanged. Any other error is rethrown (#162).
 */
async function readVersionsTable<T>(operation: string, read: () => Promise<T[]>): Promise<T[]> {
  try {
    return await read();
  } catch (error) {
    if (!isUndefinedTableError(error)) throw error;
    loggers.api.warn("monthly_report_versions is missing; serving pre-#182 monthly reports", {
      operation,
      degradation: "monthly-report-versions-table-missing",
    });
    return [];
  }
}

async function readLegacyRow(period: string): Promise<MonthlySummary | null> {
  const rows = await requireDb()
    .select()
    .from(monthlySummaries)
    .where(eq(monthlySummaries.period, period))
    .limit(1);
  return rows[0] ?? null;
}

async function readVersionRows(period: string): Promise<MonthlyReportVersion[]> {
  const db = requireDb();
  return readVersionsTable("readVersionRows", () =>
    db
      .select()
      .from(monthlyReportVersions)
      .where(eq(monthlyReportVersions.period, period))
      .orderBy(desc(monthlyReportVersions.version))
  );
}

/**
 * The newest stored report for `period` (`YYYY-MM`), or null when the period
 * has neither a version nor a legacy row. Never falls back to another period
 * and never generates.
 */
export async function getStoredSummary(period: string): Promise<StoredMonthlyReport | null> {
  const versions = await readVersionRows(period);
  const newest = versions[0];
  if (newest) {
    return toReport(newest, versions[versions.length - 1]!.createdAt);
  }
  const legacy = await readLegacyRow(period);
  return legacy ? legacyReport(legacy) : null;
}

/** The newest report of the latest stored period, or null; throws on a failed read (#54). */
export async function getLatestStoredSummary(): Promise<StoredMonthlyReport | null> {
  const db = requireDb();
  const [newestVersion] = await readVersionsTable("getLatestStoredSummary", () =>
    db
      .select({ period: monthlyReportVersions.period })
      .from(monthlyReportVersions)
      .orderBy(desc(monthlyReportVersions.period))
      .limit(1)
  );
  const [legacy] = await db
    .select()
    .from(monthlySummaries)
    .orderBy(desc(monthlySummaries.period))
    .limit(1);

  // `YYYY-MM` sorts chronologically; on a tie the versioned period wins.
  if (newestVersion && (!legacy || newestVersion.period >= legacy.period)) {
    return getStoredSummary(newestVersion.period);
  }
  return legacy ? legacyReport(legacy) : null;
}

/**
 * Every stored period, newest first, once each, with when its newest content
 * was written. A period with versions reports its newest version's
 * `generatedAt`; a legacy-only period reports its row's `updatedAt`.
 * The sitemap and the permalink page read this; a failed read throws (#162).
 */
export async function listPeriods(): Promise<StoredSummaryPeriod[]> {
  const db = requireDb();
  const versionRows = await readVersionsTable("listPeriods", () =>
    db
      .select({ period: monthlyReportVersions.period, generatedAt: monthlyReportVersions.generatedAt })
      .from(monthlyReportVersions)
  );
  const legacyRows = await db
    .select({ period: monthlySummaries.period, updatedAt: monthlySummaries.updatedAt })
    .from(monthlySummaries)
    .orderBy(desc(monthlySummaries.period));

  const byPeriod = new Map<string, Date>();
  for (const row of legacyRows) byPeriod.set(row.period, row.updatedAt);
  const versioned = new Map<string, Date>();
  for (const row of versionRows) {
    const seen = versioned.get(row.period);
    if (!seen || row.generatedAt > seen) versioned.set(row.period, row.generatedAt);
  }
  for (const [period, generatedAt] of versioned) byPeriod.set(period, generatedAt);

  return [...byPeriod]
    .map(([period, updatedAt]) => ({ period, updatedAt }))
    .sort((a, b) => b.period.localeCompare(a.period));
}

/**
 * Every retrievable version of `period`, newest first. The legacy
 * `monthly_summaries` row, when one exists, is listed last as version 0.
 */
export async function listReportVersions(period: string): Promise<StoredReportVersionInfo[]> {
  const versions = await readVersionRows(period);
  const legacy = await readLegacyRow(period);
  const listed: StoredReportVersionInfo[] = versions.map((row) => ({
    period: row.period,
    version: row.version,
    generatedAt: row.generatedAt,
    generatedBy: row.generatedBy,
    source: "versions",
  }));
  if (legacy) {
    listed.push({
      period: legacy.period,
      version: 0,
      generatedAt: legacy.generatedAt,
      generatedBy: LEGACY_GENERATED_BY,
      source: "legacy",
    });
  }
  return listed;
}

/** One exact version of `period` (0 = the legacy row), or null when it does not exist. */
export async function getStoredSummaryVersion(
  period: string,
  version: number
): Promise<StoredMonthlyReport | null> {
  if (version === 0) {
    const legacy = await readLegacyRow(period);
    return legacy ? legacyReport(legacy) : null;
  }
  const versions = await readVersionRows(period);
  const match = versions.find((row) => row.version === version);
  return match ? toReport(match, versions[versions.length - 1]!.createdAt) : null;
}

/**
 * Inserts `row` as the next version of its period and returns it. Never
 * updates or deletes a row, and never writes a predecessor table. Its reads
 * do not use the missing-table degradation: with no table it throws, so a
 * generation is never reported as stored (#182).
 */
export async function appendReportVersion(
  row: Omit<NewMonthlyReportVersion, "version" | "id">
): Promise<StoredMonthlyReport> {
  const db = requireDb();
  const [latest] = await db
    .select({ version: monthlyReportVersions.version })
    .from(monthlyReportVersions)
    .where(eq(monthlyReportVersions.period, row.period))
    .orderBy(desc(monthlyReportVersions.version))
    .limit(1);
  const version = (latest?.version ?? 0) + 1;

  const [inserted] = await db
    .insert(monthlyReportVersions)
    .values({ ...row, version })
    .returning();
  if (!inserted) {
    throw new Error(`Monthly report version ${row.period} v${version} was not stored`);
  }
  const first = version === 1 ? inserted : (await readVersionRows(row.period)).at(-1);
  return toReport(inserted, (first ?? inserted).createdAt);
}

/** `YYYY-MM` -> `{ month: 1-12, year }`, for the State-of-AI-shaped API responses (#182). */
export function periodToMonthYear(period: string): { month: number; year: number } {
  const [year, month] = period.split("-").map((part) => Number.parseInt(part, 10));
  return { month: month ?? Number.NaN, year: year ?? Number.NaN };
}

/** `{ month: 1-12, year }` -> `YYYY-MM` (#182). */
export function monthYearToPeriod(month: number, year: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}
