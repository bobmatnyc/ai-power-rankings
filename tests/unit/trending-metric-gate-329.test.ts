import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #329: `/api/rankings/trending?list=model` shows measured models only, in every period.
 *
 * Why: a stored model board written before the generation-side exclusion still holds
 *   unmeasured models; the trending chart must not give them a position or a trend.
 * What: two stored model boards, each with an unmeasured model at rank 1 (the latest
 *   period and a past period's top 10). The response names no unmeasured model and the
 *   measured models keep their order. The harness list is not gated and reads no tools.
 *   A tools lookup that throws is a 500, never the ungated board.
 * Test: `npx vitest run tests/unit/trending-metric-gate-329.test.ts`. No network.
 */

const state = vi.hoisted(() => ({
  history: {} as Record<string, unknown[]>,
  toolReads: 0,
  lookupFails: false,
}));

vi.mock("server-only", () => ({}));
vi.mock("../../lib/db/connection", () => ({ getDb: () => ({}) }));
vi.mock("../../lib/db/repositories/rankings.repository", () => ({
  rankingsRepository: {
    findAllForList: async (list: string) => state.history[list] ?? [],
    // T76: the harness list also reads the combined boards; none here.
    findAll: async () => [],
  },
}));
vi.mock("../../lib/db/repositories/tools.repository", () => ({
  ToolsRepository: class {
    async findByIds(ids: string[]) {
      state.toolReads++;
      if (state.lookupFails) throw new Error("fixture: tools lookup failed");
      // Ids starting with "m" carry a Vals TB 4.0 figure; "u" ids have no coding metric.
      return ids.map((id) => ({
        id,
        slug: `${id}-slug`,
        ...(id.startsWith("m")
          ? { metrics: { terminal_bench: 50 }, metrics_provenance: { terminal_bench: { source: "https://www.vals.ai/benchmarks/terminal-bench-4" } } }
          : { metrics: {} }),
      }));
    }
    async findBySlugs() {
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
    algorithm_version: "8.1",
    data: ids.map((id, i) => ({ tool_id: id, tool_slug: `${id}-slug`, tool_name: `Tool ${id}`, rank: i + 1, score: 90 - i })),
  };
}

async function get(query: string) {
  const response = await GET(new Request(`https://example.test/api/rankings/trending${query}`) as never);
  return { status: response.status, body: await response.json() };
}

const toolIds = (body: { tools: Array<{ tool_id: string }> }) => body.tools.map((t) => t.tool_id);
const chartKeys = (body: { chart_data: Array<Record<string, unknown>> }) =>
  body.chart_data.flatMap((point) => Object.keys(point).filter((k) => k !== "period" && k !== "date"));

beforeEach(() => {
  clearCache();
  state.toolReads = 0;
  state.lookupFails = false;
  state.history = {
    model: [board("model", "2026-10", ["u1", "m2", "m1", "m3"]), board("model", "2026-11", ["u2", "m1", "m2", "m3"])],
    harness: [board("harness", "2026-11", ["u9", "h1"])],
  };
});

describe("GET /api/rankings/trending, metric-gated list (#329)", () => {
  it("names no unmeasured model in any period and keeps the measured order", async () => {
    const { status, body } = await get("?list=model&months=all");
    expect(status).toBe(200);
    expect(toolIds(body).sort()).toEqual(["m1", "m2", "m3"]);
    expect(chartKeys(body).filter((k) => k.startsWith("u"))).toEqual([]);
    const current = Object.fromEntries(body.tools.map((t: { tool_id: string; current_position: number }) => [t.tool_id, t.current_position]));
    expect(current).toEqual({ m1: 1, m2: 2, m3: 3 });
    const past = body.chart_data.find((p: { period: string }) => p.period === "2026-10");
    expect([past.m2, past.m1, past.m3]).toEqual([1, 2, 3]);
  });

  it("leaves a list that is not metric-gated as stored and reads no tools", async () => {
    const { status, body } = await get("?list=harness");
    expect(status).toBe(200);
    expect(toolIds(body).sort()).toEqual(["h1", "u9"]);
    expect(state.toolReads).toBe(0);
  });

  it("a tools lookup that throws is a 500, never the ungated board", async () => {
    state.lookupFails = true;
    const { status, body } = await get("?list=model");
    expect(status).toBe(500);
    expect(body.tools).toBeUndefined();
  });
});
