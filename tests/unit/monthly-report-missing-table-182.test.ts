/**
 * #182: the public monthly reads survive a missing `monthly_report_versions`.
 *
 * Why: the readers query the new versions table first. If main deploys before
 *   migration 0031 is applied, Postgres raises 42P01 (undefined_table), and the
 *   sitemap, RSS, the What's New pages and `/api/state-of-ai/current` failed
 *   whole instead of serving the legacy content.
 * What: runs the real repository and `/api/state-of-ai/current` over the
 *   in-memory fake db with the versions table raising 42P01 (directly and as a
 *   `cause`): the legacy `monthly_summaries` row is served and a degradation
 *   is logged. Any other error on that table still throws (#162), and
 *   `appendReportVersion` still throws on 42P01.
 * Test: `npx vitest run tests/unit/monthly-report-missing-table-182.test.ts`.
 *   No database, no network.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  db: {
    tables: {} as Record<string, Record<string, unknown>[]>,
    writes: [] as Array<{ op: "insert" | "upsert" | "update" | "delete"; table: string }>,
    failInsert: false,
    tableErrors: {} as Record<string, Error>,
  },
  getCurrentSummary: vi.fn(),
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const { fakeDesc, fakeEq } = await import("./fixtures/monthly-report-fake-db");
  return { ...(await importOriginal<typeof import("drizzle-orm")>()), eq: fakeEq, desc: fakeDesc };
});

vi.mock("../../lib/db/connection", async () => {
  const { createFakeDb } = await import("./fixtures/monthly-report-fake-db");
  return { getDb: () => createFakeDb(state.db) };
});

vi.mock("../../lib/services/state-of-ai-summary.service", () => ({
  StateOfAiSummaryService: class {
    getCurrentSummary = state.getCurrentSummary;
  },
}));

import { loggers } from "../../lib/logger";
import {
  appendReportVersion,
  getLatestStoredSummary,
  getStoredSummary,
  listPeriods,
} from "../../lib/services/monthly-report.repository";
import { GET as stateOfAiCurrent } from "../../app/api/state-of-ai/current/route";

const VERSIONS = "monthly_report_versions";

function pgError(code: string, message: string): Error {
  return Object.assign(new Error(message), { code });
}
const MISSING = pgError("42P01", 'relation "monthly_report_versions" does not exist');
const MISSING_AS_CAUSE = Object.assign(new Error("Failed query"), { cause: MISSING });

const AUGUST = {
  id: "legacy-08",
  period: "2026-08",
  content: "August pre-merge summary",
  dataHash: "hash-08",
  metadata: {},
  generatedAt: new Date("2026-08-31T06:00:00Z"),
  createdAt: new Date("2026-08-01T06:00:00Z"),
  updatedAt: new Date("2026-08-31T06:00:00Z"),
};

beforeEach(() => {
  state.db.tables = { monthly_summaries: [{ ...AUGUST }] };
  state.db.writes = [];
  state.db.tableErrors = {};
  state.getCurrentSummary.mockReset();
  vi.restoreAllMocks();
});

describe.each([
  { label: "42P01", error: MISSING },
  { label: "42P01 as the cause", error: MISSING_AS_CAUSE },
])("monthly_report_versions missing ($label)", ({ error }) => {
  beforeEach(() => {
    state.db.tableErrors = { [VERSIONS]: error };
  });

  it("getStoredSummary serves the legacy row and logs a degradation", async () => {
    const warn = vi.spyOn(loggers.api, "warn");

    expect(await getStoredSummary("2026-08")).toMatchObject({ content: AUGUST.content, version: 0 });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("monthly_report_versions is missing"),
      expect.objectContaining({ degradation: "monthly-report-versions-table-missing" })
    );
  });

  it("getLatestStoredSummary serves the latest legacy row", async () => {
    expect(await getLatestStoredSummary()).toMatchObject({ period: "2026-08", version: 0 });
  });

  it("listPeriods (sitemap, RSS, permalink list) lists the legacy periods", async () => {
    expect(await listPeriods()).toEqual([{ period: "2026-08", updatedAt: AUGUST.updatedAt }]);
  });

  it("/api/state-of-ai/current serves the legacy editorial", async () => {
    state.getCurrentSummary.mockResolvedValue({
      id: "soa-08",
      month: 8,
      year: 2026,
      content: "August editorial",
      generatedAt: new Date("2026-08-01T08:00:00Z"),
      metadata: {},
    });

    const res = await stateOfAiCurrent();

    expect(res.status).toBe(200);
    expect((await res.json()).summary).toMatchObject({ month: 8, year: 2026, content: "August editorial" });
  });

  it("appendReportVersion still throws, so no generation is reported as stored", async () => {
    await expect(
      appendReportVersion({
        period: "2026-09",
        content: "x",
        dataHash: "h",
        metadata: {},
        generatedBy: "test",
      })
    ).rejects.toBe(error);
    expect(state.db.tables[VERSIONS]).toBeUndefined();
  });
});

describe("any other error on monthly_report_versions still throws (#162)", () => {
  const other = pgError("08006", "connection failure");

  beforeEach(() => {
    state.db.tableErrors = { [VERSIONS]: other };
  });

  it.each([
    ["getStoredSummary", () => getStoredSummary("2026-08")],
    ["getLatestStoredSummary", () => getLatestStoredSummary()],
    ["listPeriods", () => listPeriods()],
  ])("%s rejects", async (_name, read) => {
    await expect(read()).rejects.toBe(other);
  });

  it("/api/state-of-ai/current answers 500", async () => {
    const res = await stateOfAiCurrent();
    expect(res.status).toBe(500);
    expect(state.getCurrentSummary).not.toHaveBeenCalled();
  });
});
