import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Cron-driven what's-new summary regeneration (#160).
 *
 * Why: The summary regenerates without an admin, and each generation is a
 * paid LLM call. It must run only when the month's data changed, generate the
 * new month on rollover, and never damage the stored summary when the LLM or
 * the database fails.
 * #182: a generation appends the period's next version to
 * `monthly_report_versions`, keeps every earlier version and the pre-merge
 * `monthly_summaries` row readable, writes nothing else, and stores no reply
 * outside 300-450 words.
 * What: Runs the real `autoRegenerateMonthlySummary`, `WhatsNewSummaryService`
 * and monthly report repository against in-memory `monthly_report_versions`
 * and `monthly_summaries` tables (`fixtures/monthly-report-fake-db.ts`), a
 * stubbed LLM `fetch`, and the real `calculateDataHash` over fixture articles.
 * Test: `npx vitest run tests/unit/whats-new-auto-regenerate.test.ts`. No
 * database access, no network.
 */

type Row = { id: string; period: string; content: string; dataHash: string; [k: string]: unknown };

const state = vi.hoisted(() => ({
  db: {
    tables: {} as Record<string, Record<string, unknown>[]>,
    writes: [] as Array<{ op: "insert" | "upsert" | "update" | "delete"; table: string }>,
    failInsert: false,
  },
  articlesByPeriod: new Map<string, string[]>(),
  failAggregate: false,
  noApiKey: false,
}));

// #182: the generator reads `monthly_report_versions`, then the read-only
// `monthly_summaries`, and appends to the first; the fake answers both.
vi.mock("drizzle-orm", async (importOriginal) => {
  const { fakeDesc, fakeEq } = await import("./fixtures/monthly-report-fake-db");
  return { ...(await importOriginal<typeof import("drizzle-orm")>()), eq: fakeEq, desc: fakeDesc };
});

vi.mock("../../lib/db/connection", async () => {
  const { createFakeDb } = await import("./fixtures/monthly-report-fake-db");
  return { getDb: () => createFakeDb(state.db) };
});

vi.mock("../../lib/startup-validation", () => ({
  getOpenRouterApiKey: () => {
    if (state.noApiKey) throw new Error("OpenRouter API key is not configured");
    return "test-key";
  },
}));

// Real hashing; only the database read is replaced by fixture articles.
vi.mock("../../lib/services/whats-new-aggregation.service", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../lib/services/whats-new-aggregation.service")>();
  class FixtureAggregationService extends actual.WhatsNewAggregationService {
    override async getMonthlyData(month?: number, year?: number) {
      if (state.failAggregate) throw new Error("database read failed");
      const period = `${year}-${String(month).padStart(2, "0")}`;
      const ids = state.articlesByPeriod.get(period) ?? [];
      return {
        newsArticles: ids.map((id) => ({
          id,
          title: `Article ${id}`,
          summary: null,
          publishedAt: new Date(`${period}-02T00:00:00Z`),
          importanceScore: 5,
          toolMentions: [],
          source: null,
          sourceUrl: null,
        })),
        rankingChanges: [],
        newTools: [],
        siteChanges: [],
        metadata: {
          period,
          startDate: new Date(`${period}-01T00:00:00Z`),
          endDate: new Date(`${period}-28T23:59:59Z`),
          totalArticles: ids.length,
          totalRankingChanges: 0,
          totalNewTools: 0,
          totalSiteChanges: 0,
        },
      };
    }
  }
  return { WhatsNewAggregationService: FixtureAggregationService };
});

import { WhatsNewAggregationService } from "../../lib/services/whats-new-aggregation.service";
import { autoRegenerateMonthlySummary } from "../../lib/services/whats-new-auto-regenerate";
import {
  getStoredSummary,
  getStoredSummaryVersion,
  listReportVersions,
} from "../../lib/services/monthly-report.repository";

const llm = vi.fn();
vi.stubGlobal("fetch", llm);

const BUDGET_MS = 200_000;
const MID_SEPTEMBER = new Date("2026-09-15T06:05:00Z");

const LEGACY = "monthly_summaries";
const VERSIONS = "monthly_report_versions";

/** #182: a reply inside the 300-450-word bound (3 title words + 9 x 40). */
function report(title: string): string {
  return `# ${title} report\n\n${"Developers compared agentic editors and terminal assistants this month. ".repeat(40)}`;
}
const SEPTEMBER_REPORT = report("September 2026");

function llmReply(content: unknown, status = 200): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status });
}

/** The hash `generateMonthlySummary` would have stored for these articles. */
async function hashFor(period: string, ids: string[]): Promise<string> {
  const aggregation = new WhatsNewAggregationService();
  state.articlesByPeriod.set(period, ids);
  const [year, month] = period.split("-").map(Number);
  return aggregation.calculateDataHash(await aggregation.getMonthlyData(month, year));
}

/** A pre-merge summary, stored in the read-only `monthly_summaries` table. */
async function storeSummary(period: string, ids: string[], content: string): Promise<void> {
  const dataHash = await hashFor(period, ids);
  const rows = (state.db.tables[LEGACY] ??= []);
  rows.push({ id: `id-${period}`, period, content, dataHash } satisfies Row);
}

function versionsOf(period: string): Record<string, unknown>[] {
  return (state.db.tables[VERSIONS] ?? []).filter((row) => row.period === period);
}

function snapshot(): Record<string, Record<string, unknown>[]> {
  return structuredClone(state.db.tables);
}

beforeEach(() => {
  state.db.tables = {};
  state.db.writes = [];
  state.db.failInsert = false;
  state.articlesByPeriod.clear();
  state.failAggregate = false;
  state.noApiKey = false;
  llm.mockReset();
  llm.mockImplementation(async () => llmReply(SEPTEMBER_REPORT));
});

describe("autoRegenerateMonthlySummary", () => {
  it("regenerates the current month when articles were added since the stored summary", async () => {
    await storeSummary("2026-09", ["a1"], "old September summary");
    const legacy = structuredClone(state.db.tables[LEGACY]);
    state.articlesByPeriod.set("2026-09", ["a1", "a2"]);

    const outcome = await autoRegenerateMonthlySummary({ now: MID_SEPTEMBER, timeBudgetMs: BUDGET_MS });

    expect(outcome).toEqual({ status: "generated", period: "2026-09", generationTimeMs: expect.any(Number) });
    expect(llm).toHaveBeenCalledTimes(1);
    expect(llm.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    // #182: the new content is version 1 of the merged report; the pre-merge row is untouched.
    const [row] = versionsOf("2026-09");
    expect(row).toMatchObject({ version: 1, content: SEPTEMBER_REPORT, generatedBy: "cron-daily-news" });
    expect(row?.dataHash).toBe(await hashFor("2026-09", ["a1", "a2"]));
    expect(state.db.tables[LEGACY]).toEqual(legacy);
    expect((await getStoredSummary("2026-09"))?.content).toBe(SEPTEMBER_REPORT);
  });

  it("skips without an LLM call when the month's data hash matches the stored summary", async () => {
    await storeSummary("2026-09", ["a1", "a2"], "current September summary");
    const before = snapshot();

    const outcome = await autoRegenerateMonthlySummary({ now: MID_SEPTEMBER, timeBudgetMs: BUDGET_MS });

    expect(outcome).toEqual({ status: "skipped", period: "2026-09", reason: "unchanged" });
    expect(llm).not.toHaveBeenCalled();
    expect(snapshot()).toEqual(before);
  });

  it("generates the new month on the first run after rollover and keeps last month's summary", async () => {
    await storeSummary("2026-08", ["aug-1", "aug-2"], "August summary");
    const before = snapshot();
    state.articlesByPeriod.set("2026-09", ["sep-1"]);

    const outcome = await autoRegenerateMonthlySummary({
      now: new Date("2026-09-01T06:05:00Z"),
      timeBudgetMs: BUDGET_MS,
    });

    expect(outcome).toEqual({ status: "generated", period: "2026-09", generationTimeMs: expect.any(Number) });
    expect(versionsOf("2026-09").map((row) => row.content)).toEqual([SEPTEMBER_REPORT]);
    expect(state.db.tables[LEGACY]).toEqual(before[LEGACY]);
  });

  it("does not generate an empty new month; last month's summary stays the one served", async () => {
    await storeSummary("2026-08", ["aug-1"], "August summary");
    const before = snapshot();

    const outcome = await autoRegenerateMonthlySummary({
      now: new Date("2026-09-01T06:05:00Z"),
      timeBudgetMs: BUDGET_MS,
    });

    expect(outcome).toEqual({ status: "skipped", period: "2026-09", reason: "no-articles-this-month" });
    expect(llm).not.toHaveBeenCalled();
    expect(snapshot()).toEqual(before);
  });

  it("skips the LLM call when the cron run has too little time left", async () => {
    state.articlesByPeriod.set("2026-09", ["a1"]);

    const outcome = await autoRegenerateMonthlySummary({ now: MID_SEPTEMBER, timeBudgetMs: 30_000 });

    expect(outcome).toEqual({ status: "skipped", period: "2026-09", reason: "insufficient-time-budget" });
    expect(llm).not.toHaveBeenCalled();
  });

  it("#182: regenerating a month appends a version and keeps every earlier one retrievable", async () => {
    await storeSummary("2026-09", ["a1"], "pre-merge September summary");
    const first = report("First September");
    const second = report("Second September");

    state.articlesByPeriod.set("2026-09", ["a1", "a2"]);
    llm.mockImplementationOnce(async () => llmReply(first));
    await autoRegenerateMonthlySummary({ now: MID_SEPTEMBER, timeBudgetMs: BUDGET_MS });
    state.articlesByPeriod.set("2026-09", ["a1", "a2", "a3"]);
    llm.mockImplementationOnce(async () => llmReply(second));
    const outcome = await autoRegenerateMonthlySummary({ now: MID_SEPTEMBER, timeBudgetMs: BUDGET_MS });

    expect(outcome.status).toBe("generated");
    expect((await getStoredSummary("2026-09"))).toMatchObject({ version: 2, content: second });
    expect((await getStoredSummaryVersion("2026-09", 1))?.content).toBe(first);
    expect((await getStoredSummaryVersion("2026-09", 0))?.content).toBe("pre-merge September summary");
    expect((await listReportVersions("2026-09")).map((v) => [v.version, v.source])).toEqual([
      [2, "versions"],
      [1, "versions"],
      [0, "legacy"],
    ]);
    // #182: the only writes are inserts into the version table.
    expect(state.db.writes).toEqual([
      { op: "insert", table: VERSIONS },
      { op: "insert", table: VERSIONS },
    ]);
  });

  // `error` pins each case to its own cause, so an unrelated exception cannot pass it.
  it.each([
    {
      label: "an LLM HTTP error",
      error: /OpenRouter API error \(500\)/,
      arrange: () => llm.mockResolvedValue(new Response("upstream down", { status: 500 })),
    },
    {
      label: "an LLM network error or timeout",
      error: /aborted/,
      arrange: () => llm.mockRejectedValue(new Error("The operation was aborted")),
    },
    {
      label: "empty LLM content",
      error: /No content in OpenRouter response/,
      arrange: () => llm.mockResolvedValue(llmReply("   ")),
    },
    {
      label: "a missing LLM content field",
      error: /No content in OpenRouter response/,
      arrange: () => llm.mockResolvedValue(llmReply(undefined)),
    },
    {
      label: "a reply under 300 words (#182)",
      error: /has 1 words; it must be 300-450/,
      arrange: () => llm.mockResolvedValue(llmReply("# September")),
    },
    {
      label: "a reply over 450 words (#182)",
      error: /has 726 words; it must be 300-450/,
      arrange: () => llm.mockResolvedValue(llmReply(`${SEPTEMBER_REPORT}\n\n${SEPTEMBER_REPORT}`)),
    },
    { label: "a database write error", error: /database write failed/, arrange: () => (state.db.failInsert = true) },
    { label: "a database read error", error: /database read failed/, arrange: () => (state.failAggregate = true) },
    { label: "a missing OpenRouter key", error: /API key is not configured/, arrange: () => (state.noApiKey = true) },
  ])("reports failure and leaves the stored summary untouched on $label", async ({ arrange, error }) => {
    await storeSummary("2026-08", ["aug-1"], "August summary");
    await storeSummary("2026-09", ["a1"], "old September summary");
    state.articlesByPeriod.set("2026-09", ["a1", "a2"]);
    const before = snapshot();
    arrange();

    const outcome = await autoRegenerateMonthlySummary({ now: MID_SEPTEMBER, timeBudgetMs: BUDGET_MS });

    expect(outcome).toEqual({ status: "failed", period: "2026-09", error: expect.stringMatching(error) });
    expect(snapshot()).toEqual(before);
  });
});
