import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #329 (Dfe option c): every public model rank comes from the measured-only board.
 *
 * Why: an unmeasured model gets a neutral benchmark base, so it would rank above measured
 *   models. The models board lists measured models only; the stored board, the per-list
 *   publish and `/api/rankings/current` must give the same ranks, and a filtered board
 *   must not show a move counted on the unfiltered one.
 * What: (1) the pure gate: measured entries renumbered 1..n with previous ranks renumbered
 *   among them, any other list untouched. (2) the per-list publish over the in-memory
 *   Drizzle stand-in: 16 measured and 35 unmeasured models store 16 rows; the harness row
 *   is the same whatever the models carry. (3) `GET /api/rankings/current?list=model`
 *   returns only measured rows, ranked as `loadCurrentRankings()` ranks them.
 *   The tool page and `/api/tools/[slug]/json` are covered in `tool-profile-193.test.tsx`
 *   and `tool-json-rank-185.test.ts`.
 * Test: `npx vitest run tests/unit/models-public-rank-329.test.ts`. No network.
 */

const VALS = "https://www.vals.ai/benchmarks/terminal-bench-4";
const METRIC = { metrics: { terminal_bench: 50 }, metrics_provenance: { terminal_bench: { source: VALS } } };

const state = vi.hoisted(() => ({
  client: null as unknown,
  current: {} as Record<string, unknown>,
  tools: {} as Record<string, Record<string, unknown>>,
  statusReadFails: false,
}));

vi.mock("server-only", () => ({}));
vi.mock("../../lib/db/connection", () => ({ getDb: () => state.client ?? {} }));
vi.mock("../../lib/db/repositories/rankings.repository", () => ({
  rankingsRepository: { getCurrentRankings: async (list = "combined") => state.current[list] ?? null },
}));
vi.mock("../../lib/db/repositories/tools.repository", () => ({
  ToolsRepository: class {
    async findById(id: string) {
      return state.tools[id] ?? null;
    }
    async findByIds(ids: string[]) {
      return ids.flatMap((id) => (state.tools[id] ? [state.tools[id]] : []));
    }
    async findBySlugs() {
      return [];
    }
    async findBySlug() {
      return null;
    }
    async findColumnStatuses(ids: string[]) {
      if (state.statusReadFails) throw new Error("fixture: tools.status read failed");
      return new Map(ids.map((id) => [id, "active"] as [string, string]));
    }
  },
}));

import { GET as currentGET } from "../../app/api/rankings/current/route";
import { GET as rankingsGET } from "../../app/api/rankings/route";
import { createFakeRankingsDb, type FakeToolRow, rankingRow } from "../../lib/services/__fixtures__/fake-rankings-db";
import { loadCurrentRankings } from "../../lib/rankings/current-rankings";
import { gateStoredEntries, renumberPrevious } from "../../lib/rankings/metric-gated-board";
import { regenerateRankings } from "../../lib/services/ranking-generation.service";
import { clearCache } from "../../lib/memory-cache";

/** 51 model ids; every third from m2 carries a metric, 16 in all. */
const MODEL_IDS = Array.from({ length: 51 }, (_, i) => `m${i + 1}`);
const MEASURED = new Set(MODEL_IDS.filter((_, i) => i % 3 === 1).slice(0, 16));

beforeEach(() => {
  state.client = null;
  state.current = {};
  state.tools = {};
  state.statusReadFails = false;
  clearCache();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("the measured-only gate (#329)", () => {
  it("renumbers previous ranks among the kept rows, so rank 3 of 16 never shows +30", () => {
    expect(renumberPrevious([33, null, 2, 40])).toEqual([
      { previous: 2, change: 1 },
      { previous: null, change: 0 },
      { previous: 1, change: -2 },
      { previous: 3, change: -1 },
    ]);
  });

  it("keeps measured entries ranked 1..n; a list that is not metric-gated is the same array", () => {
    const entries = MODEL_IDS.map((id, i) => ({ tool_id: id, rank: i + 1, movement: { previous_position: 51 - i, change: 0 } }));
    const gated = gateStoredEntries("model", entries, (e) => MEASURED.has(e["tool_id"] as string));
    expect(gated.map((e) => e["tool_id"])).toEqual([...MEASURED]);
    expect(gated.map((e) => e["rank"])).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
    expect(gated.map((e) => (e["movement"] as { previous_position: number }).previous_position)).toEqual(
      Array.from({ length: 16 }, (_, i) => 16 - i)
    );
    expect(gateStoredEntries("harness", entries, () => false)).toBe(entries);
  });
});

describe("per-list publish leaves unmeasured models off the stored board (#329)", () => {
  const stamp = new Date("2026-01-01T00:00:00Z");
  const now = () => new Date("2026-11-01T09:00:00.000Z");
  const row = (id: string, kind: string, users: number, measured = false): FakeToolRow => ({
    id,
    name: `Tool ${id}`,
    slug: `${id}-slug`,
    category: "other",
    status: "active",
    kind,
    data: {
      info: { description: id },
      metrics: { users, github_stars: users / 10, ...(measured ? { terminal_bench: 50 } : {}) },
      ...(measured ? { metrics_provenance: METRIC.metrics_provenance } : {}),
    },
    createdAt: stamp,
    updatedAt: stamp,
  });
  const harness = Array.from({ length: 10 }, (_, i) => row(`h${i + 1}`, "harness", 9_000_000 - i * 400_000));
  const models = (measured: (id: string) => boolean) =>
    MODEL_IDS.map((id, i) => row(id, "model", 8_000_000 - i * 100_000, measured(id)));

  async function publish(tools: FakeToolRow[]) {
    // The current 51-row model board, ranked m51..m1, so previous ranks run 51..1 for m1..m51.
    const modelBoard = [...MODEL_IDS].reverse().map((id, i) => ({ tool_id: id, rank: i + 1 }));
    const fake = createFakeRankingsDb({
      tools,
      rankings: [rankingRow({ period: "2026-10", isCurrent: true, data: modelBoard, id: "model-2026-10", list: "model" })],
    });
    state.client = fake.client;
    await regenerateRankings({ now, layout: "per-list" });
    const stored = (list: string) => fake.state.rankings.find((r) => r.list === list && r.period === "2026-11")!.data as Array<Record<string, any>>;
    return stored;
  }

  it("16 measured and 35 unmeasured models store 16 rows, 1..16, previous ranks renumbered among them", async () => {
    const stored = await publish([...harness, ...models((id) => MEASURED.has(id))]);
    const model = stored("model");
    expect(model).toHaveLength(16);
    expect(new Set(model.map((r) => r["tool_id"]))).toEqual(MEASURED);
    expect(model.map((r) => r["rank"])).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
    const previous = model.map((r) => r["movement"]["previous_position"]);
    expect([...previous].sort((a, b) => a - b)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
  });

  it("the harness row is the same whatever the model rows carry", async () => {
    const strip = (rows: Array<Record<string, any>>) => JSON.stringify(rows);
    const none = strip((await publish([...harness, ...models(() => false)]))("harness"));
    const all = strip((await publish([...harness, ...models(() => true)]))("harness"));
    const some = strip((await publish([...harness, ...models((id) => MEASURED.has(id))]))("harness"));
    expect(all).toBe(none);
    expect(some).toBe(none);
  });
});

describe("GET /api/rankings/current?list=model (#329)", () => {
  beforeEach(() => vi.stubEnv("NODE_ENV", "production"));

  function seedStored51(measured: ReadonlySet<string> = MEASURED) {
    for (const id of MODEL_IDS) {
      state.tools[id] = { id, db_id: id, slug: `${id}-slug`, name: `Tool ${id}`, kind: "model", category: "llm", status: "active", info: {}, ...(measured.has(id) ? METRIC : {}) };
    }
    state.current["model"] = {
      id: "model-row",
      period: "2026-11",
      list: "model",
      algorithm_version: "8.1",
      is_current: true,
      published_at: new Date("2026-11-01T00:00:00Z"),
      created_at: new Date("2026-11-01T00:00:00Z"),
      data: MODEL_IDS.map((id, i) => ({
        tool_id: id,
        tool_slug: `${id}-slug`,
        rank: i + 1,
        score: 26.6,
        movement: { previous_position: 51 - i, change: 51 - i - (i + 1) },
      })),
    };
  }

  it("returns only measured rows, ranked as the board ranks them, with movement renumbered", async () => {
    seedStored51();
    const res = await currentGET(new Request("https://example.test/api/rankings/current?list=model"));
    const body = await res.json();
    expect(res.status).toBe(200);
    const rows = body.data.rankings as Array<{ tool_slug: string; position: number; movement: { previous_position: number; change: number } }>;
    expect(rows.map((r) => r.tool_slug)).toEqual([...MEASURED].map((id) => `${id}-slug`));
    expect(rows.map((r) => r.position)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
    expect(body.data.list_meta.entry_count).toBe(16);
    for (const r of rows) expect(Math.abs(r.movement.change)).toBeLessThan(16);

    const board = (await loadCurrentRankings("model"))!;
    expect(board.rankings.map((r) => [r.tool.slug, r.rank, r.previousRank, r.rankChange])).toEqual(
      rows.map((r) => [r.tool_slug, r.position, r.movement.previous_position, r.movement.change])
    );
  });

  // #329: the current route's list_meta once reported 0 metric rows (pending, not indexable) for 16.
  const meta = async (route: (r: Request) => Promise<Response>, path: string) => {
    const res = await route(new Request(`https://example.test${path}?list=model`));
    const body = await res.json();
    return { status: res.status, meta: (body.data ?? body).list_meta };
  };

  it.each([
    ["16 metric rows", MEASURED, { entry_count: 16, metric_row_count: 16, metrics_pending_note: false, indexable: true }],
    ["0 metric rows", new Set<string>(), { entry_count: 0, metric_row_count: 0, metrics_pending_note: true, indexable: false }],
  ])("with %s list_meta matches /api/rankings", async (_label, measured, expected) => {
    seedStored51(measured);
    const current = await meta(currentGET, "/api/rankings/current");
    expect(current.status).toBe(200);
    expect(current.meta).toMatchObject(expected);
    expect(current.meta).toEqual((await meta(rankingsGET, "/api/rankings")).meta);
  });

  it("a failed tools.status read is a 500 on both routes, never a board reported as measured", async () => {
    seedStored51();
    state.statusReadFails = true;
    expect((await meta(currentGET, "/api/rankings/current")).status).toBe(500);
    expect((await meta(rankingsGET, "/api/rankings")).status).toBe(500);
  });
});
