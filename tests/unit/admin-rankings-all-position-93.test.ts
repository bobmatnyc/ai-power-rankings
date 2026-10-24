import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * `GET /api/admin/rankings/all` reads `rank` when a row has no `position` (#93).
 *
 * Why: #93 stores admin builds in the cron's row shape (`rank`, no `position`).
 *   This route set `position: 0` for such rows, so the admin tools manager
 *   computed every rank change from it as 0 - 0.
 * What: over an in-memory Drizzle stand-in with a wrapped period of rank-shaped
 *   rows, the route reports each row's `rank` as `position`.
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
  it("reports `rank` as `position`, and still reads `position` rows", async () => {
    db.client = createFakeRankingsDb({
      rankings: [
        rankingRow({
          period: "2026-08",
          data: { rankings: [{ tool_id: "a", rank: 2, score: 9 }, { tool_id: "b", position: 5, score: 7 }] },
        }),
      ],
    }).client;

    const res = await GET(new NextRequest("http://localhost/api/admin/rankings/all"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.rankings.map((r: { tool_id: string; position: number }) => [r.tool_id, r.position])).toEqual([
      ["a", 2],
      ["b", 5],
    ]);
  });
});
