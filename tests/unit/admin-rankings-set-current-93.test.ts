import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * `setAsCurrent()` with an id that no longer exists (#93).
 *
 * Why: #93's admin build replaces a draft row by delete and insert, so a
 *   rebuild gives the row a new id. `set-current` reads the id, then calls
 *   `setAsCurrent()`, which demoted every row and promoted by id without
 *   checking that a row was promoted. A rebuild in between left no current row.
 * What: over an in-memory Drizzle stand-in with a current row, a stale id makes
 *   `setAsCurrent()` throw and roll back the demotion, and `POST
 *   /api/admin/rankings` `set-current` answers 500 without writing the public file.
 * Test: `npx vitest run tests/unit/admin-rankings-set-current-93.test.ts`.
 */

const db = vi.hoisted(() => ({ client: null as unknown }));
const fsSpy = vi.hoisted(() => ({ writeFileSync: vi.fn() }));

vi.mock("../../lib/db/connection", () => ({ getDb: () => db.client }));
vi.mock("../../lib/api-auth", () => ({
  requireAdmin: async () => ({ userId: "admin", user: { id: "admin" }, error: null }),
}));
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return { ...actual, default: { ...actual, writeFileSync: fsSpy.writeFileSync }, writeFileSync: fsSpy.writeFileSync };
});

import { POST } from "../../app/api/admin/rankings/route";
import { RankingsRepository } from "../../lib/db/repositories/rankings.repository";
import { createFakeRankingsDb, rankingRow } from "../../lib/services/__fixtures__/fake-rankings-db";

let fake: ReturnType<typeof createFakeRankingsDb>;

beforeEach(() => {
  vi.restoreAllMocks();
  fsSpy.writeFileSync.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
  fake = createFakeRankingsDb({
    rankings: [
      rankingRow({ period: "2026-07", isCurrent: true, id: "current-row" }),
      rankingRow({ period: "2026-08", isCurrent: false, id: "draft-row-v2" }),
    ],
  });
  db.client = fake.client;
});

const currentPeriods = () => fake.state.rankings.filter((r) => r.isCurrent).map((r) => r.period);

describe("setAsCurrent with a stale id (#93)", () => {
  it("throws and leaves the previous current row current", async () => {
    await expect(new RankingsRepository().setAsCurrent("draft-row-v1")).rejects.toThrow(/not found/);
    expect(currentPeriods()).toEqual(["2026-07"]);
  });

  it("set-current answers an error and writes no public file when the row was replaced", async () => {
    // The row read before a rebuild replaced it.
    vi.spyOn(RankingsRepository.prototype, "getByPeriod").mockResolvedValue({
      ...(await new RankingsRepository().getByPeriod("2026-08"))!,
      id: "draft-row-v1",
    });

    const res = await POST(
      new NextRequest("http://localhost/api/admin/rankings", {
        method: "POST",
        body: JSON.stringify({ action: "set-current", period: "2026-08" }),
        headers: { "content-type": "application/json" },
      })
    );

    expect(res.status).toBe(500);
    expect(currentPeriods()).toEqual(["2026-07"]);
    expect(fsSpy.writeFileSync).not.toHaveBeenCalled();
  });

  it("still promotes an existing id", async () => {
    await expect(new RankingsRepository().setAsCurrent("draft-row-v2")).resolves.toBe(true);
    expect(currentPeriods()).toEqual(["2026-08"]);
  });
});
