import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #185: `/api/tools/[slug]/json` takes a tool's rank from its own list's board.
 *
 * Why: the tool page header reads its rank from this route. After v8 activation the
 *   combined board is no public view, so the rank is the tool's rank within its list
 *   (D2e); a tool in no list is unranked, and a failed list read leaves the rank empty
 *   instead of reading the combined board.
 * What: calls the GET handler with the tools, news and rankings repositories mocked
 *   and a database stand-in that answers every other query with no rows. Records the
 *   list of every ranking read.
 * Test: `npx vitest run tests/unit/tool-json-rank-185.test.ts`. No database, no network.
 */

const state = vi.hoisted(() => ({
  tool: null as Record<string, unknown> | null,
  boards: {} as Record<string, unknown>,
  reads: [] as unknown[],
  failing: false,
}));

vi.mock("server-only", () => ({}));
vi.mock("../../lib/db/connection", () => {
  // Every query chain resolves to no rows.
  const chain: unknown = new Proxy(() => chain, {
    get: (_target, key) => (key === "then" ? (resolve: (v: unknown[]) => void) => resolve([]) : chain),
    apply: () => chain,
  });
  return { getDb: () => chain };
});
vi.mock("../../lib/db/repositories/tools.repository", () => ({
  ToolsRepository: class {
    async findBySlug() {
      return state.tool;
    }
  },
}));
vi.mock("../../lib/db/repositories/news", () => ({
  NewsRepository: class {
    async searchByToolName() {
      return [];
    }
  },
}));
vi.mock("../../lib/db/repositories/rankings.repository", () => ({
  rankingsRepository: {
    getCurrentRankings: async (list?: unknown) => {
      state.reads.push(list);
      if (state.failing) throw new Error("fixture: list read failed");
      return state.boards[String(list)] ?? null;
    },
  },
}));

import { GET } from "../../app/api/tools/[slug]/json/route";

const board = (list: string, ids: string[]) => ({
  period: "2026-11",
  list,
  algorithm_version: list === "combined" ? "7.10" : "8.0",
  data: ids.map((id, i) => ({ tool_id: id, tool_slug: `${id}-slug`, tool_name: `Tool ${id}`, rank: i + 1, score: 80 - i })),
});

beforeEach(() => {
  state.tool = { id: "m2", slug: "m2-slug", name: "Tool m2", category: "llm", status: "active", kind: "model", info: {} };
  // m2 is 2nd among models but 5th on the combined board.
  state.boards = {
    combined: board("combined", ["h1", "h2", "m1", "h3", "m2"]),
    model: board("model", ["m1", "m2"]),
  };
  state.reads = [];
  state.failing = false;
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const get = async () => {
  const response = await GET(new Request("https://example.test/api/tools/m2-slug/json") as never, {
    params: Promise.resolve({ slug: "m2-slug" }),
  });
  return { status: response.status, body: await response.json() };
};

describe("GET /api/tools/[slug]/json rank (#185)", () => {
  it("the rank is the tool's rank within its own list", async () => {
    const { status, body } = await get();
    expect(status).toBe(200);
    expect(body.ranking).toMatchObject({ list: "model", rank: 2 });
    expect(state.reads).toEqual(["model"]);
  });

  it("a tool in no list is unranked and makes no ranking read", async () => {
    state.tool = { ...state.tool!, kind: "other" };
    const { body } = await get();
    expect(body.ranking).toBeNull();
    expect(state.reads).toEqual([]);
  });

  it("a failed list read leaves the rank empty and never reads the combined board", async () => {
    state.failing = true;
    const { status, body } = await get();
    expect(status).toBe(200);
    expect(body.ranking).toBeNull();
    expect(state.reads).toEqual(["model"]);
  });
});
