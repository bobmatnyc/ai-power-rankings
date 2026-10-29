import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #329: every ranked model row carries its version.
 *
 * Why: the owner ruled that each model shows its version; the API sent none, and the
 *   card showed one only when the description prose happened to name it.
 * What: runs the REAL `ToolsRepository` and `loadCurrentRankings()` over a fake `getDb`
 *   (the #301 test's pattern). A model row's `tool.version` is the stored lifecycle point,
 *   else the stored seed `current_version`, else null; the description is never parsed.
 *   A non-model row has no `version` key. Also checks that the six live family rows
 *   resolve to a version through the lifecycle record the status step writes.
 * Test: `npx vitest run tests/unit/model-version-329.test.ts`. No network.
 */

const db = vi.hoisted(() => ({ rows: [] as Array<Record<string, any>> }));

vi.mock("server-only", () => ({}));
vi.mock("../../lib/db/connection", () => ({
  getDb: () => ({
    select: (fields?: unknown) => ({
      from: () => ({
        where: (predicate: unknown) => {
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
import * as versionModule from "../../lib/rankings/model-version";

function paramsOf(node: any): unknown[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(paramsOf);
  if (Array.isArray(node.queryChunks)) return node.queryChunks.flatMap(paramsOf);
  if ("encoder" in node && "value" in node) return Array.isArray(node.value) ? node.value : [node.value];
  return [];
}

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const STAMP = new Date("2026-01-01T00:00:00Z");

function tool(n: number, slug: string, kind: string, data: Record<string, unknown>) {
  return {
    id: uuid(n),
    slug,
    name: slug,
    category: "other",
    status: "active",
    kind,
    companyId: null,
    // The description names a version that must never be read.
    data: { id: `legacy-${slug}`, info: { description: "Version: from-prose" }, ...data },
    createdAt: STAMP,
    updatedAt: STAMP,
  };
}

function seed(rows: Array<Record<string, any>>) {
  db.rows = rows;
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

describe("model rows carry a version (#329)", () => {
  it("uses the lifecycle point first, then the seed current_version, else null", async () => {
    seed([
      tool(1, "alpha", "model", {
        modelLifecycle: { point: "5.5" },
        modelSeed: { facts: { current_version: { value: "Alpha 4.8" } } },
      }),
      tool(2, "bravo", "model", { modelSeed: { facts: { current_version: { value: "Bravo 4.8" } } } }),
      tool(3, "charlie", "model", {}),
    ]);
    const board = (await loadCurrentRankings("model"))!;
    const versions = Object.fromEntries(board.rankings.map((r) => [r.tool.slug, (r.tool as any).version]));
    expect(versions).toEqual({ alpha: "5.5", bravo: "Bravo 4.8", charlie: null });
  });

  it("adds no version key to a non-model row", async () => {
    seed([tool(1, "delta", "harness", { modelLifecycle: { point: "5.5" } })]);
    const board = (await loadCurrentRankings("harness"))!;
    expect(board.rankings).toHaveLength(1);
    expect("version" in board.rankings[0]!.tool).toBe(false);
  });

  it("resolves a version for each of the six live family rows from the lifecycle file", async () => {
    const { readFileSync } = await import("node:fs");
    const doc = JSON.parse(readFileSync("docs/refresh/model-lifecycle.json", "utf8"));
    const families = ["claude-opus", "claude-sonnet", "deepseek", "glm", "grok", "kimi"];
    const rows = (doc.models as Array<Record<string, unknown>>).filter((r) => families.includes(String(r["slug"])));
    expect(rows.map((r) => r["slug"]).sort()).toEqual([...families].sort());
    for (const row of rows) {
      const stored = { kind: "model", modelLifecycle: { point: row["point"] } };
      expect(versionModule.modelVersion(stored), String(row["slug"])).toMatch(/^\d+\.\d+$/);
    }
  });
});
