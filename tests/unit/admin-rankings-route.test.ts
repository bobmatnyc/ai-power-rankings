/**
 * Regression coverage for the admin rankings route's V6 -> V7.6 migration (#93).
 *
 * Why: `app/api/admin/rankings/route.ts` used to score tools with the retired
 * `RankingEngineV6` for its "preview" and "build" actions, via a bespoke
 * `transformToToolMetrics()` shim, while the canonical live path
 * (`regenerateRankings()` / cron / CLI) has scored with `RankingEngineV76`
 * since v7.6. The two could silently disagree. This suite pins the migrated
 * route onto the SAME pure `computeRankings()` core the canonical service
 * uses, and asserts every previously-existing admin capability (preview
 * comparisons, build dry-run, build persistence, create-period defaults,
 * GET listing) still behaves the same way — only the scoring engine changed.
 *
 * What: Mocks `requireAdmin`, `ToolsRepository`, `RankingsRepository`,
 * `writeRankingsStaticCache`, and `node:fs`'s `writeFileSync` so the route
 * module runs with no real database or filesystem access, then drives its
 * exported `GET`/`POST` handlers directly with real `NextRequest` objects.
 *
 * Test: `npm run test:unit` (vitest). No database, no network, no file writes
 * (`writeFileSync` is mocked) — safe to run anywhere, including against the
 * live production database's admin surface, because it never connects to one.
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findByStatus: vi.fn(),
  findAllRankings: vi.fn(),
  getByPeriod: vi.fn(),
  getCurrentRankings: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  setAsCurrent: vi.fn(),
  writeFileSync: vi.fn(),
  writeRankingsStaticCache: vi.fn(),
}));

// NOTE: this repo's vitest + vite-tsconfig-paths setup does not resolve the
// `@/*` tsconfig alias for specifiers written INSIDE a `*.test.ts` file (every
// `*.test.ts` is excluded from tsconfig.json's own `include`/`exclude`, so the
// alias plugin never maps them) — confirmed empirically; no test anywhere in
// this repo uses a working `@/` import. Relative paths are the only form that
// resolves here, both for real imports and for `vi.mock()` specifiers (the
// mock is matched by final resolved module id, so a relative path from this
// file lines up with the `@/...` aliased import inside route.ts).
vi.mock("../../lib/api-auth", () => ({
  requireAdmin: vi.fn(async () => ({ error: null })),
}));

vi.mock("../../lib/db/repositories/tools.repository", () => ({
  ToolsRepository: vi.fn().mockImplementation(() => ({
    findByStatus: mocks.findByStatus,
  })),
}));

vi.mock("../../lib/db/repositories/rankings.repository", () => ({
  RankingsRepository: vi.fn().mockImplementation(() => ({
    findAll: mocks.findAllRankings,
    getByPeriod: mocks.getByPeriod,
    getCurrentRankings: mocks.getCurrentRankings,
    create: mocks.create,
    update: mocks.update,
    setAsCurrent: mocks.setAsCurrent,
  })),
}));

vi.mock("../../lib/cache/rankings-static-cache", () => ({
  writeRankingsStaticCache: mocks.writeRankingsStaticCache,
}));

vi.mock("../../lib/logger", () => ({
  loggers: { api: { warn: vi.fn(), error: vi.fn() } },
}));

vi.mock("node:fs", () => ({
  writeFileSync: mocks.writeFileSync,
}));

// Imported AFTER the mocks above so the route picks up the mocked modules.
import { DELETE, GET, POST } from "../../app/api/admin/rankings/route";
import { ALGORITHM_VERSION } from "../../lib/ranking-algorithm-v76";
import {
  computeRankings,
  RANKING_ALGORITHM_VERSION,
  type RankingSourceTool,
} from "../../lib/services/ranking-generation.service";

/** A `ToolsRepository.findByStatus()`-shaped row (flat JSONB spread onto the row). */
function makeRepoTool(id: string, name: string, users: number) {
  return {
    id,
    name,
    slug: name.toLowerCase(),
    category: "code-editor",
    status: "active",
    metrics: { users, github_stars: users / 10 },
  };
}

const sampleTools = [
  makeRepoTool("t1", "Alpha", 1_000_000),
  makeRepoTool("t2", "Bravo", 10_000),
  makeRepoTool("t3", "Charlie", 100),
];

/** Independent construction of the canonical RankingSourceTool for cross-checks. */
function toCanonicalSourceTool(tool: (typeof sampleTools)[number]): RankingSourceTool {
  return {
    id: tool.id,
    name: tool.name,
    slug: tool.slug,
    category: tool.category,
    status: tool.status,
    data: { metrics: tool.metrics },
  };
}

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/admin/rankings", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function getRequest(query = "") {
  return new NextRequest(`http://localhost/api/admin/rankings${query}`);
}

describe("app/api/admin/rankings/route (V6 -> V7.6 migration, #93)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findByStatus.mockResolvedValue(sampleTools);
    mocks.findAllRankings.mockResolvedValue([]);
    mocks.getByPeriod.mockResolvedValue(null);
    mocks.getCurrentRankings.mockResolvedValue(null);
    mocks.create.mockResolvedValue({ id: "r1" });
    mocks.update.mockResolvedValue({ id: "r1" });
  });

  describe("POST action=preview", () => {
    it("requires a period", async () => {
      const res = await POST(postRequest({ action: "preview" }));
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/period/i);
    });

    it("scores tools with the canonical V7.6 engine and matches computeRankings() exactly", async () => {
      const res = await POST(postRequest({ action: "preview", period: "2026-08" }));
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.preview.total_tools).toBe(sampleTools.length);
      // Cosmetic version label now reflects the live engine, not the retired "v6.0" default.
      expect(json.preview.algorithm_version).toBe(ALGORITHM_VERSION);
      expect(json.preview.algorithm_version).not.toBe("v6.0");

      // Independently compute the expected scores via the SAME canonical pure
      // function the route now delegates to, from equivalent fixtures. The
      // route must not diverge from this — that is the whole point of #93.
      const expected = computeRankings(sampleTools.map(toCanonicalSourceTool), new Map(), new Date("2026-08"));
      const expectedById = new Map(expected.map((e) => [e.tool_id, e]));

      expect(json.preview.rankings_comparison).toHaveLength(sampleTools.length);
      for (const row of json.preview.rankings_comparison) {
        const exp = expectedById.get(row.tool_id);
        expect(exp).toBeDefined();
        expect(row.current_score).toBe(exp!.score);
        expect(row.current_rank).toBe(exp!.rank);
        // No prior snapshot was supplied -> every tool is a fresh "new" entry.
        expect(row.movement).toBe("new");
        expect(row.previous_rank).toBeUndefined();
      }

      // Highest-ARR/stars tool (Alpha) must sort first.
      expect(json.preview.rankings_comparison[0].tool_id).toBe("t1");
    });

    it("marks a tool as up/down (not 'new') when a comparison snapshot has it ranked", async () => {
      mocks.findAllRankings.mockResolvedValue([
        {
          period: "2026-07",
          data: {
            rankings: [
              { tool_id: "t1", position: 3, score: 10 },
              { tool_id: "t2", position: 1, score: 90 },
              { tool_id: "t3", position: 2, score: 50 },
            ],
          },
        },
      ]);

      const res = await POST(postRequest({ action: "preview", period: "2026-08" }));
      const json = await res.json();

      const byId = new Map(json.preview.rankings_comparison.map((r) => [r.tool_id, r]));
      // Alpha (t1) scores highest live -> rank 1 now, was rank 3 -> moved up.
      expect(byId.get("t1").movement).toBe("up");
      expect(byId.get("t1").previous_rank).toBe(3);
      expect(byId.get("t1").previous_score).toBe(10);
    });
  });

  describe("POST action=build", () => {
    it("dry_run scores via V7.6 and does not touch persistence", async () => {
      const res = await POST(postRequest({ action: "build", period: "2026-08", dry_run: true }));
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.dry_run).toBe(true);
      expect(json.total).toBe(sampleTools.length);
      expect(mocks.create).not.toHaveBeenCalled();
      expect(mocks.update).not.toHaveBeenCalled();
      expect(mocks.writeFileSync).not.toHaveBeenCalled();

      const top = json.rankings[0];
      expect(top.position).toBe(1);
      expect(top.tool_id).toBe("t1");
      expect(Object.keys(top.factor_scores).sort()).toEqual(
        [
          "agentic_capability",
          "innovation",
          "technical_performance",
          "developer_adoption",
          "market_traction",
          "business_sentiment",
          "development_velocity",
          "platform_resilience",
        ].sort()
      );
    });

    it("persists a built period stamped with the live (non-V6) algorithm version", async () => {
      const res = await POST(postRequest({ action: "build", period: "2026-08" }));
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.rankings_count).toBe(sampleTools.length);
      expect(mocks.create).toHaveBeenCalledTimes(1);

      const createArg = mocks.create.mock.calls[0]![0];
      expect(createArg.algorithm_version).toBe(RANKING_ALGORITHM_VERSION);
      expect(createArg.algorithm_version).not.toBe("v6.0");
      expect(createArg.is_current).toBe(false);
      expect(createArg.data.rankings).toHaveLength(sampleTools.length);
    });

    it("only rewrites the public rankings.json when building the currently-live period", async () => {
      mocks.getCurrentRankings.mockResolvedValue({ period: "2026-08" });

      await POST(postRequest({ action: "build", period: "2026-08" }));
      expect(mocks.writeFileSync).toHaveBeenCalledTimes(1);

      mocks.writeFileSync.mockClear();
      mocks.getCurrentRankings.mockResolvedValue({ period: "2026-01" });

      await POST(postRequest({ action: "build", period: "2026-08" }));
      expect(mocks.writeFileSync).not.toHaveBeenCalled();
    });
  });

  describe("POST action=create-period", () => {
    it("defaults a fresh empty period to the live algorithm version, not v6.0", async () => {
      const res = await POST(postRequest({ action: "create-period", period: "2026-09" }));
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(mocks.create).toHaveBeenCalledTimes(1);
      const createArg = mocks.create.mock.calls[0]![0];
      expect(createArg.algorithm_version).toBe(RANKING_ALGORITHM_VERSION);
      expect(createArg.algorithm_version).not.toBe("v6.0");
      expect(createArg.data.rankings).toEqual([]);
    });
  });

  describe("GET", () => {
    it("lists periods without touching any ranking engine", async () => {
      mocks.findAllRankings.mockResolvedValue([
        {
          period: "2026-07",
          data: { rankings: [{}, {}] },
          algorithm_version: "7.8",
          is_current: true,
          created_at: new Date("2026-07-01"),
        },
      ]);

      const res = await GET(getRequest("?action=periods"));
      const json = await res.json();

      expect(json.total).toBe(1);
      expect(json.periods[0].tool_count).toBe(2);
      expect(json.periods[0].algorithm_version).toBe("7.8");
    });
  });

  describe("DELETE", () => {
    it("refuses to delete the current period", async () => {
      mocks.getByPeriod.mockResolvedValue({ id: "r1", is_current: true });
      const res = await DELETE(getRequest("?period=2026-07"));
      expect(res.status).toBe(400);
    });
  });
});
