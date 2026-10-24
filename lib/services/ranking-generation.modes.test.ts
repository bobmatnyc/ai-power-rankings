import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Draft and dry-run modes of `regenerateRankings()` (#93).
 *
 * Why: the admin build and preview now run the cron's pipeline. They must
 *   never set a ranking current, demote the current row, or (dry-run) write.
 * What: runs each mode through the real `createDbPersistence()` against an
 *   in-memory Drizzle stand-in seeded with a current row, and checks the rows
 *   and the writes. Draft rows must equal the publish rows for the same input.
 * Test: `npx vitest run lib/services/ranking-generation.modes.test.ts`.
 *   Fails on the code before #93, where `mode` is ignored and every run publishes.
 */

const db = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("../db/connection", () => ({ getDb: () => db.client }));

import golden from "./__fixtures__/regenerate-publish.golden.json";
import { createFakeRankingsDb, rankingRow } from "./__fixtures__/fake-rankings-db";
import { GOLDEN_NOW, GOLDEN_PREVIOUS_SNAPSHOT, GOLDEN_TOOLS } from "./__fixtures__/regenerate-golden-input";
import {
  createDbPersistence,
  RANKING_ALGORITHM_VERSION,
  RankingGenerationInProgressError,
  RankingPeriodIsCurrentError,
  regenerateRankings,
} from "./ranking-generation.service";

const now = () => new Date(GOLDEN_NOW);

function seededDb(extra: Parameters<typeof rankingRow>[0][] = []) {
  const stamp = new Date("2026-01-01T00:00:00Z");
  return createFakeRankingsDb({
    tools: GOLDEN_TOOLS.map((tool) => ({ ...tool, data: tool.data ?? {}, createdAt: stamp, updatedAt: stamp })),
    rankings: [
      rankingRow({
        period: "2026-06",
        isCurrent: true,
        publishedAt: new Date("2026-06-01T09:00:00Z"),
        data: GOLDEN_PREVIOUS_SNAPSHOT.data,
      }),
      ...extra.map((row) => rankingRow(row)),
    ],
  });
}

describe("regenerateRankings modes (#93)", () => {
  let fake: ReturnType<typeof seededDb>;

  beforeEach(() => {
    fake = seededDb();
    db.client = fake.client;
  });

  it("dry-run writes nothing and returns the rows publish would write", async () => {
    const result = await regenerateRankings({ now, mode: "dry-run" });

    expect(fake.state.writes).toEqual([]);
    expect(result.mode).toBe("dry-run");
    expect(result.entries).toEqual(golden.saveSnapshotCalls[0]!.data);
  });

  it("draft writes a non-current row and leaves the current row as it was", async () => {
    const before = structuredClone(fake.state.rankings[0]!);

    const result = await regenerateRankings({ now, mode: "draft" });

    expect(result.period).toBe("2026-07");
    expect(fake.state.rankings[0]).toEqual(before);
    expect(fake.state.rankings.filter((r) => r.isCurrent).map((r) => r.period)).toEqual(["2026-06"]);
    expect(fake.state.writes.some((w) => w.op === "update")).toBe(false);

    const draft = fake.state.rankings.find((r) => r.period === "2026-07")!;
    expect(draft.isCurrent).toBe(false);
    expect(draft.publishedAt).toBeNull();
    expect(draft.algorithmVersion).toBe(RANKING_ALGORITHM_VERSION);
    // Same function, same input, same clock: identical rows to the publish run.
    expect(draft.data).toEqual(golden.saveSnapshotCalls[0]!.data);
  });

  it("draft replaces an earlier non-current row for the same period", async () => {
    fake = seededDb([{ period: "2026-07", isCurrent: false, data: [{ tool_id: "stale", rank: 1 }] }]);
    db.client = fake.client;

    await regenerateRankings({ now, mode: "draft" });

    const rows = fake.state.rankings.filter((r) => r.period === "2026-07");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.isCurrent).toBe(false);
    expect(rows[0]!.data).toEqual(golden.saveSnapshotCalls[0]!.data);
  });

  it("draft refuses the current period and writes nothing", async () => {
    await expect(regenerateRankings({ now, period: "2026-06", mode: "draft" })).rejects.toBeInstanceOf(
      RankingPeriodIsCurrentError
    );
    expect(fake.state.writes).toEqual([]);
  });

  it("the draft adapter refuses the current period inside its transaction", async () => {
    await expect(
      createDbPersistence().saveDraft!({
        period: "2026-06",
        algorithmVersion: RANKING_ALGORITHM_VERSION,
        publishedAt: now(),
        data: [],
      })
    ).rejects.toBeInstanceOf(RankingPeriodIsCurrentError);
    expect(fake.state.writes).toEqual([]);
    expect(fake.state.rankings[0]!.isCurrent).toBe(true);
  });

  it.each(["dry-run", "draft"] as const)(
    "a %s in flight does not block a publish run for the same period",
    async (mode) => {
      let release: () => void = () => {};
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const held = regenerateRankings({
        now,
        mode,
        persistence: {
          loadActiveTools: async () => {
            await gate;
            return GOLDEN_TOOLS;
          },
          loadCurrentRankings: async () => null,
          saveSnapshot: async () => {
            throw new Error(`${mode} must not publish`);
          },
          saveDraft: async () => {},
        },
      });

      await expect(regenerateRankings({ now })).resolves.toMatchObject({ period: "2026-07", mode: "publish" });
      release();
      await expect(held).resolves.toMatchObject({ mode });
    }
  );

  it("rejects a second draft for the same period while one is in flight", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const persistence = {
      loadActiveTools: async () => {
        await gate;
        return GOLDEN_TOOLS;
      },
      loadCurrentRankings: async () => null,
      saveSnapshot: async () => {},
      saveDraft: async () => {},
    };
    const first = regenerateRankings({ now, mode: "draft", persistence });
    await expect(regenerateRankings({ now, mode: "draft", persistence })).rejects.toBeInstanceOf(
      RankingGenerationInProgressError
    );
    release();
    await expect(first).resolves.toMatchObject({ mode: "draft" });
  });

  it("rejects an unknown mode before loading anything", async () => {
    await expect(regenerateRankings({ now, mode: "publish-now" as never })).rejects.toThrow(/Unknown regenerate mode/);
    expect(fake.state.writes).toEqual([]);
  });
});
