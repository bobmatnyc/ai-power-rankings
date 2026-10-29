import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #329: the sitemap lists `/rankings/models` on the same count as the page and `/api/rankings`.
 *
 * Why: `toolsRepository.findAll()` spreads `tools.data` over the row, so a stale `data.status`
 *   ("active") hides a `tools.status` column of `redirect` (the D91 alias rows). A sitemap that
 *   counted from it could list the models page while the page renders noindex, failing open.
 * What: mocks the repository boundary with a models board whose tools carry a Vals TB 4.0
 *   metric. One row's column is `redirect` while its data copy says `active`; it must not
 *   count, so 9 genuine rows plus that row leave the page out, and 10 genuine rows list it.
 * Test: `npx vitest run tests/unit/sitemap-models-count-329.test.ts`. No network, no database.
 */

const current = vi.hoisted(() => ({ rows: {} as Record<string, unknown>, fail: false }));
type Tool = { id: string; slug: string; name: string; kind: string; column: string } & Record<string, unknown>;
const TOOLS = vi.hoisted(() => ({}) as Record<string, Tool>);

vi.mock("server-only", () => ({}));
vi.mock("../../lib/db/connection", () => ({ getDb: () => ({}) }));
vi.mock("../../lib/services/whats-new-summary.service", () => ({ listPeriods: async () => [] }));
vi.mock("../../lib/db/repositories/news", () => ({ newsRepository: { getPublishedSlugs: async () => [] } }));
vi.mock("../../lib/services/weekly-digest.repository", () => ({ listDigestWeeks: async () => [] }));
vi.mock("../../lib/db/repositories/rankings.repository", () => ({
  rankingsRepository: {
    getCurrentRankings: async (list = "combined") => {
      if (current.fail) throw new Error("board read failed");
      return current.rows[list] ?? null;
    },
  },
}));
vi.mock("../../lib/db/repositories/tools.repository", () => {
  // The mapper's shape: the stale JSONB `status` ("active") wins over the column.
  const mapped = (t: Tool) => {
    const { column: _column, ...rest } = t;
    return { ...rest, db_id: t.id, category: "other", info: {}, status: "active", updated_at: "2026-01-02" };
  };
  class ToolsRepository {
    async findAll() {
      return Object.values(TOOLS).map(mapped);
    }
    async findById(id: string) {
      return TOOLS[id] ? mapped(TOOLS[id]) : null;
    }
    async findBySlug() {
      return null;
    }
    async findColumnStatuses(ids: string[]) {
      return new Map(ids.flatMap((id) => (TOOLS[id] ? [[id, TOOLS[id].column] as [string, string]] : [])));
    }
  }
  return { ToolsRepository, toolsRepository: new ToolsRepository() };
});

import { locales } from "../../i18n/config";
import { MODEL_TERMINAL_BENCH_SOURCE } from "../../lib/rankings/lists";
import { buildSitemapEntries } from "../../lib/sitemap";

const metric = { metrics: { terminal_bench: 50 }, metrics_provenance: { terminal_bench: { source: MODEL_TERMINAL_BENCH_SOURCE } } };

function seed(genuine: number, withRedirectAlias: boolean, withNoise = false) {
  for (const key of Object.keys(TOOLS)) delete TOOLS[key];
  for (let i = 0; i < genuine; i++) TOOLS[`m${i}`] = { id: `m${i}`, slug: `m-${i}`, name: `M${i}`, kind: "model", column: "active", ...metric };
  if (withRedirectAlias) {
    TOOLS["alias"] = { id: "alias", slug: "alias-4-6", name: "Alias", kind: "model", column: "redirect", redirect_to: "m-0", ...metric };
  }
  if (withNoise) {
    for (let i = 0; i < 3; i++) TOOLS[`in${i}`] = { id: `in${i}`, slug: `in-${i}`, name: `I${i}`, kind: "model", column: "inactive", ...metric };
    for (let i = 0; i < 3; i++) TOOLS[`nm${i}`] = { id: `nm${i}`, slug: `nm-${i}`, name: `N${i}`, kind: "model", column: "active" };
    // #329 D86: an active row with only a sourced SWE-bench Verified figure does not count.
    TOOLS["swe"] = {
      id: "swe",
      slug: "swe-only",
      name: "S",
      kind: "model",
      column: "active",
      metrics: { swe_bench: { verified: 50 } },
      metrics_provenance: { swe_bench: { source: "https://leaderboard.example/swe-bench" } },
    };
  }
  const stamp = new Date("2026-10-01T00:00:00Z");
  current.rows = {
    combined: {
      id: "combined-row",
      period: "2026-10",
      list: "combined",
      algorithm_version: "7.10",
      is_current: true,
      published_at: stamp,
      created_at: stamp,
      updated_at: stamp,
      data: Object.keys(TOOLS).map((id, i) => ({ tool_id: id, rank: i + 1, score: 50 })),
    },
  };
}

async function modelsListed(): Promise<number> {
  const paths = (await buildSitemapEntries("https://example.test")).map((e) => new URL(e.url).pathname);
  return paths.filter((p) => p.endsWith("/rankings/models")).length;
}

beforeEach(() => {
  current.fail = false;
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("sitemap /rankings/models count (#329, D63)", () => {
  it("does not count a redirect row whose stale data.status says active", async () => {
    seed(9, true);
    expect(await modelsListed()).toBe(0);
  });

  it("lists the page at 10 genuine active rows with a Vals metric", async () => {
    seed(10, false);
    expect(await modelsListed()).toBe(locales.length);
  });

  // Moved from models-list-noindex.test.tsx, which counted findAll()'s status (the defect).
  it.each([
    [9, 0],
    [10, locales.length],
  ])("with %i active metric rows plus inactive and metric-less rows, lists it %i times", async (n, listed) => {
    seed(n, false, true);
    expect(await modelsListed()).toBe(listed);
  });

  it("leaves only /rankings/models out when the board read fails", async () => {
    seed(10, false);
    current.fail = true;
    const entries = await buildSitemapEntries("https://example.test");
    current.fail = false;
    expect(entries.some((e) => e.url.endsWith("/rankings/models"))).toBe(false);
    expect(entries.length).toBeGreaterThan(0);
  });
});
