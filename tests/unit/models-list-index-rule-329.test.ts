import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #329 (D63, amends D80): the models list is indexed only with 10 or more active rows that carry
 * a coding metric; below that it stays noindex with the metrics-pending note.
 *
 * Why: the owner accepted plan recommendation Q3. A list ordered by metric-less rows is not a
 *   ranking of quality, so the rule must count only active rows with sourced coding metrics.
 * What: checks `hasCodingMetric` (TB 4.0 from Vals only, D63 Q1 and D86; a SWE-bench Verified
 *   figure never counts), the pure index and note rules on both sides of the boundary (9 and 10), D53 thirds
 *   tiers below 10 entries, and `loadCurrentRankings()` / `GET /api/rankings?list=model` over a
 *   mocked repository boundary: inactive rows and rows without metrics do not count.
 *   #185: after v8 activation the combined board is never read, so the count comes from the
 *   models list's own board only; a combined row alone yields no board, and the API answers an
 *   empty models board that stays noindex with the metrics-pending note.
 * Test: `npx vitest run tests/unit/models-list-index-rule-329.test.ts`. No network, no database.
 */

const current = vi.hoisted(() => ({ rows: {} as Record<string, unknown> }));

vi.mock("server-only", () => ({}));
vi.mock("../../lib/db/connection", () => ({ getDb: () => ({}) }));
vi.mock("../../lib/db/repositories/rankings.repository", () => ({
  rankingsRepository: { getCurrentRankings: async (list = "combined") => current.rows[list] ?? null },
}));

type Tool = { id: string; slug: string; name: string; kind: string; status: string } & Record<string, unknown>;
const TOOLS: Record<string, Tool> = {};
vi.mock("../../lib/db/repositories/tools.repository", () => ({
  ToolsRepository: class {
    async findById(id: string) {
      const t = TOOLS[id];
      return t ? { ...t, db_id: t.id, category: "other", info: {} } : null;
    }
    async findColumnStatuses(ids: string[]) {
      return new Map(ids.flatMap((id) => (TOOLS[id] ? [[id, TOOLS[id].status] as [string, string]] : [])));
    }
    async findBySlug() {
      return null;
    }
  },
}));

import { GET } from "../../app/api/rankings/route";
import { countMetricRows, loadCurrentRankings } from "../../lib/rankings/current-rankings";
import {
  hasCodingMetric,
  isRankingListIndexable,
  listHasMetricsPendingNote,
  listTierScheme,
  METRIC_INDEX_MIN_ROWS,
  MODEL_TERMINAL_BENCH_SOURCE,
  rankingListMeta,
} from "../../lib/rankings/lists";

const VALS = MODEL_TERMINAL_BENCH_SOURCE;
const tb = (value: unknown, source?: string) => ({
  metrics: { terminal_bench: value },
  ...(source ? { metrics_provenance: { terminal_bench: { source, as_of: "2026-10-26" } } } : {}),
});

describe("hasCodingMetric (D63 Q1: TB 4.0 from Vals only)", () => {
  it.each<[string, unknown, boolean]>([
    ["a Vals TB 4.0 figure with provenance", tb(50, VALS), true],
    ["a Vals TB 4.0 figure naming its snapshot in a fragment", tb("40", `${VALS}#snapshot`), true],
    ["a vendor-reported TB figure", tb(50, "https://vendor.example/model-card"), false],
    ["the TB 2.1 leaderboard", tb(50, "https://www.tbench.ai/leaderboard/terminal-bench/2.1"), false],
    ["a TB figure without provenance", tb(50), false],
    ["a zero TB figure", tb(0, VALS), false],
    // #329 D86: only Vals TB 4.0 counts; SWE-bench Verified never does, whatever its source.
    [
      "only SWE-bench Verified from an independent source",
      { metrics: { swe_bench: { verified: 50 } }, metrics_provenance: { swe_bench: { source: "https://leaderboard.example/swe-bench" } } },
      false,
    ],
    [
      "only SWE-bench Verified from a vendor source",
      { metrics: { swe_bench: { verified: 50 } }, metrics_provenance: { swe_bench: { source: "https://vendor.example/model-card" } } },
      false,
    ],
    ["SWE-bench Verified without provenance", { metrics: { swe_bench: { verified: 50 } } }, false],
    [
      "a Vals TB 4.0 figure alongside SWE-bench Verified",
      { metrics: { terminal_bench: 50, swe_bench: { verified: 50 } }, metrics_provenance: { terminal_bench: { source: VALS } } },
      true,
    ],
    ["only a nested info.metrics copy", { info: { metrics: { terminal_bench: 65 } }, metrics_provenance: { terminal_bench: { source: VALS } } }, false],
    ["no metrics", { metrics: {} }, false],
  ])("%s -> %s", (_name, data, expected) => {
    expect(hasCodingMetric(data)).toBe(expected);
  });
});

describe("index and note rule at the boundary", () => {
  it("the models list is noindex with the note at 9 active rows with metrics, indexed without it at 10", () => {
    expect(METRIC_INDEX_MIN_ROWS).toBe(10);
    expect(isRankingListIndexable("model", 15, 9)).toBe(false);
    expect(listHasMetricsPendingNote("model", 9)).toBe(true);
    expect(isRankingListIndexable("model", 15, 10)).toBe(true);
    expect(listHasMetricsPendingNote("model", 10)).toBe(false);
    expect(rankingListMeta("model", 15, 10)).toMatchObject({ indexable: true, metric_row_count: 10, metrics_pending_note: false });
    expect(rankingListMeta("model", 15, 9)).toMatchObject({ indexable: false, metric_row_count: 9, metrics_pending_note: true });
  });

  it("keeps D53 for every list: fewer than 10 entries is noindex with thirds tiers", () => {
    expect(isRankingListIndexable("model", 9, 10)).toBe(false);
    expect(listTierScheme(9)).toBe("thirds");
    expect(isRankingListIndexable("harness", 10)).toBe(true);
    expect(listHasMetricsPendingNote("harness", 0)).toBe(false);
  });

  it("countMetricRows counts only rows that are active AND carry a metric", () => {
    const active = (n: number) => Array.from({ length: n }, () => ({ status: "active", codingMetric: true }));
    const noise = [
      { status: "inactive", codingMetric: true },
      { status: "redirect", codingMetric: true },
      { status: undefined, codingMetric: true },
      { status: "active", codingMetric: false },
    ];
    expect(countMetricRows([...active(9), ...noise])).toBe(9);
    expect(countMetricRows([...active(10), ...noise])).toBe(10);
  });
});

/** A models board of `metricActive` active rows with a Vals TB figure plus rows that must not count. */
function seed(boardKind: "combined" | "model" | "harness", metricActive: number) {
  for (const key of Object.keys(TOOLS)) delete TOOLS[key];
  const add = (slug: string, status: string, data: Record<string, unknown>) => {
    TOOLS[slug] = { id: slug, slug, name: slug, kind: "model", status, ...data };
  };
  for (let i = 0; i < metricActive; i++) add(`m${i}`, "active", tb(40 + i, VALS));
  add("inactive-with-metric", "inactive", tb(60, VALS));
  add("active-no-metric", "active", {});
  add("active-vendor-figure", "active", tb(50, "https://vendor.example/news"));
  const ids = Object.keys(TOOLS);
  const stamp = new Date("2026-10-01T00:00:00Z");
  current.rows = {
    [boardKind]: {
      id: `${boardKind}-row`,
      period: "2026-10",
      list: boardKind,
      algorithm_version: "7.10",
      is_current: true,
      published_at: stamp,
      created_at: stamp,
      updated_at: stamp,
      data: ids.map((id, i) => ({ tool_id: id, rank: i + 1, score: 50 })),
    },
  };
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.stubEnv("NODE_ENV", "production");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("models board count (loadCurrentRankings and /api/rankings)", () => {
  it("from a model board: 9 metric rows stay noindex, 10 index", async () => {
    const boardKind = "model";
    seed(boardKind, 9);
    const nine = (await loadCurrentRankings("model"))!;
    expect(nine.metricRowCount).toBe(9);

    seed(boardKind, 10);
    const ten = (await loadCurrentRankings("model"))!;
    expect(ten.metricRowCount).toBe(10);

    const res = await GET(new Request("https://example.test/api/rankings?list=model"));
    const body = (await res.json()) as { list_meta: { indexable: boolean; metric_row_count: number; metrics_pending_note: boolean } };
    expect(body.list_meta).toMatchObject({ indexable: true, metric_row_count: 10, metrics_pending_note: false });
  });

  it("from a combined board only (#185): no board, and the API answers an empty noindex models board", async () => {
    seed("combined", 10);
    expect(await loadCurrentRankings("model")).toBeNull();

    const res = await GET(new Request("https://example.test/api/rankings?list=model"));
    const body = (await res.json()) as { rankings: unknown[]; list_meta: { indexable: boolean; metric_row_count: number; metrics_pending_note: boolean } };
    expect(body.rankings).toEqual([]);
    expect(body.list_meta).toMatchObject({ indexable: false, metric_row_count: 0, metrics_pending_note: true });
  });

  it("the harness board does not count model metrics", async () => {
    // #185: the harness list's own board; the combined board is no longer read.
    seed("harness", 10);
    for (const t of Object.values(TOOLS)) t.kind = "harness";
    expect((await loadCurrentRankings("harness"))!.metricRowCount).toBe(0);
  });
});
