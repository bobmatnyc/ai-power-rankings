import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Golden test for the publish path of `regenerateRankings()` (#93).
 *
 * Why: #93 adds draft and dry-run modes for the admin route. The monthly cron
 *   (`regenerateRankings()`) and `scripts/generate-v76-rankings.ts` pass no
 *   mode, so what they score and write must not change.
 * What: runs the cron call shape, no options but a frozen clock, against an
 *   in-memory Drizzle stand-in seeded with fixed tools and a prior current row.
 *   The summary and the inserted row must equal `regenerate-publish.golden.json`,
 *   recorded on the code before #93, and the SQL writes must be the same
 *   delete / demote / insert-as-current transaction.
 * Test: `npx vitest run lib/services/ranking-generation.golden.test.ts`.
 *   Passes on the code before #93 and after. A change to publish output fails it.
 */

const db = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("../db/connection", () => ({ getDb: () => db.client }));

import golden from "./__fixtures__/regenerate-publish.golden.json";
import { createFakeRankingsDb, rankingRow } from "./__fixtures__/fake-rankings-db";
import { GOLDEN_NOW, GOLDEN_PREVIOUS_SNAPSHOT, GOLDEN_TOOLS } from "./__fixtures__/regenerate-golden-input";
import { regenerateRankings } from "./ranking-generation.service";

function seededDb() {
  const stamp = new Date("2026-01-01T00:00:00Z");
  return createFakeRankingsDb({
    tools: GOLDEN_TOOLS.map((tool) => ({ ...tool, data: tool.data ?? {}, createdAt: stamp, updatedAt: stamp })),
    rankings: [
      rankingRow({ period: "2026-06", isCurrent: true, data: GOLDEN_PREVIOUS_SNAPSHOT.data }),
      rankingRow({ period: "2026-07", isCurrent: false, data: [{ tool_id: "old-draft", rank: 1 }] }),
    ],
  });
}

describe("regenerateRankings publish path (golden, #93)", () => {
  let fake: ReturnType<typeof seededDb>;

  beforeEach(() => {
    fake = seededDb();
    db.client = fake.client;
  });

  it("returns the recorded summary and inserts the recorded snapshot as current", async () => {
    const result = await regenerateRankings({ now: () => new Date(GOLDEN_NOW) });

    expect({
      period: result.period,
      algorithmVersion: result.algorithmVersion,
      toolCount: result.toolCount,
      publishedAt: result.publishedAt,
      topMovers: result.topMovers,
    }).toEqual(golden.result);

    const expected = golden.saveSnapshotCalls[0]!;
    const insert = fake.state.writes.find((w) => w.op === "insert");
    expect(insert?.values).toEqual({
      period: expected.period,
      algorithmVersion: expected.algorithmVersion,
      isCurrent: true,
      publishedAt: new Date(expected.publishedAt),
      data: expected.data,
    });
  });

  it("deletes the same-period row, demotes the current row, then inserts, in that order", async () => {
    await regenerateRankings({ now: () => new Date(GOLDEN_NOW) });

    expect(fake.state.writes.map(({ op, table, where, params }) => ({ op, table, where, params }))).toEqual([
      { op: "delete", table: "rankings", where: '"rankings"."period" = $1', params: ["2026-07"] },
      { op: "update", table: "rankings", where: '"rankings"."is_current" = $1', params: [true] },
      { op: "insert", table: "rankings", where: undefined, params: undefined },
    ]);
    expect(fake.state.rankings.map((r) => [r.period, r.isCurrent])).toEqual([
      ["2026-06", false],
      ["2026-07", true],
    ]);
  });
});
