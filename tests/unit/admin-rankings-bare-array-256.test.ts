import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import { NextRequest } from "next/server";

/**
 * Admin rankings readers and writers handle bare-array snapshot rows (#256).
 *
 * Why: the cron and admin-draft writers store `rankings.data` as a bare array;
 *   older rows and the admin PUT store `{ rankings: [...] }`. Admin readers
 *   that read `data.rankings` reported 0 rows for bare rows, PUT rewrote a bare
 *   row as `{ rankings: [] }`, and sync-current spread the array into numeric keys.
 * What: over the in-memory Drizzle stand-in, one bare period and one wrapped
 *   period with the same rows go through every listed reader, PUT and
 *   sync-current, plus malformed data and the article ingestion rankings read.
 * Test: `npx vitest run tests/unit/admin-rankings-bare-array-256.test.ts`.
 */

const db = vi.hoisted(() => ({ client: null as unknown }));
const fsSpy = vi.hoisted(() => ({ writeFileSync: vi.fn() }));
const cacheSpy = vi.hoisted(() => ({ writeRankingsStaticCache: vi.fn() }));

vi.mock("../../lib/db/connection", () => ({ getDb: () => db.client }));
vi.mock("../../lib/api-auth", () => ({
  requireAdmin: async () => ({ userId: "admin", user: { id: "admin" }, error: null }),
}));
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return { ...actual, default: { ...actual, writeFileSync: fsSpy.writeFileSync }, writeFileSync: fsSpy.writeFileSync };
});
vi.mock("../../lib/cache/rankings-static-cache", () => ({
  writeRankingsStaticCache: cacheSpy.writeRankingsStaticCache,
}));

import { GET as getPeriod, PUT as putPeriod } from "../../app/api/admin/rankings/[period]/route";
import { GET as getPeriods } from "../../app/api/admin/rankings/periods/route";
import { GET as getRankings, POST as postRankings } from "../../app/api/admin/rankings/route";
import { GET as getCheckPeriods } from "../../app/api/admin/check-ranking-periods/route";
import { createFakeRankingsDb, rankingRow } from "../../lib/services/__fixtures__/fake-rankings-db";

// The cron's RankingEntry shape: `rank` and `score`.
const ROWS = [
  { tool_id: "tool-a", tool_name: "A", rank: 1, score: 9.1 },
  { tool_id: "tool-b", tool_name: "B", rank: 2, score: 8.4 },
];
const BARE = "2026-09";
const WRAPPED = "2026-08";

let fake: ReturnType<typeof createFakeRankingsDb>;

function seed(rows: ReturnType<typeof rankingRow>[]) {
  fake = createFakeRankingsDb({ rankings: rows });
  db.client = fake.client;
}

function seedBoth() {
  seed([
    rankingRow({ period: BARE, isCurrent: true, publishedAt: new Date("2026-09-01T00:00:00Z"), data: ROWS }),
    rankingRow({ period: WRAPPED, data: { rankings: ROWS, metadata: { note: "old" }, generated_at: "2026-08-01" } }),
  ]);
}

const params = (period: string) => ({ params: Promise.resolve({ period }) });
const req = (url: string, init?: ConstructorParameters<typeof NextRequest>[1]) =>
  new NextRequest(`http://localhost${url}`, init);
const json = async (res: Response) => ({ status: res.status, body: await res.json() });
const byPeriod = <T extends { period: string }>(list: T[], period: string) => list.find((p) => p.period === period)!;

beforeEach(() => {
  vi.clearAllMocks();
  seedBoth();
});

describe("admin rankings readers give the same rows for both stored shapes (#256)", () => {
  it("GET /api/admin/rankings/[period] returns the rows of both periods", async () => {
    for (const period of [BARE, WRAPPED]) {
      const { status, body } = await json(await getPeriod(req(`/api/admin/rankings/${period}`), params(period)));
      expect(status).toBe(200);
      expect(body.rankings, period).toEqual(ROWS);
    }
  });

  it("GET /api/admin/rankings/periods counts both periods", async () => {
    const { body } = await json(await getPeriods(req("/api/admin/rankings/periods")));
    expect(byPeriod(body.periods, BARE).rankings_count).toBe(2);
    expect(byPeriod(body.periods, WRAPPED).rankings_count).toBe(2);
  });

  it("GET /api/admin/check-ranking-periods counts both periods", async () => {
    const { body } = await json(await getCheckPeriods());
    expect(byPeriod(body.periods, BARE).ranking_count).toBe(2);
    expect(byPeriod(body.periods, WRAPPED).ranking_count).toBe(2);
  });

  it("action=periods counts both periods", async () => {
    const { body } = await json(await getRankings(req("/api/admin/rankings?action=periods")));
    expect(byPeriod(body.periods, BARE).tool_count).toBe(2);
    expect(byPeriod(body.periods, WRAPPED).tool_count).toBe(2);
  });

  it("action=check-data without a period counts rows and finds scores in both shapes", async () => {
    const { body } = await json(await getRankings(req("/api/admin/rankings?action=check-data")));
    for (const period of [BARE, WRAPPED]) {
      expect(byPeriod(body.periods, period)).toMatchObject({ rankings: 2, has_scores: true });
    }
  });

  it("action=check-data with a period returns the count and sample rows of both periods", async () => {
    for (const period of [BARE, WRAPPED]) {
      const { body } = await json(await getRankings(req(`/api/admin/rankings?action=check-data&period=${period}`)));
      expect(body.tool_count, period).toBe(2);
      expect(body.sample_rankings, period).toEqual(ROWS);
    }
  });

  it("action=all returns the rows of both periods", async () => {
    const { body } = await json(await getRankings(req("/api/admin/rankings?action=all")));
    expect(byPeriod(body.periods, BARE).rankings).toEqual(ROWS);
    expect(byPeriod(body.periods, WRAPPED).rankings).toEqual(ROWS);
  });
});

describe("null, empty and malformed data read as no rows (#256)", () => {
  const MALFORMED: Array<[string, unknown]> = [
    ["null", null],
    ["{}", {}],
    ["a string", "oops"],
    ["a non-array rankings", { rankings: "oops" }],
    ["non-object entries", [null, 3, "x"]],
  ];

  it("gives [] and 0 counts with no throw on every reader", async () => {
    for (const [label, data] of MALFORMED) await expectNoRows(label, data);
  });

  async function expectNoRows(label: string, data: unknown) {
    seed([rankingRow({ period: "2026-01", data })]);

    const one = await json(await getPeriod(req("/api/admin/rankings/2026-01"), params("2026-01")));
    expect(one, label).toMatchObject({ status: 200, body: { rankings: [] } });

    const periods = await json(await getPeriods(req("/api/admin/rankings/periods")));
    expect(periods.body.periods[0].rankings_count, label).toBe(0);

    const check = await json(await getCheckPeriods());
    expect(check.body.periods[0].ranking_count, label).toBe(0);

    const action = await json(await getRankings(req("/api/admin/rankings?action=periods")));
    expect(action.body.periods[0].tool_count, label).toBe(0);

    const checkAll = await json(await getRankings(req("/api/admin/rankings?action=check-data")));
    expect(checkAll.body.periods[0], label).toMatchObject({ rankings: 0, has_scores: false });

    const checkOne = await json(await getRankings(req("/api/admin/rankings?action=check-data&period=2026-01")));
    expect(checkOne, label).toMatchObject({ status: 200, body: { tool_count: 0, sample_rankings: [] } });

    const all = await json(await getRankings(req("/api/admin/rankings?action=all")));
    expect(all.body.periods[0].rankings, label).toEqual([]);
  }
});

describe("PUT /api/admin/rankings/[period] never drops stored rows (#256)", () => {
  const put = (period: string, body: unknown) =>
    putPeriod(
      req(`/api/admin/rankings/${period}`, {
        method: "PUT",
        body: JSON.stringify(body),
        headers: { "content-type": "application/json" },
      }),
      params(period)
    );
  const stored = (period: string) => fake.state.rankings.find((r) => r.period === period)!.data;

  it("keeps the stored rows of either shape when the body has no `rankings`", async () => {
    const res = await put(BARE, { metadata: { note: "edited" } });
    expect(res.status).toBe(200);
    expect(stored(BARE)).toMatchObject({ rankings: ROWS, metadata: { note: "edited" } });

    await put(WRAPPED, { algorithm_version: "7.9" });
    expect(stored(WRAPPED)).toMatchObject({ rankings: ROWS, metadata: { note: "old" } });
  });

  it("refuses a non-array `rankings` and leaves the row unchanged", async () => {
    const res = await put(BARE, { rankings: "oops" });
    expect(res.status).toBe(400);
    expect(stored(BARE)).toEqual(ROWS);
  });
});

describe("sync-current writes a `rankings` array, never numeric keys (#256)", () => {
  function written() {
    const call = fsSpy.writeFileSync.mock.calls.find(([path]) => String(path).endsWith("rankings.json"));
    expect(call).toBeDefined();
    return { file: JSON.parse(String(call![1])), cache: cacheSpy.writeRankingsStaticCache.mock.calls[0]?.[0] };
  }

  async function sync() {
    return json(
      await postRankings(
        req("/api/admin/rankings", {
          method: "POST",
          body: JSON.stringify({ action: "sync-current" }),
          headers: { "content-type": "application/json" },
        })
      )
    );
  }

  it("writes the current row as { rankings, is_current } for either shape", async () => {
    const { body } = await sync();
    expect(body).toMatchObject({ success: true, period: BARE, rankings_count: 2 });

    const { file, cache } = written();
    expect(file).toMatchObject({ rankings: ROWS, is_current: true, period: BARE });
    expect(Object.keys(file).some((key) => /^\d+$/.test(key))).toBe(false);
    expect(cache).toEqual(file);

    // A wrapped current row keeps its other fields.
    vi.clearAllMocks();
    seed([rankingRow({ period: WRAPPED, isCurrent: true, data: { rankings: ROWS, metadata: { note: "old" } } })]);
    await sync();
    expect(written().file).toEqual({ rankings: ROWS, metadata: { note: "old" }, is_current: true });
  });

  it("writes a bare latest row the same way when no row is current", async () => {
    seed([rankingRow({ period: BARE, data: ROWS })]);
    const { body } = await sync();
    expect(body).toMatchObject({ success: true, period: BARE, rankings_count: 2 });

    const { file, cache } = written();
    expect(file).toMatchObject({ rankings: ROWS, is_current: true });
    expect(Object.keys(file).some((key) => /^\d+$/.test(key))).toBe(false);
    expect(cache).toEqual(file);
  });

});

describe("article ingestion reads the current bare row's rankings (#256)", () => {
  it("ArticleDatabaseService.getCurrentRankings returns the bare row's tools", async () => {
    // A stand-in for the two reads it makes: the current ranking row, then tool names.
    const client = {
      select: () => ({
        from: (table: unknown) => ({
          where: () => {
            const isTools = getTableName(table as never) === "tools";
            const rows = isTools
              ? [{ id: "tool-a", name: "Tool A" }, { id: "tool-b", name: "Tool B" }]
              : [{ data: ROWS, isCurrent: true }];
            return Object.assign(Promise.resolve(rows), { limit: async () => rows });
          },
        }),
      }),
    };
    const { ArticleDatabaseService } = await import("../../lib/services/article-db-service");
    // The constructor builds AI clients that need API keys; the method reads only `this.db`.
    const getCurrentRankings = (ArticleDatabaseService.prototype as unknown as {
      getCurrentRankings(this: { db: unknown }): Promise<Array<{ tool_id: string; tool_name: string; score: number }>>;
    }).getCurrentRankings;

    const rankings = await getCurrentRankings.call({ db: client });
    expect(rankings.map((r) => [r.tool_id, r.tool_name, r.score])).toEqual([
      ["tool-a", "Tool A", 9.1],
      ["tool-b", "Tool B", 8.4],
    ]);
  });
});
