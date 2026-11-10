import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #329 option (c), Dfe: the models board lists only models that carry a coding metric.
 *
 * Why: the v8.1 model profile gives a row with no Terminal-Bench figure a neutral benchmark
 *   base of 50, so once some models carry figures a measured model below 42.5% would rank
 *   under every unmeasured one. The read path leaves unmeasured rows off the metric-gated
 *   board; the stored snapshot and the scoring are unchanged.
 * What: mocks the rankings repository (one stored board per list) and the tools repository
 *   (kind, `tools.status` column and data per tool), then reads through
 *   `loadCurrentRankings()`, `GET /api/rankings`, `loadListBoard()` and the D6e gate
 *   `isModelPageVisible()`. Checks a 16-of-51 board, a board with no metric row, and that
 *   the harness and productivity boards are the same whether or not their tools carry a metric.
 * Test: `npx vitest run tests/unit/models-list-metric-filter-329.test.ts`. No network.
 */

const current = vi.hoisted(() => ({ rows: {} as Record<string, unknown> }));

vi.mock("server-only", () => ({}));
vi.mock("../../lib/db/connection", () => ({ getDb: () => ({}) }));
vi.mock("../../lib/db/repositories/rankings.repository", () => ({
  rankingsRepository: { getCurrentRankings: async (list = "combined") => current.rows[list] ?? null },
}));

type FixtureTool = { id: string; slug: string; name: string; kind: string; measured: boolean };
const TOOLS: Record<string, FixtureTool> = {};

const CODING_METRIC = {
  metrics: { terminal_bench: 50 },
  metrics_provenance: { terminal_bench: { source: "https://www.vals.ai/benchmarks/terminal-bench-4" } },
};

vi.mock("../../lib/db/repositories/tools.repository", () => ({
  ToolsRepository: class {
    async findById(id: string) {
      const t = TOOLS[id];
      if (!t) return null;
      const { measured, ...rest } = t;
      return { ...rest, db_id: id, category: "other", status: "active", info: {}, ...(measured ? CODING_METRIC : {}) };
    }
    async findColumnStatuses(ids: string[]) {
      return new Map(ids.filter((id) => TOOLS[id]).map((id) => [id, "active"] as [string, string]));
    }
    async findBySlug() {
      return null;
    }
  },
}));

import { GET } from "../../app/api/rankings/route";
import { loadCurrentRankings } from "../../lib/rankings/current-rankings";
import { loadListBoard } from "../../lib/rankings/list-board";
import { isModelPageVisible } from "../../lib/rankings/model-page-visibility";

/** Seeds `list`'s stored board with `tools` in order; every row scores the neutral 26.6. */
function seed(list: string, tools: Array<{ id: string; measured: boolean }>, kind = list) {
  for (const t of tools) TOOLS[t.id] = { id: t.id, slug: `${t.id}-slug`, name: `Tool ${t.id}`, kind, measured: t.measured };
  const stamp = new Date("2026-11-01T00:00:00Z");
  current.rows[list] = {
    id: `${list}-row`,
    period: "2026-11",
    list,
    algorithm_version: "8.1",
    is_current: true,
    published_at: stamp,
    created_at: stamp,
    updated_at: stamp,
    data: tools.map((t, i) => ({ tool_id: t.id, rank: i + 1, score: 26.6, movement: { previous_position: i + 1, change: 0 } })),
  };
}

/** 51 model rows; the rows at every third position up to 16 carry a metric, so they are interleaved. */
function sixteenOfFiftyOne() {
  let measured = 0;
  return Array.from({ length: 51 }, (_, i) => {
    const m = i % 3 === 1 && measured < 16;
    if (m) measured++;
    return { id: `m${i + 1}`, measured: m };
  });
}

const get = async (query: string) => {
  const response = await GET(new Request(`https://example.test/api/rankings${query}`));
  return { status: response.status, body: await response.json() };
};

beforeEach(() => {
  current.rows = {};
  for (const key of Object.keys(TOOLS)) delete TOOLS[key];
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.stubEnv("NODE_ENV", "production");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("models board: only rows with a coding metric (#329)", () => {
  it("16 metric rows among 51 give 16 rows ranked 1..16, in stored order", async () => {
    const tools = sixteenOfFiftyOne();
    seed("model", tools);
    const board = (await loadCurrentRankings("model"))!;
    expect(board.rankings.map((r) => r.tool.slug)).toEqual(tools.filter((t) => t.measured).map((t) => `${t.id}-slug`));
    expect(board.rankings.map((r) => r.rank)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
    expect(board.metricRowCount).toBe(16);

    const { status, body } = await get("?list=model");
    expect(status).toBe(200);
    expect(body.rankings).toHaveLength(16);
    expect(body.list_meta).toMatchObject({ entry_count: 16, metric_row_count: 16, indexable: true, metrics_pending_note: false });
    expect(body.stats.total_tools).toBe(16);
  });

  it("no metric row: an empty board flagged pending, and the D6e gate keeps the page hidden", async () => {
    seed("model", Array.from({ length: 51 }, (_, i) => ({ id: `m${i + 1}`, measured: false })));
    const board = (await loadCurrentRankings("model"))!;
    expect(board.rankings).toEqual([]);
    expect(board.metricRowCount).toBe(0);

    const { status, body } = await get("?list=model");
    expect(status).toBe(200);
    expect(body.rankings).toEqual([]);
    expect(body._source).toBe("database");
    expect(body.list_meta).toMatchObject({ entry_count: 0, metric_row_count: 0, indexable: false, metrics_pending_note: true });

    expect((await loadListBoard("model")).meta).toMatchObject({ entry_count: 0, metric_row_count: 0 });
    expect(await isModelPageVisible()).toBe(false);
  });
});

describe("harness and productivity boards are not filtered (#329)", () => {
  it.each(["harness", "productivity"])("the %s board is the same whether or not its rows carry a metric", async (list) => {
    const ids = Array.from({ length: 12 }, (_, i) => `${list}${i + 1}`);
    seed(list, ids.map((id) => ({ id, measured: false })));
    const unmeasured = JSON.stringify(await loadCurrentRankings(list as "harness" | "productivity"));
    seed(list, ids.map((id, i) => ({ id, measured: i % 2 === 0 })));
    const mixed = await loadCurrentRankings(list as "harness" | "productivity");
    expect(mixed!.rankings).toHaveLength(12);
    expect(JSON.stringify(mixed)).toBe(unmeasured);
  });
});
