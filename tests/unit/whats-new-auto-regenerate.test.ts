import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Cron-driven what's-new summary regeneration (#160).
 *
 * Why: The summary regenerates without an admin, and each generation is a
 * paid LLM call. It must run only when the month's data changed, generate the
 * new month on rollover, and never damage the stored summary when the LLM or
 * the database fails.
 * What: Runs the real `autoRegenerateMonthlySummary` and
 * `WhatsNewSummaryService` against an in-memory `monthly_summaries` table, a
 * stubbed LLM `fetch`, and the real `calculateDataHash` over fixture articles.
 * Test: `npx vitest run tests/unit/whats-new-auto-regenerate.test.ts`. No
 * database access, no network.
 */

type Row = { id: string; period: string; content: string; dataHash: string; [k: string]: unknown };

const state = vi.hoisted(() => ({
  rows: new Map<string, Row>(),
  articlesByPeriod: new Map<string, string[]>(),
  failInsert: false,
  failAggregate: false,
  noApiKey: false,
}));

// The service filters with `eq(monthlySummaries.period, value)`; the fake
// table only needs the value.
vi.mock("drizzle-orm", async (importOriginal) => ({
  ...(await importOriginal<typeof import("drizzle-orm")>()),
  eq: (_column: unknown, value: unknown) => ({ value }),
}));

vi.mock("../../lib/db/connection", () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: ({ value }: { value: string }) => ({
          limit: async () => {
            const row = state.rows.get(value);
            return row ? [row] : [];
          },
        }),
      }),
    }),
    insert: () => ({
      values: (values: Row) => ({
        onConflictDoUpdate: ({ set }: { set: Partial<Row> }) => ({
          returning: async () => {
            if (state.failInsert) throw new Error("database write failed");
            const existing = state.rows.get(values.period);
            const row = existing ? { ...existing, ...set } : { ...values, id: `id-${values.period}` };
            state.rows.set(values.period, row);
            return [row];
          },
        }),
      }),
    }),
  }),
}));

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

const llm = vi.fn();
vi.stubGlobal("fetch", llm);

const BUDGET_MS = 200_000;
const MID_SEPTEMBER = new Date("2026-09-15T06:05:00Z");

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

async function storeSummary(period: string, ids: string[], content: string): Promise<void> {
  const dataHash = await hashFor(period, ids);
  state.rows.set(period, { id: `id-${period}`, period, content, dataHash });
}

function snapshot(): Record<string, Row> {
  return structuredClone(Object.fromEntries(state.rows));
}

beforeEach(() => {
  state.rows.clear();
  state.articlesByPeriod.clear();
  state.failInsert = false;
  state.failAggregate = false;
  state.noApiKey = false;
  llm.mockReset();
  llm.mockImplementation(async () => llmReply("# September summary"));
});

describe("autoRegenerateMonthlySummary", () => {
  it("regenerates the current month when articles were added since the stored summary", async () => {
    await storeSummary("2026-09", ["a1"], "old September summary");
    state.articlesByPeriod.set("2026-09", ["a1", "a2"]);

    const outcome = await autoRegenerateMonthlySummary({ now: MID_SEPTEMBER, timeBudgetMs: BUDGET_MS });

    expect(outcome).toEqual({ status: "generated", period: "2026-09", generationTimeMs: expect.any(Number) });
    expect(llm).toHaveBeenCalledTimes(1);
    expect(llm.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    const row = state.rows.get("2026-09");
    expect(row?.content).toBe("# September summary");
    expect(row?.dataHash).toBe(await hashFor("2026-09", ["a1", "a2"]));
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
    const august = structuredClone(state.rows.get("2026-08"));
    state.articlesByPeriod.set("2026-09", ["sep-1"]);

    const outcome = await autoRegenerateMonthlySummary({
      now: new Date("2026-09-01T06:05:00Z"),
      timeBudgetMs: BUDGET_MS,
    });

    expect(outcome).toEqual({ status: "generated", period: "2026-09", generationTimeMs: expect.any(Number) });
    expect(state.rows.get("2026-09")?.content).toBe("# September summary");
    expect(state.rows.get("2026-08")).toEqual(august);
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
    { label: "a database write error", error: /database write failed/, arrange: () => (state.failInsert = true) },
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
