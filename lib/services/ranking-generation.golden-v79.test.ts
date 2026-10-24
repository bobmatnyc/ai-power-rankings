import { describe, expect, it, vi } from "vitest";

/**
 * v7.9 reproduction check for the publish path of `regenerateRankings()` (#101).
 *
 * Why: v7.10 changes the #93 golden output (info-group folding). The compare
 *   script's v7.9 baseline is `{ foldInfoGroups: false }`; that option must
 *   still score the golden input exactly as the v7.9 engine did.
 * What: builds every engine with `{ foldInfoGroups: false }`, runs the cron
 *   call shape against the same fake DB, input and clock as the #93 golden
 *   test, and asserts the top movers and the inserted rows equal
 *   `regenerate-publish.v7-9.golden.json`, recorded on v7.9. The version stamp
 *   is not compared: it names the shipped engine, v7.10.
 * Test: `npx vitest run lib/services/ranking-generation.golden-v79.test.ts`.
 */

const db = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("../db/connection", () => ({ getDb: () => db.client }));

vi.mock("../ranking-algorithm-v76", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../ranking-algorithm-v76")>();
  class RankingEngineV79 extends actual.RankingEngineV76 {
    constructor(...args: ConstructorParameters<typeof actual.RankingEngineV76>) {
      super(args[0], args[1], { ...(args[2] ?? {}), foldInfoGroups: false });
    }
  }
  return { ...actual, RankingEngineV76: RankingEngineV79 };
});

import goldenV79 from "./__fixtures__/regenerate-publish.v7-9.golden.json";
import { createFakeRankingsDb, rankingRow } from "./__fixtures__/fake-rankings-db";
import { GOLDEN_NOW, GOLDEN_PREVIOUS_SNAPSHOT, GOLDEN_TOOLS } from "./__fixtures__/regenerate-golden-input";
import { regenerateRankings } from "./ranking-generation.service";

describe("regenerateRankings publish path with foldInfoGroups:false (v7.9 golden, #101)", () => {
  it("reproduces the v7.9 recorded movers and snapshot rows", async () => {
    const stamp = new Date("2026-01-01T00:00:00Z");
    const fake = createFakeRankingsDb({
      tools: GOLDEN_TOOLS.map((tool) => ({ ...tool, data: tool.data ?? {}, createdAt: stamp, updatedAt: stamp })),
      rankings: [
        rankingRow({ period: "2026-06", isCurrent: true, data: GOLDEN_PREVIOUS_SNAPSHOT.data }),
        rankingRow({ period: "2026-07", isCurrent: false, data: [{ tool_id: "old-draft", rank: 1 }] }),
      ],
    });
    db.client = fake.client;

    const result = await regenerateRankings({ now: () => new Date(GOLDEN_NOW) });

    expect(goldenV79.result.algorithmVersion).toBe("7.9");
    expect(result.topMovers).toEqual(goldenV79.result.topMovers);
    const insert = fake.state.writes.find((w) => w.op === "insert");
    expect((insert?.values as { data: unknown }).data).toEqual(goldenV79.saveSnapshotCalls[0]!.data);
  });
});
