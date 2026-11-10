import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * D1c: the harness trending chart shows only harness tools in its combined-board months.
 *
 * Why: the pre-v8 combined boards ranked every kind of tool, so the older months of the
 *   harness chart (T76) showed models and productivity tools. Owner ruling D1c: filter
 *   those months to harness tools only. A display filter: scores are unchanged.
 * What: a combined 2026-10 board ranks a model (m1), harnesses (h1, h2), a productivity
 *   tool (p1) and an unknown tool (z9); the per-list 2026-11 board ranks h2 first. The
 *   2026-10 point names only h1 and h2, renumbered 1 and 2 with their scores unchanged;
 *   the 2026-11 point is as stored. A failed tools lookup is a no-store 500, not cached.
 * Test: `npx vitest run tests/unit/trending-harness-only-d1c.test.ts`. No network.
 */

const state = vi.hoisted(() => ({
  history: {} as Record<string, unknown[]>,
  combined: [] as unknown[],
  lookupFails: false,
}));

vi.mock("server-only", () => ({}));
vi.mock("../../lib/db/connection", () => ({ getDb: () => ({}) }));
vi.mock("../../lib/db/repositories/rankings.repository", () => ({
  rankingsRepository: {
    findAllForList: async (list: string) => state.history[list] ?? [],
    findAll: async () => state.combined,
  },
}));
// The `tools.kind` of each fixture id; z9 is not in the tools table.
const KINDS: Record<string, string> = { h1: "harness", h2: "harness", m1: "model", p1: "productivity" };
vi.mock("../../lib/db/repositories/tools.repository", () => ({
  ToolsRepository: class {
    async findByIds(ids: string[]) {
      if (state.lookupFails) throw new Error("fixture: tools lookup failed");
      return ids.filter((id) => KINDS[id]).map((id) => ({ id, slug: `${id}-slug`, kind: KINDS[id] }));
    }
    async findBySlugs() {
      if (state.lookupFails) throw new Error("fixture: tools lookup failed");
      return [];
    }
  },
}));

import { GET } from "../../app/api/rankings/trending/route";
import { clearCache } from "../../lib/memory-cache";

function board(list: string, period: string, ids: string[]) {
  return {
    id: `${list}-${period}`,
    period,
    list,
    algorithm_version: list === "combined" ? "7.10" : "8.0",
    data: ids.map((id, i) => ({ tool_id: id, tool_slug: `${id}-slug`, tool_name: `Tool ${id}`, rank: i + 1, score: 90 - i })),
  };
}

async function get(query = "") {
  const response = await GET(new Request(`https://example.test/api/rankings/trending${query}`) as never);
  return { response, body: await response.json() };
}

const point = (body: { chart_data: Array<Record<string, unknown>> }, period: string) => {
  const found = body.chart_data.find((p) => p.period === period)!;
  return Object.fromEntries(Object.entries(found).filter(([k]) => k !== "period" && k !== "date"));
};

beforeEach(() => {
  clearCache();
  state.lookupFails = false;
  state.combined = [board("combined", "2026-10", ["m1", "h1", "p1", "z9", "h2"])];
  state.history = {
    harness: [board("harness", "2026-11", ["h2", "h1"])],
    model: [board("model", "2026-11", ["m1"])],
  };
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("GET /api/rankings/trending, harness combined months (D1c)", () => {
  it("a combined month keeps only harness tools, renumbered 1..n in stored order", async () => {
    const { response, body } = await get();
    expect(response.status).toBe(200);
    expect(body.period_sources).toEqual([
      { period: "2026-10", source: "combined" },
      { period: "2026-11", source: "list" },
    ]);
    expect(point(body, "2026-10")).toEqual({ h1: 1, h2: 2 });
    expect(body.tools.map((t: { tool_id: string }) => t.tool_id).sort()).toEqual(["h1", "h2"]);
  });

  it("a per-list month passes through as stored", async () => {
    const { body } = await get();
    expect(point(body, "2026-11")).toEqual({ h2: 1, h1: 2 });
  });

  it("a failed tools lookup is a no-store 500, never the unfiltered history, and is not cached", async () => {
    state.lookupFails = true;
    const failed = await get();
    expect(failed.response.status).toBe(500);
    expect(failed.response.headers.get("Cache-Control")).toBe("no-store");
    expect(failed.body.tools).toBeUndefined();

    state.lookupFails = false;
    const next = await get();
    expect(next.response.status).toBe(200);
    expect(point(next.body, "2026-10")).toEqual({ h1: 1, h2: 2 });
  });

  it("the filter renumbers rank and position and leaves the score and a list period as stored", async () => {
    const { keepCombinedMembers } = await import("../../lib/rankings/trending-history");
    const entry = (id: string, rank: number) => ({ tool_id: id, rank, position: rank, score: 90 - rank });
    const listPeriod = { period: "2026-11", source: "list" as const, rankings: [entry("m1", 1)] };
    const [combined, list] = keepCombinedMembers(
      [{ period: "2026-10", source: "combined" as const, rankings: [entry("h2", 4), entry("m1", 1), entry("h1", 2)] }, listPeriod],
      (e) => e.tool_id.startsWith("h")
    );
    expect(combined!.rankings).toEqual([
      { tool_id: "h1", rank: 1, position: 1, score: 88 },
      { tool_id: "h2", rank: 2, position: 2, score: 86 },
    ]);
    expect(list).toBe(listPeriod);
  });

  it("the model list is unchanged and its periods are not filtered by kind", async () => {
    const { body } = await get("?list=model");
    expect(body.period_sources).toEqual([{ period: "2026-11", source: "list" }]);
  });
});
