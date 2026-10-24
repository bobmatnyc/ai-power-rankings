import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * `GET /api/admin/rankings/all` reads `rank` when a row has no `position` (#93).
 *
 * Why: #93 stores admin builds in the cron's row shape (`rank`, no `position`).
 *   This route set `position: 0` for such rows, so the admin tools manager
 *   computed every rank change from it as 0 - 0.
 * What: over an in-memory Drizzle stand-in with a wrapped period and a bare-array
 *   period, the route lists rows from both and reports `rank` as `position`.
 * Test: `npx vitest run tests/unit/admin-rankings-all-position-93.test.ts`.
 */

const db = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("../../lib/db/connection", () => ({ getDb: () => db.client }));
vi.mock("../../lib/api-auth", () => ({
  requireAdmin: async () => ({ userId: "admin", user: { id: "admin" }, error: null }),
}));

import { GET } from "../../app/api/admin/rankings/all/route";
import { createFakeRankingsDb, rankingRow } from "../../lib/services/__fixtures__/fake-rankings-db";

describe("GET /api/admin/rankings/all with rank-shaped rows (#93)", () => {
  it("lists bare-array and wrapped periods, reporting `rank` as `position`", async () => {
    db.client = createFakeRankingsDb({
      rankings: [
        rankingRow({
          period: "2026-08",
          data: { rankings: [{ tool_id: "a", rank: 2, score: 9 }, { tool_id: "b", position: 5, score: 7 }] },
        }),
        // #93: the cron and draft rows store a bare array.
        rankingRow({ period: "2026-09", data: [{ tool_id: "c", rank: 1, score: 9.5 }] }),
      ],
    }).client;

    const res = await GET(new NextRequest("http://localhost/api/admin/rankings/all"));
    const body = await res.json();

    expect(res.status).toBe(200);
    const rows = body.rankings.map((r: { period: string; tool_id: string; position: number }) => [r.period, r.tool_id, r.position]);
    expect(rows).toEqual(
      expect.arrayContaining([
        ["2026-08", "a", 2],
        ["2026-08", "b", 5],
        ["2026-09", "c", 1],
      ])
    );
    expect(rows).toHaveLength(3);
  });
});
