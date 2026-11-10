import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #185 H1: `/api/rankings/current` and `/api/rankings/trending` serve per-list data.
 *
 * Why: the acceptance criterion H1 of the v8 activation: neither route may serve the
 *   legacy combined board. Each serves one list's board, the default (coding
 *   harnesses) when no list is named, or the list a `list` (alias `kind`) parameter
 *   names. A failed read must be an error, never an empty success or the combined board.
 * What: mocks the rankings repository with a current combined row and current and
 *   historical rows per list, recording every list read, and calls both GET handlers.
 *   Checks the default list, a named list by id and by slug, 400 on a bad list, 404 for
 *   a list with no current row, 500 on a failed read, and that `/current` never reads
 *   the combined rows. T76: the harness trending history adds the combined periods
 *   before its first per-list period, each tagged with its source; a per-list period
 *   wins over a combined one; the model list reads no combined rows; a failed combined
 *   read is a 500, never a per-list-only 200.
 * Test: `npx vitest run tests/unit/rankings-current-trending-185.test.ts`. No network.
 */

const repo = vi.hoisted(() => ({
  current: {} as Record<string, unknown>,
  history: {} as Record<string, unknown[]>,
  reads: [] as string[],
  failing: null as string | null,
  findAllCalls: 0,
}));

vi.mock("server-only", () => ({}));
vi.mock("../../lib/db/connection", () => ({ getDb: () => ({}) }));
vi.mock("../../lib/db/repositories/rankings.repository", () => ({
  rankingsRepository: {
    getCurrentRankings: async (list = "combined") => {
      repo.reads.push(`current:${list}`);
      if (repo.failing === list) throw new Error(`fixture: ${list} read failed`);
      return repo.current[list] ?? null;
    },
    findAllForList: async (list: string) => {
      repo.reads.push(`history:${list}`);
      if (repo.failing === list) throw new Error(`fixture: ${list} read failed`);
      return repo.history[list] ?? [];
    },
    findAll: async () => {
      repo.findAllCalls++;
      if (repo.failing === "combined") throw new Error("fixture: combined read failed");
      return repo.history["combined"] ?? [];
    },
  },
}));
const CODING_METRIC = vi.hoisted(() => ({
  metrics: { terminal_bench: 50 },
  metrics_provenance: { terminal_bench: { source: "https://www.vals.ai/benchmarks/terminal-bench-4" } },
}));
vi.mock("../../lib/db/repositories/tools.repository", () => ({
  ToolsRepository: class {
    async findByIds(ids: string[]) {
      // #329: the model fixtures (m*) carry a Vals TB 4.0 figure, so the models board keeps them.
      return ids.map((id) => ({ id, slug: `${id}-slug`, name: `Tool ${id}`, category: "other", status: "active", ...(id.startsWith("m") ? CODING_METRIC : {}) }));
    }
    async findBySlugs() {
      return [];
    }
  },
}));

import { GET as currentGET } from "../../app/api/rankings/current/route";
import { GET as trendingGET } from "../../app/api/rankings/trending/route";
import { clearCache } from "../../lib/memory-cache";

function row(list: string, period: string, ids: string[], isCurrent = true) {
  return {
    id: `${list}-${period}`,
    period,
    list,
    algorithm_version: list === "combined" ? "7.10" : "8.0",
    is_current: isCurrent,
    published_at: new Date(`${period}-01T09:00:00Z`),
    created_at: new Date(`${period}-01T09:00:00Z`),
    updated_at: new Date(`${period}-01T09:00:00Z`),
    data: ids.map((id, i) => ({ tool_id: id, tool_slug: `${id}-slug`, tool_name: `Tool ${id}`, rank: i + 1, score: 90 - i })),
  };
}

const HARNESS = ["h1", "h2", "h3"];
const MODELS = ["m1", "m2"];
const COMBINED = ["m1", "h1", "x-image", "h2", "m2", "h3", "o1"];

beforeEach(() => {
  clearCache();
  repo.current = {
    combined: row("combined", "2026-10", COMBINED),
    harness: row("harness", "2026-11", HARNESS),
    model: row("model", "2026-11", MODELS),
  };
  repo.history = {
    combined: [row("combined", "2026-10", COMBINED), row("combined", "2026-09", COMBINED, false)],
    harness: [row("harness", "2026-11", HARNESS)],
    model: [row("model", "2026-11", MODELS)],
  };
  repo.reads = [];
  repo.failing = null;
  repo.findAllCalls = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const ids = (rankings: Array<{ tool_id: string }>) => rankings.map((r) => r.tool_id);
const noCombinedRead = () => {
  expect(repo.reads.filter((r) => r.endsWith(":combined"))).toEqual([]);
  expect(repo.findAllCalls).toBe(0);
};

describe("GET /api/rankings/current (#185 H1)", () => {
  const get = async (query = "") => {
    const response = await currentGET(new Request(`https://example.test/api/rankings/current${query}`));
    return { status: response.status, body: await response.json() };
  };

  it("with no list it serves the coding-harness board, named, not the combined board", async () => {
    const { status, body } = await get();
    expect(status).toBe(200);
    expect(body.data.list).toBe("harness");
    expect(body.data.list_meta).toMatchObject({ list: "harness", entry_count: 3 });
    expect(body.data.algorithm_version).toBe("8.0");
    expect(ids(body.data.rankings)).toEqual(HARNESS);
    noCombinedRead();
  });

  it("GET with a bare request URL is the default list too", async () => {
    const body = await (await currentGET(new Request("http://localhost/api/rankings/current"))).json();
    expect(body.data.list).toBe("harness");
  });

  it.each([
    ["?list=model", "model"],
    ["?list=models", "model"],
    ["?kind=model", "model"],
  ])("%s serves the %s board", async (query, list) => {
    const { status, body } = await get(query);
    expect(status).toBe(200);
    expect(body.data.list).toBe(list);
    expect(ids(body.data.rankings)).toEqual(MODELS);
    noCombinedRead();
  });

  it.each(["?list=combined", "?list=", "?list=model&kind=harness"])("%s is a 400 with no rows", async (query) => {
    const { status, body } = await get(query);
    expect(status).toBe(400);
    expect(body.data).toBeUndefined();
    expect(body.lists).toEqual(["harness", "model", "productivity"]);
    expect(repo.reads).toEqual([]);
  });

  it("a list with no current row is a 404, and the combined row is not read instead", async () => {
    const { status, body } = await get("?list=productivity");
    expect(status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.list).toBe("productivity");
    noCombinedRead();
  });

  it("a failed list read is a 500 with no rows, and the combined row is not read instead", async () => {
    repo.failing = "harness";
    const { status, body } = await get();
    expect(status).toBe(500);
    expect(body.data).toBeUndefined();
    noCombinedRead();
  });

  // #185 M3: a non-200 must not be kept by the CDN or the in-memory cache.
  const cacheControl = async (query = "") =>
    (await currentGET(new Request(`https://example.test/api/rankings/current${query}`))).headers.get("Cache-Control");

  // #311: the edge cannot be purged on publish, so a 200 is no-store too.
  it("a 200, a 404 and a 500 are all no-store", async () => {
    expect(await cacheControl()).toBe("no-store");
    expect(await cacheControl("?list=productivity")).toBe("no-store");
    repo.failing = "model";
    expect(await cacheControl("?list=model")).toBe("no-store");
  });

  it("a 404 is not held in memory: the list's first board is served on the next request", async () => {
    expect((await get("?list=productivity")).status).toBe(404);
    repo.current["productivity"] = row("productivity", "2026-11", ["p1"]);
    const { status, body } = await get("?list=productivity");
    expect(status).toBe(200);
    expect(ids(body.data.rankings)).toEqual(["p1"]);
  });
});

describe("GET /api/rankings/trending (#185 H1, T76)", () => {
  const request = (query = "") =>
    trendingGET(new Request(`https://example.test/api/rankings/trending${query}`) as never);
  const get = async (query = "") => {
    const response = await request(query);
    return { status: response.status, body: await response.json() };
  };
  const toolIds = (body: { tools: Array<{ tool_id: string }> }) => body.tools.map((t) => t.tool_id).sort();
  // T76: the combined rows are read only through `findAll()`, never as a list read.
  const noCombinedListRead = () => expect(repo.reads.filter((r) => r.endsWith(":combined"))).toEqual([]);
  const monthsFrom = (start: string, count: number) =>
    Array.from({ length: count }, (_, i) => {
      const d = new Date(`${start}-01T00:00:00Z`);
      d.setUTCMonth(d.getUTCMonth() + i);
      return d.toISOString().slice(0, 7);
    });

  it("with no list it analyzes the harness history, with the combined periods before its first board", async () => {
    const { status, body } = await get();
    expect(status).toBe(200);
    expect(body.list).toBe("harness");
    expect(body.periods).toEqual(["2026-09", "2026-10", "2026-11"]);
    expect(body.period_sources).toEqual([
      { period: "2026-09", source: "combined" },
      { period: "2026-10", source: "combined" },
      { period: "2026-11", source: "list" },
    ]);
    expect(body.metadata.first_list_period).toBe("2026-11");
    expect(toolIds(body)).toEqual(expect.arrayContaining(HARNESS));
    expect(repo.findAllCalls).toBe(1);
    noCombinedListRead();
  });

  it("?list=models analyzes the model history and reads no combined rows", async () => {
    const { status, body } = await get("?list=models&months=all");
    expect(status).toBe(200);
    expect(body.list).toBe("model");
    expect(body.periods).toEqual(["2026-11"]);
    expect(body.period_sources).toEqual([{ period: "2026-11", source: "list" }]);
    expect(body.metadata.first_list_period).toBe("2026-11");
    expect(toolIds(body)).toEqual(MODELS);
    noCombinedRead();
  });

  it("caches per list: the harness answer is not served for the model list", async () => {
    await get();
    const { body } = await get("?list=model");
    expect(body.list).toBe("model");
  });

  it("an unknown list is a 400", async () => {
    const { status, body } = await get("?list=combined");
    expect(status).toBe(400);
    expect(body.tools).toBeUndefined();
    expect(repo.reads).toEqual([]);
  });

  it("a failed read is a 500, never an empty 200, and is not cached", async () => {
    repo.failing = "harness";
    const failed = await get();
    expect(failed.status).toBe(500);
    expect(failed.body.tools).toBeUndefined();
    noCombinedRead();

    repo.failing = null;
    const next = await get();
    expect(next.status).toBe(200);
    expect(next.body.periods).toEqual(["2026-09", "2026-10", "2026-11"]);
  });

  it("a list with no stored boards is an empty 200 with a warning", async () => {
    const { status, body } = await get("?list=productivity");
    expect(status).toBe(200);
    expect(body.list).toBe("productivity");
    expect(body.periods).toEqual([]);
    expect(body.warning).toBeTruthy();
    noCombinedRead();
  });

  it("a harness with no per-list board has no boundary, so no combined history", async () => {
    repo.history.harness = [];
    const { status, body } = await get();
    expect(status).toBe(200);
    expect(body.periods).toEqual([]);
    expect(body.metadata.first_list_period).toBeNull();
    noCombinedRead();
  });

  it("combined 2025-06..2026-10 and per-list 2026-11 are 18 periods, and the etag counts them", async () => {
    repo.history.combined = [];
    const before = await request();
    expect(before.headers.get("ETag")).toBe('"trending-harness-1-all"');

    clearCache();
    const combined = monthsFrom("2025-06", 17);
    expect(combined[combined.length - 1]).toBe("2026-10");
    repo.history.combined = combined.reverse().map((p) => row("combined", p, COMBINED, false));
    const response = await request();
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=3600, s-maxage=3600");
    expect(response.headers.get("ETag")).toBe('"trending-harness-18-all"');

    const body = await response.json();
    expect(body.periods).toEqual([...monthsFrom("2025-06", 17), "2026-11"]);
    expect(body.metadata.total_periods).toBe(18);
    expect(body.metadata.date_range).toEqual({ start: "2025-06", end: "2026-11" });
    expect(body.metadata.first_list_period).toBe("2026-11");
    expect(body.period_sources.map((p: { source: string }) => p.source)).toEqual([
      ...Array(17).fill("combined"),
      "list",
    ]);
    expect(body.period_sources.map((p: { period: string }) => p.period)).toEqual(body.periods);
  });

  it("when combined and per-list both hold 2026-11, the per-list board wins and the period appears once", async () => {
    repo.history.combined = [row("combined", "2026-11", COMBINED), row("combined", "2026-10", COMBINED, false)];
    const { body } = await get();
    expect(body.periods).toEqual(["2026-10", "2026-11"]);
    expect(body.period_sources).toEqual([
      { period: "2026-10", source: "combined" },
      { period: "2026-11", source: "list" },
    ]);
    const latest = body.chart_data[body.chart_data.length - 1];
    expect(latest.period).toBe("2026-11");
    // The combined 2026-11 board ranks m1 first; the harness board ranks h1 first.
    expect(latest.h1).toBe(1);
    expect(latest.m1).toBeNull();
  });

  it("a failed combined read is a no-store 500, never a per-list-only 200, and is not cached", async () => {
    repo.failing = "combined";
    const response = await request();
    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = await response.json();
    expect(body.periods).toBeUndefined();
    expect(body.tools).toBeUndefined();

    repo.failing = null;
    const next = await get();
    expect(next.status).toBe(200);
    expect(next.body.periods).toEqual(["2026-09", "2026-10", "2026-11"]);
  });
});
