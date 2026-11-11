import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #197: no tool whose slug is noindex (`isNoindexToolSlug`) appears on a ranking board
 * or a ranking API.
 *
 * Why: the noindex slugs are non-AI entities kept out of the sitemap, robots and
 *   `/api/tools`; a ranking board that still ranked one would link to and rank a page
 *   the site tells crawlers to ignore.
 * What: a synthetic slug is marked noindex through a wrapped `isNoindexToolSlug` (the
 *   real set stays in force), so the test does not depend on the table's contents. The
 *   harness and model boards each hold that tool among listed tools, the model one with
 *   a coding metric so it would count toward `metric_row_count`. The checks: the board
 *   (`loadCurrentRankings`), `/api/rankings`, `/api/rankings/current` and
 *   `/api/rankings/trending` leave the slug out; ranks run 1..n with no gap; the metric
 *   count excludes it; `/api/rankings` and `/api/rankings/current` hold the same
 *   members; a board with no noindex slug is served as stored.
 * Test: `npx vitest run tests/unit/rankings-noindex-197.test.ts`. No database, no network.
 */

const NOINDEX = "synthetic-unlisted-entity-197";
const METRIC = vi.hoisted(() => ({
  metrics: { terminal_bench: 50 },
  metrics_provenance: { terminal_bench: { source: "https://www.vals.ai/benchmarks/terminal-bench-4" } },
}));

const state = vi.hoisted(() => ({
  current: {} as Record<string, unknown>,
  history: {} as Record<string, unknown[]>,
}));

vi.mock("server-only", () => ({}));
vi.mock("../../lib/db/connection", () => ({ getDb: () => ({}) }));
vi.mock("../../lib/db/repositories/rankings.repository", () => ({
  rankingsRepository: {
    getCurrentRankings: async (list = "combined") => state.current[list] ?? null,
    findAllForList: async (list: string) => state.history[list] ?? [],
    findAll: async () => [],
  },
}));

/** `x*` ids are the noindex tool (slug NOINDEX); `h*` harnesses; `m*` measured models. */
const toolOf = vi.hoisted(() => (id: string) => ({
  id,
  db_id: id,
  slug: id.startsWith("x") ? "synthetic-unlisted-entity-197" : `${id}-slug`,
  name: `Tool ${id}`,
  category: "other",
  kind: id.startsWith("m") || id === "xm" ? "model" : "harness",
  status: "active",
  info: {},
  ...(id.startsWith("m") || id === "xm" ? METRIC : {}),
}));

vi.mock("../../lib/db/repositories/tools.repository", () => ({
  ToolsRepository: class {
    async findById(id: string) {
      return toolOf(id);
    }
    async findByIds(ids: string[]) {
      return ids.map(toolOf);
    }
    async findBySlugs() {
      return [];
    }
    async findBySlug() {
      return null;
    }
    async findColumnStatuses(ids: string[]) {
      return new Map(ids.map((id) => [id, "active"] as [string, string]));
    }
  },
}));

// The real set stays in force; one synthetic slug is added on top of it.
vi.mock("../../lib/seo/url-table", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/seo/url-table")>();
  return {
    ...actual,
    isNoindexToolSlug: (slug: string) => slug === NOINDEX || actual.isNoindexToolSlug(slug),
  };
});

import { GET as currentGET } from "../../app/api/rankings/current/route";
import { GET as rankingsGET } from "../../app/api/rankings/route";
import { GET as trendingGET } from "../../app/api/rankings/trending/route";
import { loadCurrentRankings } from "../../lib/rankings/current-rankings";
import { clearCache } from "../../lib/memory-cache";

const BOARDS: Record<string, string[]> = {
  harness: ["h1", "xh", "h2", "h3"],
  model: ["xm", "m1", "m2"],
};

function stored(list: string, period: string, ids: string[]) {
  return {
    id: `${list}-${period}`,
    period,
    list,
    algorithm_version: "8.1",
    is_current: true,
    published_at: new Date("2026-11-01T00:00:00Z"),
    created_at: new Date("2026-11-01T00:00:00Z"),
    data: ids.map((id, i) => ({
      tool_id: id,
      tool_slug: toolOf(id).slug,
      tool_name: `Tool ${id}`,
      rank: i + 1,
      score: 90 - i,
      tier: i === 0 ? "S" : "A",
      movement: { previous_position: i + 1, change: 0 },
    })),
  };
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

async function json(res: Response) {
  return { status: res.status, body: await res.json() };
}

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  clearCache();
  state.current = {
    harness: stored("harness", "2026-11", BOARDS["harness"]!),
    model: stored("model", "2026-11", BOARDS["model"]!),
  };
  state.history = {
    harness: [stored("harness", "2026-10", ["xh", "h2", "h1"]), stored("harness", "2026-11", BOARDS["harness"]!)],
    model: [stored("model", "2026-11", BOARDS["model"]!)],
  };
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("#197 the ranking board leaves noindex tool slugs out", () => {
  it.each(["harness", "model"] as const)("%s: the slug is absent and ranks run 1..n", async (list) => {
    const board = (await loadCurrentRankings(list))!;
    const slugs = board.rankings.map((r) => r.tool.slug);
    expect(slugs).not.toContain(NOINDEX);
    expect(slugs).toHaveLength(BOARDS[list]!.length - 1);
    expect(board.rankings.map((r) => r.rank)).toEqual(range(slugs.length));
  });

  it("the model list's metric count excludes the noindex tool", async () => {
    const board = (await loadCurrentRankings("model"))!;
    expect(board.metricRowCount).toBe(2);
  });
});

describe("#197 /api/rankings and /api/rankings/current leave noindex tool slugs out", () => {
  it.each(["harness", "model"] as const)("%s: same members on both routes, ranked 1..n", async (list) => {
    const rankings = await json(await rankingsGET(new Request(`https://example.test/api/rankings?list=${list}`)));
    const current = await json(await currentGET(new Request(`https://example.test/api/rankings/current?list=${list}`)));
    expect(rankings.status).toBe(200);
    expect(current.status).toBe(200);

    const a = (rankings.body.rankings as Array<{ tool: { slug: string }; rank: number }>);
    const b = (current.body.data.rankings as Array<{ tool_slug: string; position: number }>);
    expect(a.map((r) => r.tool.slug)).not.toContain(NOINDEX);
    expect(b.map((r) => r.tool_slug)).not.toContain(NOINDEX);
    expect(a.map((r) => r.rank)).toEqual(range(a.length));
    expect(b.map((r) => r.position)).toEqual(range(b.length));
    expect(b.map((r) => r.tool_slug)).toEqual(a.map((r) => r.tool.slug));

    const expectedMetric = list === "model" ? 2 : 0;
    expect(rankings.body.list_meta.metric_row_count).toBe(expectedMetric);
    expect(current.body.data.list_meta.metric_row_count).toBe(expectedMetric);
    expect(current.body.data.list_meta.entry_count).toBe(a.length);
  });

  it("a board with no noindex slug is served as stored", async () => {
    state.current["harness"] = stored("harness", "2026-11", ["h1", "h2", "h3"]);
    const current = await json(await currentGET(new Request("https://example.test/api/rankings/current?list=harness")));
    const rows = current.body.data.rankings as Array<{ tool_slug: string; position: number; tier: string }>;
    expect(rows.map((r) => [r.tool_slug, r.position, r.tier])).toEqual([
      ["h1-slug", 1, "S"],
      ["h2-slug", 2, "A"],
      ["h3-slug", 3, "A"],
    ]);
  });
});

describe("#197 /api/rankings/trending leaves noindex tool slugs out", () => {
  it.each(["harness", "model"] as const)("%s: no period ranks the slug; current positions run 1..n", async (list) => {
    const { status, body } = await json(await trendingGET(new Request(`https://example.test/api/rankings/trending?list=${list}`) as never));
    expect(status).toBe(200);
    const ids = (body.tools as Array<{ tool_id: string }>).map((t) => t.tool_id);
    expect(ids).not.toContain(`x${list[0]}`);
    const chartKeys = (body.chart_data as Array<Record<string, unknown>>).flatMap((p) => Object.keys(p));
    expect(chartKeys).not.toContain(`x${list[0]}`);
    const positions = (body.tools as Array<{ current_position: number }>).map((t) => t.current_position).sort();
    expect(positions).toEqual(range(BOARDS[list]!.length - 1));
  });
});
