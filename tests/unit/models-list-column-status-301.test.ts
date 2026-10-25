import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The models list filters on the `tools.status` column, not on a stale JSONB copy (#301).
 *
 * Why: the repository mapper spreads the JSONB `data` over the row, so a retired row
 *   (column `redirect`) with an old `data.status` of `active` read back as active and
 *   passed the list filter. Migration 0019 merged into `data`, so such rows exist.
 * What: runs the REAL `ToolsRepository` and `loadCurrentRankings()` over a fake `getDb`
 *   that holds made-up rows and matches the bound where-parameters. The column decides
 *   in both directions: column `redirect` with data `active` is dropped and the ranks
 *   renumber; column `active` with data `redirect` or `inactive` is kept. When the status
 *   lookup rejects, the read rejects (fails closed).
 *   #185: after v8 activation the combined board is never read, so the column-status
 *   filter on it has nothing left to filter. The three cases now assert that a combined
 *   row yields no board whatever the column and data statuses, and that no status
 *   lookup is made, so a failing lookup cannot reject the read.
 * Test: `npx vitest run tests/unit/models-list-column-status-301.test.ts`. No network.
 */

const db = vi.hoisted(() => ({ rows: [] as Array<Record<string, any>>, failStatusLookup: false }));

vi.mock("server-only", () => ({}));
vi.mock("../../lib/db/connection", () => ({
  getDb: () => ({
    select: (fields?: unknown) => ({
      from: () => ({
        where: (predicate: unknown) => {
          if (fields && db.failStatusLookup) return Promise.reject(new Error("status lookup failed"));
          const params = new Set(paramsOf(predicate));
          const hit = db.rows.filter((r) => params.has(r.id) || params.has(r.slug) || params.has(r.data?.id));
          const result = fields ? hit.map((r) => ({ id: r.id, status: r.status })) : hit;
          return Object.assign(Promise.resolve(result), { limit: async () => result.slice(0, 1) });
        },
      }),
    }),
  }),
}));

const current = vi.hoisted(() => ({ rows: {} as Record<string, unknown> }));
vi.mock("../../lib/db/repositories/rankings.repository", () => ({
  rankingsRepository: { getCurrentRankings: async (list = "combined") => current.rows[list] ?? null },
}));

import { loadCurrentRankings } from "../../lib/rankings/current-rankings";

/** The bound parameter values inside a Drizzle SQL object (walks nested chunks). */
function paramsOf(node: any): unknown[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(paramsOf);
  if (Array.isArray(node.queryChunks)) return node.queryChunks.flatMap(paramsOf);
  if ("encoder" in node && "value" in node) return Array.isArray(node.value) ? node.value : [node.value];
  return [];
}

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const STAMP = new Date("2026-01-01T00:00:00Z");

function tool(n: number, slug: string, status: string, dataStatus: string) {
  return {
    id: uuid(n),
    slug,
    name: slug,
    category: "other",
    status,
    kind: "model",
    companyId: null,
    data: { id: `legacy-${slug}`, status: dataStatus },
    createdAt: STAMP,
    updatedAt: STAMP,
  };
}

function seed(rows: Array<Record<string, any>>) {
  db.rows = rows;
  db.failStatusLookup = false;
  current.rows = {
    combined: {
      id: "combined-row",
      period: "2026-10",
      list: "combined",
      algorithm_version: "7.10",
      is_current: true,
      published_at: STAMP,
      created_at: STAMP,
      updated_at: STAMP,
      data: rows.map((r, i) => ({ tool_id: r.id, rank: i + 1, score: 50 })),
    },
  };
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("models list ignores the combined board whatever the tools.status column says (#301, #185)", () => {
  it("a column-redirect row whose data.status is active: no board", async () => {
    seed([
      tool(1, "alpha", "redirect", "active"),
      tool(2, "bravo", "active", "active"),
      tool(3, "charlie", "active", "active"),
    ]);
    expect(await loadCurrentRankings("model")).toBeNull();
  });

  it("a column-active row whose data.status is redirect or inactive: no board", async () => {
    seed([
      tool(1, "alpha", "active", "redirect"),
      tool(2, "bravo", "active", "inactive"),
      tool(3, "charlie", "inactive", "active"),
    ]);
    expect(await loadCurrentRankings("model")).toBeNull();
  });

  it("makes no status lookup, so a failing lookup does not reject the read", async () => {
    seed([tool(1, "alpha", "redirect", "active"), tool(2, "bravo", "active", "active")]);
    db.failStatusLookup = true;
    await expect(loadCurrentRankings("model")).resolves.toBeNull();
  });
});
