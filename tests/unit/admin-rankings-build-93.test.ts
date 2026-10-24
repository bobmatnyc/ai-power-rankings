import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * `POST /api/admin/rankings` build and preview cannot publish (#93).
 *
 * Why: #93 moves admin build and preview from the V6 engine to the cron's
 *   pipeline. That pipeline publishes by default, so the route must reach it
 *   only in draft and dry-run modes. Preview deployments share the production
 *   database, so no admin build or preview may set a row current, demote the
 *   current row, or change its data.
 * What: calls the real handler with `requireAdmin()` granted, over the real
 *   repository and service code and an in-memory Drizzle stand-in seeded with a
 *   current row. Checks the rows and every write after each action.
 * Test: `npx vitest run tests/unit/admin-rankings-build-93.test.ts`. Fails on the
 *   code before #93, which scored with V6, stored "v6.0" rows and overwrote the
 *   current row's data on a build of the current period.
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
import { createFakeRankingsDb, rankingRow } from "../../lib/services/__fixtures__/fake-rankings-db";
import { GOLDEN_PREVIOUS_SNAPSHOT, GOLDEN_TOOLS } from "../../lib/services/__fixtures__/regenerate-golden-input";
import { RANKING_ALGORITHM_VERSION } from "../../lib/services/ranking-generation.service";

function post(payload: unknown): Promise<Response> {
  return POST(
    new NextRequest("http://localhost/api/admin/rankings", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "content-type": "application/json" },
    })
  );
}

let fake: ReturnType<typeof createFakeRankingsDb>;
let currentBefore: unknown;

beforeEach(() => {
  vi.clearAllMocks();
  const stamp = new Date("2026-01-01T00:00:00Z");
  fake = createFakeRankingsDb({
    tools: GOLDEN_TOOLS.map((tool) => ({ ...tool, data: tool.data ?? {}, createdAt: stamp, updatedAt: stamp })),
    rankings: [
      rankingRow({
        period: "2026-07",
        isCurrent: true,
        publishedAt: new Date("2026-07-01T09:00:00Z"),
        data: GOLDEN_PREVIOUS_SNAPSHOT.data,
      }),
    ],
  });
  db.client = fake.client;
  currentBefore = structuredClone(fake.state.rankings[0]);
});

function expectCurrentRowUntouched() {
  expect(fake.state.rankings.filter((r) => r.isCurrent)).toEqual([currentBefore]);
  expect(fake.state.writes.filter((w) => w.op === "update")).toEqual([]);
}

describe("POST /api/admin/rankings build and preview cannot publish (#93)", () => {
  it("build writes a non-current row on the current engine and leaves the current row alone", async () => {
    const res = await post({ action: "build", period: "2026-08" });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      success: true,
      period: "2026-08",
      rankings_count: GOLDEN_TOOLS.length,
      message: "Rankings built and saved successfully",
    });
    expectCurrentRowUntouched();
    const draft = fake.state.rankings.find((r) => r.period === "2026-08")!;
    expect(draft).toMatchObject({ isCurrent: false, publishedAt: null, algorithmVersion: RANKING_ALGORITHM_VERSION });
    expect(fake.state.writes.map((w) => w.op)).toEqual(["delete", "insert"]);
    expect(fsSpy.writeFileSync).not.toHaveBeenCalled();
  });

  it("build of the current period answers 409 and writes nothing", async () => {
    const res = await post({ action: "build", period: "2026-07" });

    expect(res.status).toBe(409);
    expect(fake.state.writes).toEqual([]);
    expectCurrentRowUntouched();
    expect(fsSpy.writeFileSync).not.toHaveBeenCalled();
  });

  it("build with dry_run writes nothing and returns the top 10 and the total", async () => {
    const res = await post({ action: "build", period: "2026-08", dry_run: true });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ success: true, dry_run: true, period: "2026-08", total: GOLDEN_TOOLS.length });
    expect(body.rankings.length).toBe(Math.min(10, GOLDEN_TOOLS.length));
    expect(body.rankings[0]).toMatchObject({ rank: 1, tier: "S" });
    expect(fake.state.writes).toEqual([]);
    expectCurrentRowUntouched();
  });

  it("preview writes nothing and reports the current engine's version", async () => {
    const res = await post({ action: "preview", period: "2026-08" });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.preview).toMatchObject({
      period: "2026-08",
      algorithm_version: RANKING_ALGORITHM_VERSION,
      total_tools: GOLDEN_TOOLS.length,
      comparison_period: "2026-07",
    });
    const movements = body.preview.rankings_comparison.map((r: { movement: string }) => r.movement);
    expect(movements).toContain("new");
    expect(movements.some((m: string) => m === "up" || m === "down" || m === "same")).toBe(true);
    expect(fake.state.writes).toEqual([]);
    expectCurrentRowUntouched();
  });
});
