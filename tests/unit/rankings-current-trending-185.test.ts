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
 *   a list with no current row, 500 on a failed read, and that the combined rows and
 *   the combined `findAll()` are never read.
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
      return repo.history["combined"] ?? [];
    },
  },
}));
vi.mock("../../lib/db/repositories/tools.repository", () => ({
  ToolsRepository: class {
    async findByIds(ids: string[]) {
      return ids.map((id) => ({ id, slug: `${id}-slug`, name: `Tool ${id}`, category: "other", status: "active" }));
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

  it("a 200 is publicly cacheable; a 404 and a 500 are no-store", async () => {
    expect(await cacheControl()).toBe("public, s-maxage=3600, stale-while-revalidate=86400");
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

describe("GET /api/rankings/trending (#185 H1)", () => {
  const get = async (query = "") => {
    const response = await trendingGET(new Request(`https://example.test/api/rankings/trending${query}`) as never);
    return { status: response.status, body: await response.json() };
  };

  it("with no list it analyzes the coding-harness history only", async () => {
    const { status, body } = await get();
    expect(status).toBe(200);
    expect(body.list).toBe("harness");
    expect(body.periods).toEqual(["2026-11"]);
    expect(body.tools.map((t: { tool_id: string }) => t.tool_id).sort()).toEqual(HARNESS);
    noCombinedRead();
  });

  it("?list=models analyzes the model history", async () => {
    const { status, body } = await get("?list=models&months=all");
    expect(status).toBe(200);
    expect(body.list).toBe("model");
    expect(body.tools.map((t: { tool_id: string }) => t.tool_id).sort()).toEqual(MODELS);
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
    expect(next.body.periods).toEqual(["2026-11"]);
  });

  it("a list with no stored boards is an empty 200 with a warning", async () => {
    const { status, body } = await get("?list=productivity");
    expect(status).toBe(200);
    expect(body.list).toBe("productivity");
    expect(body.periods).toEqual([]);
    expect(body.warning).toBeTruthy();
  });
});
