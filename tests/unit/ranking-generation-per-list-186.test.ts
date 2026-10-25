import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #186: `regenerateRankings({ layout: "per-list" })` — one row per (period, list).
 *
 * Why: the issue's acceptance is that generation writes one board per list, keeps
 *   history, and never ranks a tool in two lists; the legacy combined rows stay for
 *   rollback and export (D55).
 * What: runs the real `createDbPersistence()` against the in-memory Drizzle stand-in,
 *   seeded with a current combined row and tools of every kind (10 harnesses, 9 text
 *   models, an image and a video model, 2 productivity tools, 1 other). Checks the
 *   rows written, the partition, ranks and D53 tiers within each list, previous ranks
 *   (renumbered from the combined board on the first run, from the list row after),
 *   that a re-run replaces only its own rows, that the combined layout no longer
 *   touches per-list rows, and that per-list draft is refused and dry-run writes nothing.
 * Test: `npx vitest run tests/unit/ranking-generation-per-list-186.test.ts`.
 */

const db = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("../../lib/db/connection", () => ({ getDb: () => db.client }));

import { createFakeRankingsDb, type FakeToolRow, rankingRow } from "../../lib/services/__fixtures__/fake-rankings-db";
import { regenerateRankings } from "../../lib/services/ranking-generation.service";

const stamp = new Date("2026-01-01T00:00:00Z");
const now = () => new Date("2026-07-01T09:00:00.000Z");

function tool(id: string, kind: string, users: number, modality?: string): FakeToolRow {
  return {
    id,
    name: `Tool ${id}`,
    slug: `${id}-slug`,
    category: "other",
    status: "active",
    kind,
    data: { info: { description: id }, metrics: { users, github_stars: users / 10 }, ...(modality ? { modality } : {}) },
    createdAt: stamp,
    updatedAt: stamp,
  };
}

// Distinct user counts give distinct scores; the order below is the global score order.
const TOOLS: FakeToolRow[] = [
  ...Array.from({ length: 10 }, (_, i) => tool(`h${i + 1}`, "harness", 9_000_000 - i * 400_000)),
  ...Array.from({ length: 9 }, (_, i) => tool(`m${i + 1}`, "model", 8_800_000 - i * 400_000)),
  tool("img", "model", 9_500_000, "image"),
  tool("vid", "model", 9_400_000, "video"),
  tool("p1", "productivity", 5_000_000),
  tool("p2", "productivity", 4_000_000),
  tool("o1", "other", 9_900_000),
];

/** The combined board as it stands: every tool, ranked globally in reverse id order. */
const COMBINED_DATA = [...TOOLS].reverse().map((t, i) => ({ tool_id: t.id, rank: i + 1 }));

function seeded() {
  return createFakeRankingsDb({
    tools: TOOLS,
    rankings: [rankingRow({ period: "2026-06", isCurrent: true, data: COMBINED_DATA, id: "combined-2026-06" })],
  });
}

let fake: ReturnType<typeof seeded>;
beforeEach(() => {
  fake = seeded();
  db.client = fake.client;
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

const rowOf = (list: string, period = "2026-07") =>
  fake.state.rankings.find((r) => (r.list ?? "combined") === list && r.period === period);
const ids = (data: unknown) => (data as Array<{ tool_id: string }>).map((r) => r.tool_id);

describe("per-list publish (#186)", () => {
  it("writes one current row per list and leaves the combined row current and unchanged", async () => {
    const before = { ...rowOf("combined", "2026-06")! };
    const result = await regenerateRankings({ now, layout: "per-list" });

    expect(result.layout).toBe("per-list");
    expect(result.boards).toEqual([
      { list: "harness", toolCount: 10 },
      { list: "model", toolCount: 9 },
      { list: "productivity", toolCount: 2 },
    ]);
    for (const list of ["harness", "model", "productivity"]) {
      expect(rowOf(list)?.isCurrent, list).toBe(true);
    }
    expect(fake.state.rankings.filter((r) => r.isCurrent).map((r) => r.list ?? "combined").sort()).toEqual([
      "combined",
      "harness",
      "model",
      "productivity",
    ]);
    expect(rowOf("combined", "2026-06")).toEqual(before);
  });

  it("partitions the tools: each list ranks only its kind, 1..n, and no tool twice", async () => {
    await regenerateRankings({ now, layout: "per-list" });
    const harness = rowOf("harness")!.data as Array<{ tool_id: string; rank: number }>;
    const model = rowOf("model")!.data as Array<{ tool_id: string; rank: number }>;
    const productivity = rowOf("productivity")!.data as Array<{ tool_id: string; rank: number }>;

    expect(ids(harness)).toEqual(TOOLS.slice(0, 10).map((t) => t.id));
    expect(ids(model)).toEqual(TOOLS.slice(10, 19).map((t) => t.id));
    expect(ids(productivity)).toEqual(["p1", "p2"]);
    for (const rows of [harness, model, productivity]) {
      expect(rows.map((r) => r.rank)).toEqual(rows.map((_, i) => i + 1));
    }
    const all = [...ids(harness), ...ids(model), ...ids(productivity)];
    expect(new Set(all).size).toBe(all.length);
    // `other` is in no list; D52: the image and video models are in no list.
    for (const absent of ["o1", "img", "vid"]) expect(all).not.toContain(absent);
  });

  it("D53: 10 harnesses keep the normal tiers; 9 models are S/A/B by thirds", async () => {
    await regenerateRankings({ now, layout: "per-list" });
    const tiers = (list: string) => (rowOf(list)!.data as Array<{ tier: string }>).map((r) => r.tier);
    expect(tiers("harness")).toEqual(["S", "S", "S", "S", "S", "A", "A", "A", "A", "A"]);
    expect(tiers("model")).toEqual(["S", "S", "S", "A", "A", "A", "B", "B", "B"]);
  });

  it("the first run renumbers the combined board's ranks within each list; the next reads the list row", async () => {
    await regenerateRankings({ now, layout: "per-list" });
    const previous = (list: string, period = "2026-07") =>
      (rowOf(list, period)!.data as Array<{ movement: { previous_position: number | null } }>).map(
        (r) => r.movement.previous_position
      );
    // The combined board ranked tools in reverse, so within each list the order reverses.
    expect(previous("model")).toEqual([9, 8, 7, 6, 5, 4, 3, 2, 1]);
    expect(previous("productivity")).toEqual([2, 1]);

    await regenerateRankings({ now: () => new Date("2026-08-01T09:00:00.000Z"), layout: "per-list" });
    expect(previous("model", "2026-08")).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    // History is kept: the July rows remain, no longer current.
    expect(rowOf("model", "2026-07")!.isCurrent).toBe(false);
  });

  it("a re-run for the same period replaces only its own rows", async () => {
    await regenerateRankings({ now, layout: "per-list" });
    await regenerateRankings({ now, layout: "per-list" });
    const periodRows = fake.state.rankings.filter((r) => r.period === "2026-07");
    expect(periodRows.map((r) => r.list).sort()).toEqual(["harness", "model", "productivity"]);
    expect(rowOf("combined", "2026-06")!.isCurrent).toBe(true);
  });

  it("the combined layout no longer deletes or demotes the per-list rows of the period", async () => {
    await regenerateRankings({ now, layout: "per-list" });
    await regenerateRankings({ now });
    expect(rowOf("combined")!.isCurrent).toBe(true);
    expect(rowOf("combined", "2026-06")!.isCurrent).toBe(false);
    for (const list of ["harness", "model", "productivity"]) {
      expect(rowOf(list)?.isCurrent, list).toBe(true);
    }
  });

  it("per-list dry-run writes nothing; per-list draft is refused before any write", async () => {
    const dry = await regenerateRankings({ now, layout: "per-list", mode: "dry-run" });
    expect(dry.boards.map((b) => b.toolCount)).toEqual([10, 9, 2]);
    expect(fake.state.writes).toEqual([]);

    await expect(regenerateRankings({ now, layout: "per-list", mode: "draft" })).rejects.toThrow(
      /Per-list drafts are not supported/
    );
    expect(fake.state.writes).toEqual([]);
  });

  it("refuses an unknown layout", async () => {
    await expect(regenerateRankings({ now, layout: "global" as never })).rejects.toThrow(/Unknown ranking layout/);
  });
});
