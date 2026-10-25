import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #186: the per-list read path — `loadCurrentRankings(list)` and `GET /api/rankings`.
 *
 * Why: each list has its own board and API response, a tool is ranked in at most one
 *   list, and the owner rulings fix the default list (D51), the image/video exclusion
 *   (D52), the 10-entry threshold (D53) and the productivity note flag (D54).
 * What: mocks the rankings repository (one current row per stored list) and the tools
 *   repository (kind and data.modality per tool), then reads each list through the
 *   loader and the route. The fixture's combined board interleaves every kind; the
 *   boards read from it must partition its list tools, renumber ranks and previous
 *   ranks within each list, and set D53 tiers. A list's own row wins over the combined
 *   board.
 * Test: `npx vitest run tests/unit/rankings-per-list-read-186.test.ts`. No network.
 */

const current = vi.hoisted(() => ({ rows: {} as Record<string, unknown> }));

vi.mock("server-only", () => ({}));
vi.mock("../../lib/db/connection", () => ({ getDb: () => ({}) }));
vi.mock("../../lib/db/repositories/rankings.repository", () => ({
  rankingsRepository: {
    getCurrentRankings: async (list = "combined") => current.rows[list] ?? null,
  },
}));

type FixtureTool = { id: string; slug: string; name: string; kind: string; modality?: string };

const TOOLS: Record<string, FixtureTool> = {};
function tool(id: string, kind: string, modality?: string): FixtureTool {
  const t = { id, slug: `${id}-slug`, name: `Tool ${id}`, kind, ...(modality ? { modality } : {}) };
  TOOLS[id] = t;
  return t;
}

vi.mock("../../lib/db/repositories/tools.repository", () => ({
  ToolsRepository: class {
    async findById(id: string) {
      const t = TOOLS[id];
      return t ? { ...t, category: "other", status: "active", info: {} } : null;
    }
    async findBySlug() {
      return null;
    }
  },
}));

import { GET } from "../../app/api/rankings/route";
import { loadCurrentRankings, rankWithinList } from "../../lib/rankings/current-rankings";

// 10 harnesses, 9 text models plus one image and one video model, 2 productivity, 1 other.
const HARNESS = Array.from({ length: 10 }, (_, i) => tool(`h${i + 1}`, "harness"));
const MODELS = Array.from({ length: 9 }, (_, i) => tool(`m${i + 1}`, "model"));
const IMAGE = tool("img", "model", "image");
const VIDEO = tool("vid", "model", "video");
const PRODUCTIVITY = [tool("p1", "productivity"), tool("p2", "productivity")];
const OTHER = tool("o1", "other");
const EXTRA_MODEL = tool("m10", "model");

/** The legacy board: every tool interleaved, global ranks, global previous positions. */
function combinedRow(tools: FixtureTool[]) {
  return {
    id: "combined-row",
    period: "2026-10",
    list: "combined",
    algorithm_version: "7.10",
    is_current: true,
    published_at: new Date("2026-10-01T00:00:00Z"),
    created_at: new Date("2026-10-01T00:00:00Z"),
    updated_at: new Date("2026-10-01T00:00:00Z"),
    // Reverse previous order, so every list's previous ranks must be renumbered.
    data: tools.map((t, i) => ({
      tool_id: t.id,
      rank: i + 1,
      score: 100 - i,
      tier: "S",
      movement: { previous_position: tools.length - i, change: tools.length - i - (i + 1) },
    })),
  };
}

const ALL = [
  HARNESS[0]!, MODELS[0]!, IMAGE, HARNESS[1]!, OTHER, MODELS[1]!, PRODUCTIVITY[0]!, VIDEO,
  ...HARNESS.slice(2), ...MODELS.slice(2), PRODUCTIVITY[1]!,
];

const slugsOf = (rows: Array<{ tool: { slug: string } }>) => rows.map((r) => r.tool.slug);

beforeEach(() => {
  current.rows = { combined: combinedRow(ALL) };
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("loadCurrentRankings(list) before any per-list row exists (#186)", () => {
  it("splits the combined board: each list holds only its own tools, renumbered from 1", async () => {
    const boards = await Promise.all((["harness", "model", "productivity"] as const).map((l) => loadCurrentRankings(l)));
    const [harness, model, productivity] = boards.map((b) => b!);

    expect(harness.source).toBe("combined");
    expect(slugsOf(harness.rankings)).toEqual(HARNESS.map((t) => t.slug));
    expect(slugsOf(model.rankings)).toEqual(MODELS.map((t) => t.slug));
    expect(slugsOf(productivity.rankings)).toEqual(PRODUCTIVITY.map((t) => t.slug));
    for (const board of boards) {
      expect(board!.rankings.map((r) => r.rank)).toEqual(board!.rankings.map((_, i) => i + 1));
    }

    // A tool in one list never appears ranked in another; `other` is in none.
    const all = boards.flatMap((b) => slugsOf(b!.rankings));
    expect(new Set(all).size).toBe(all.length);
    expect(all).not.toContain(OTHER.slug);
  });

  it("D52: the image and video models are in no list", async () => {
    const boards = await Promise.all((["harness", "model", "productivity"] as const).map((l) => loadCurrentRankings(l)));
    const all = boards.flatMap((b) => slugsOf(b!.rankings));
    expect(all).not.toContain(IMAGE.slug);
    expect(all).not.toContain(VIDEO.slug);
  });

  it("renumbers the global previous positions within the list", async () => {
    const model = (await loadCurrentRankings("model"))!;
    // Previous positions run in reverse, so the last model was first among models.
    expect(model.rankings.map((r) => r.previousRank)).toEqual([9, 8, 7, 6, 5, 4, 3, 2, 1]);
    expect(model.rankings[0]!.rankChange).toBe(9 - 1);
  });

  it("D53: 9 models get S/A/B by thirds; a tenth model gives the normal tiers", async () => {
    const nine = (await loadCurrentRankings("model"))!;
    expect(nine.rankings.map((r) => r.tier)).toEqual(["S", "S", "S", "A", "A", "A", "B", "B", "B"]);

    current.rows = { combined: combinedRow([...ALL, EXTRA_MODEL]) };
    const ten = (await loadCurrentRankings("model"))!;
    expect(ten.rankings).toHaveLength(10);
    expect(ten.rankings.map((r) => r.tier)).toEqual(["S", "S", "S", "S", "S", "A", "A", "A", "A", "A"]);
  });

  it("returns null when neither a list row nor a combined row is current", async () => {
    current.rows = {};
    expect(await loadCurrentRankings("harness")).toBeNull();
  });
});

describe("loadCurrentRankings(list) with a per-list row (#186)", () => {
  it("reads the list's own row and keeps its stored movement", async () => {
    current.rows["model"] = {
      ...combinedRow([MODELS[1]!, MODELS[0]!]),
      id: "model-row",
      list: "model",
      data: [
        { tool_id: "m2", rank: 1, score: 90, movement: { previous_position: 2, change: 1 } },
        { tool_id: "m1", rank: 2, score: 80, movement: { previous_position: 1, change: -1 } },
      ],
    };
    const model = (await loadCurrentRankings("model"))!;
    expect(model.source).toBe("list");
    expect(model.snapshot.id).toBe("model-row");
    expect(slugsOf(model.rankings)).toEqual(["m2-slug", "m1-slug"]);
    expect(model.rankings.map((r) => [r.previousRank, r.rankChange])).toEqual([
      [2, 1],
      [1, -1],
    ]);
  });

  it("drops a row whose tool now belongs to another list, and renumbers", async () => {
    current.rows["model"] = {
      ...combinedRow([]),
      list: "model",
      data: [
        { tool_id: "m1", rank: 1, score: 90 },
        { tool_id: "h1", rank: 2, score: 85 },
        { tool_id: "m2", rank: 3, score: 80 },
      ],
    };
    const model = (await loadCurrentRankings("model"))!;
    expect(slugsOf(model.rankings)).toEqual(["m1-slug", "m2-slug"]);
    expect(model.rankings.map((r) => r.rank)).toEqual([1, 2]);
  });
});

describe("rankWithinList (#186)", () => {
  it("leaves a tool with no previous rank as new, with no change", () => {
    const rows = [
      { rank: 4, previousRank: null, rankChange: 3 },
      { rank: 7, previousRank: 12, rankChange: 5 },
    ] as never[];
    expect(rankWithinList(rows, "combined").map((r: any) => [r.rank, r.previousRank, r.rankChange])).toEqual([
      [1, null, 0],
      [2, 1, -1],
    ]);
  });
});

describe("GET /api/rankings (#186)", () => {
  beforeEach(() => vi.stubEnv("NODE_ENV", "production"));

  const get = async (query = "") => {
    const response = await GET(new Request(`https://example.test/api/rankings${query}`));
    return { status: response.status, body: await response.json() };
  };

  it("D51: with no list parameter it returns the coding-harness board and names it", async () => {
    const { status, body } = await get();
    expect(status).toBe(200);
    expect(body.list).toBe("harness");
    expect(body.list_meta).toMatchObject({ list: "harness", entry_count: 10, indexable: true, tier_scheme: "standard" });
    expect(slugsOf(body.rankings)).toEqual(HARNESS.map((t) => t.slug));
  });

  it.each([
    ["?list=model", "model"],
    ["?list=models", "model"],
    ["?kind=model", "model"],
    ["?list=productivity", "productivity"],
  ])("%s returns the %s board, named", async (query, list) => {
    const { status, body } = await get(query);
    expect(status).toBe(200);
    expect(body.list).toBe(list);
    expect(body.list_meta.list).toBe(list);
  });

  it("an unknown list is a 400 that names the valid lists, never a default board", async () => {
    const { status, body } = await get("?list=combined");
    expect(status).toBe(400);
    expect(body.lists).toEqual(["harness", "model", "productivity"]);
    expect(body.rankings).toBeUndefined();
  });

  it.each(["?list=", "?kind=", "?list=model&kind=harness", "?list=models&kind=bogus"])(
    "%s is a 400, never a silent default",
    async (query) => {
      const { status, body } = await get(query);
      expect(status).toBe(400);
      expect(body.rankings).toBeUndefined();
    }
  );

  it("list and kind may both be given when they agree", async () => {
    const { status, body } = await get("?list=models&kind=model");
    expect(status).toBe(200);
    expect(body.list).toBe("model");
  });

  it("D53: list_meta reports 9 models as noindex and 10 as indexed", async () => {
    expect((await get("?list=model")).body.list_meta).toMatchObject({ entry_count: 9, indexable: false, tier_scheme: "thirds" });
    current.rows = { combined: combinedRow([...ALL, EXTRA_MODEL]) };
    expect((await get("?list=model")).body.list_meta).toMatchObject({ entry_count: 10, indexable: true, tier_scheme: "standard" });
  });

  it("D54: only the productivity response carries the provisional-note flag", async () => {
    expect((await get("?list=productivity")).body.list_meta.provisional_note).toBe(true);
    expect((await get("?list=model")).body.list_meta.provisional_note).toBe(false);
    expect((await get()).body.list_meta.provisional_note).toBe(false);
  });

  it("an empty read still names the list", async () => {
    current.rows = {};
    const { body } = await get("?list=model");
    expect(body.rankings).toEqual([]);
    expect(body.list).toBe("model");
    expect(body.list_meta.entry_count).toBe(0);
  });
});
