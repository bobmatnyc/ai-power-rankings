import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A per-list board built from the combined board leaves out tools that are not `active`.
 *
 * Why: the stored combined board can still rank a tool that was retired after it was
 *   published (status `redirect`). The models list showed such a row, even first. The
 *   stored data must stay as written, so the read drops the row.
 * What: mocks the rankings repository with one combined row and the tools repository
 *   with a status per tool, then reads the models list through `loadCurrentRankings()`
 *   (the page's data source) and through `GET /api/rankings?list=model`. A retired row
 *   must be absent and the ranks, tiers and previous ranks renumbered from 1. A retired
 *   row in a list's own stored board is kept as written.
 * Test: `npx vitest run tests/unit/models-list-inactive-rows.test.ts`. No network.
 */

const current = vi.hoisted(() => ({ rows: {} as Record<string, unknown> }));

vi.mock("server-only", () => ({}));
vi.mock("../../lib/db/connection", () => ({ getDb: () => ({}) }));
vi.mock("../../lib/db/repositories/rankings.repository", () => ({
  rankingsRepository: { getCurrentRankings: async (list = "combined") => current.rows[list] ?? null },
}));

const TOOLS: Record<string, { id: string; slug: string; name: string; kind: string; status: string }> = {};
vi.mock("../../lib/db/repositories/tools.repository", () => ({
  ToolsRepository: class {
    async findById(id: string) {
      const t = TOOLS[id];
      return t ? { ...t, db_id: t.id, category: "other", info: {} } : null;
    }
    async findColumnStatuses(ids: string[]) {
      return new Map(ids.flatMap((id) => (TOOLS[id] ? [[id, TOOLS[id].status] as [string, string]] : [])));
    }
    async findBySlug() {
      return null;
    }
  },
}));

import { GET } from "../../app/api/rankings/route";
import { loadCurrentRankings } from "../../lib/rankings/current-rankings";

// Board order: first (redirect), second, third (inactive), fourth, fifth (redirect), sixth.
const BOARD: Array<[string, string]> = [
  ["first", "redirect"],
  ["second", "active"],
  ["third", "inactive"],
  ["fourth", "active"],
  ["fifth", "redirect"],
  ["sixth", "active"],
];

function seed(boardKind: "combined" | "model") {
  for (const [slug, status] of BOARD) TOOLS[slug] = { id: slug, slug, name: slug, kind: "model", status };
  TOOLS["other-harness"] = { id: "other-harness", slug: "other-harness", name: "h", kind: "harness", status: "active" };
  const stamp = new Date("2026-10-01T00:00:00Z");
  const ids = ["first", "other-harness", "second", "third", "fourth", "fifth", "sixth"];
  current.rows = {
    [boardKind]: {
      id: `${boardKind}-row`,
      period: "2026-10",
      list: boardKind,
      algorithm_version: "7.10",
      is_current: true,
      published_at: stamp,
      created_at: stamp,
      updated_at: stamp,
      data: ids.map((id, i) => ({
        tool_id: id,
        rank: i + 1,
        score: 50,
        movement: { previous_position: ids.length - i, change: 0 },
      })),
    },
  };
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.stubEnv("NODE_ENV", "production");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("models list from the combined board", () => {
  it("page data path: a retired row is absent and ranks, tiers and previous ranks are renumbered", async () => {
    seed("combined");
    const board = (await loadCurrentRankings("model"))!;
    expect(board.source).toBe("combined");
    expect(board.rankings.map((r) => r.tool.slug)).toEqual(["second", "fourth", "sixth"]);
    expect(board.rankings.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(board.rankings.map((r) => r.tier)).toEqual(["S", "A", "B"]);
    // Stored previous positions run in reverse: sixth was first among the kept rows.
    expect(board.rankings.map((r) => r.previousRank)).toEqual([3, 2, 1]);
    expect(board.rankings.every((r) => r.tool.status === "active")).toBe(true);
  });

  it("API path: /api/rankings?list=model drops the retired rows and reports the new count", async () => {
    seed("combined");
    const response = await GET(new Request("https://example.test/api/rankings?list=model"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.rankings.map((r: { tool: { slug: string } }) => r.tool.slug)).toEqual(["second", "fourth", "sixth"]);
    expect(body.rankings.map((r: { rank: number }) => r.rank)).toEqual([1, 2, 3]);
    expect(body.list_meta.entry_count).toBe(3);
  });

  it("does not modify the stored board", async () => {
    seed("combined");
    const before = JSON.stringify(current.rows);
    await loadCurrentRankings("model");
    expect(JSON.stringify(current.rows)).toBe(before);
  });
});

describe("a list's own stored board", () => {
  it("is read as written: a retired row stays (the filter applies to combined-board reads)", async () => {
    seed("model");
    const board = (await loadCurrentRankings("model"))!;
    expect(board.source).toBe("list");
    expect(board.rankings.map((r) => r.tool.slug)).toEqual(["first", "second", "third", "fourth", "fifth", "sixth"]);
  });
});
