import { getTableName, type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #185: the readers that need every ranked tool read the per-list boards.
 *
 * Why: after v8 activation the combined board is no public view (its rows are kept).
 *   Article ingestion, the article service, the category counts and What's New read the
 *   current per-list boards instead; a tool's rank is its rank within its own list, and
 *   a failed read must throw instead of turning into "no rankings".
 * What: checks the shared condition (current rows of the three lists, never `combined`)
 *   and `listBoardEntries()`; runs the category counts, the article service's rank
 *   lookup and the ingestion preview's state read against a fake Drizzle client that
 *   records each condition, including a failing read; and checks the What's New
 *   per-period grouping.
 * Test: `npx vitest run tests/unit/list-boards-185.test.ts`. No database, no network.
 */

const fake = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  tools: [] as Array<Record<string, unknown>>,
  conditions: [] as Array<{ table: string; sql: string; params: unknown[] }>,
  failing: false,
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: <T,>(fn: T) => fn }));
vi.mock("../../lib/startup-validation", () => ({ getOpenRouterApiKey: () => "test-key" }));
vi.mock("../../lib/db/connection", () => {
  const dialect = new PgDialect();
  const client = {
    select: () => ({
      from: (table: unknown) => ({
        where: (condition: SQL) => {
          const name = getTableName(table as never);
          const { sql, params } = dialect.sqlToQuery(condition);
          fake.conditions.push({ table: name, sql, params });
          if (name === "rankings" && fake.failing) return Promise.reject(new Error("fixture: rankings read failed"));
          return Promise.resolve(name === "rankings" ? fake.rows : fake.tools);
        },
      }),
    }),
  };
  return { getDb: () => client };
});

import { getCategoriesWithCounts } from "../../lib/db/repositories/categories";
import { currentListBoardsWhere, listBoardEntries } from "../../lib/rankings/list-boards";
import { ArticleDatabaseService } from "../../lib/services/article-db-service";
import { ArticleIngestionService } from "../../lib/services/article-ingestion.service";
import { rankingChangesByPeriod } from "../../lib/services/whats-new-aggregation.service";

const entry = (id: string, rank: number, category = "code-editor") => ({
  tool_id: id,
  tool_name: `Tool ${id}`,
  tool_slug: `${id}-slug`,
  rank,
  score: 90 - rank,
  category,
});
// Rows as the database returns them: the model row first, so list order is the reader's.
const LIST_ROWS = [
  { list: "model", period: "2026-11", isCurrent: true, data: [entry("m1", 1, "llm"), entry("m2", 2, "llm")] },
  { list: "harness", period: "2026-11", isCurrent: true, data: [entry("h1", 1), entry("h2", 2), entry("h3", 3)] },
  { list: "productivity", period: "2026-11", isCurrent: true, data: { rankings: [entry("p1", 1, "productivity")] } },
];

beforeEach(() => {
  fake.rows = LIST_ROWS;
  fake.tools = [];
  fake.conditions = [];
  fake.failing = false;
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const rankingConditions = () => fake.conditions.filter((c) => c.table === "rankings");
const expectListBoardsRead = () => {
  expect(rankingConditions().length).toBeGreaterThan(0);
  for (const c of rankingConditions()) {
    expect(c.params).toEqual([true, "harness", "model", "productivity"]);
    expect(c.params).not.toContain("combined");
  }
};

describe("currentListBoardsWhere and listBoardEntries (#185)", () => {
  it("selects the current row of each list and never the combined row", () => {
    const { sql, params } = new PgDialect().sqlToQuery(currentListBoardsWhere());
    expect(sql).toBe('("rankings"."is_current" = $1 and "rankings"."list" in ($2, $3, $4))');
    expect(params).toEqual([true, "harness", "model", "productivity"]);
  });

  it("flattens the boards in list order, tags each entry with its list, and ignores a combined row", () => {
    const entries = listBoardEntries([...LIST_ROWS, { list: "combined", data: [entry("x", 1)] }]);
    expect(entries.map((e) => [e.list, e["tool_id"], e["rank"]])).toEqual([
      ["harness", "h1", 1],
      ["harness", "h2", 2],
      ["harness", "h3", 3],
      ["model", "m1", 1],
      ["model", "m2", 2],
      ["productivity", "p1", 1],
    ]);
  });
});

describe("category counts (#185)", () => {
  it("count each ranked tool of every list once", async () => {
    const categories = await getCategoriesWithCounts();
    expect(categories[0]).toEqual({ id: "all", name: "All Categories", count: 6 });
    expect(Object.fromEntries(categories.slice(1).map((c) => [c.id, c.count]))).toEqual({
      "code-editor": 3,
      llm: 2,
      productivity: 1,
    });
    expectListBoardsRead();
  });

  it("a failed read throws instead of an empty category list", async () => {
    fake.failing = true;
    await expect(getCategoriesWithCounts()).rejects.toThrow(/rankings read failed/);
  });
});

describe("article service rank lookup (#185)", () => {
  const read = (service: ArticleDatabaseService) =>
    (service as unknown as { getCurrentRankings(): Promise<Array<{ tool_id: string; rank: number }>> }).getCurrentRankings();

  it("ranks each tool within its own list", async () => {
    const ranks = await read(new ArticleDatabaseService());
    expect(ranks.map((r) => [r.tool_id, r.rank])).toEqual([
      ["h1", 1],
      ["h2", 2],
      ["h3", 3],
      ["m1", 1],
      ["m2", 2],
      ["p1", 1],
    ]);
    expectListBoardsRead();
  });

  it("a failed read throws instead of an empty rank set", async () => {
    fake.failing = true;
    await expect(read(new ArticleDatabaseService())).rejects.toThrow(/rankings read failed/);
  });
});

describe("article ingestion preview state (#185)", () => {
  const state = (service: ArticleIngestionService) =>
    (service as unknown as {
      getCurrentState(dryRun: boolean): Promise<{ currentRankings: Array<Record<string, unknown>>; existingTools: string[] }>;
    }).getCurrentState(true);

  it("reads every list's board, each rank within its list", async () => {
    const { currentRankings, existingTools } = await state(new ArticleIngestionService());
    expect(currentRankings.map((r) => [r["id"], r["rank"], r["list"]])).toEqual([
      ["h1", 1, "harness"],
      ["h2", 2, "harness"],
      ["h3", 3, "harness"],
      ["m1", 1, "model"],
      ["m2", 2, "model"],
      ["p1", 1, "productivity"],
    ]);
    expect(existingTools).toHaveLength(6);
    expectListBoardsRead();
  });

  it("a failed read throws instead of an empty state", async () => {
    fake.failing = true;
    await expect(state(new ArticleIngestionService())).rejects.toThrow(/rankings read failed/);
  });
});

describe("What's New ranking entries (#185)", () => {
  it("one entry per period from its list boards: tools summed, versions once, latest publish", () => {
    const at = (h: number) => new Date(Date.UTC(2026, 10, 1, h));
    const changes = rankingChangesByPeriod([
      { period: "2026-11", algorithmVersion: "8.0", publishedAt: at(9), data: [entry("h1", 1), entry("h2", 2)] },
      { period: "2026-11", algorithmVersion: "8.0", publishedAt: at(10), data: { rankings: [entry("m1", 1)] } },
      { period: "2026-10", algorithmVersion: "8.0", publishedAt: at(1), data: [entry("p1", 1)] },
    ]);
    expect(changes).toEqual([
      { period: "2026-11", algorithmVersion: "8.0", publishedAt: at(10), toolCount: 3 },
      { period: "2026-10", algorithmVersion: "8.0", publishedAt: at(1), toolCount: 1 },
    ]);
  });
});
