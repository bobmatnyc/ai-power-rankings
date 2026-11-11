import { isValidElement, type ReactNode } from "react";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { locales } from "../../i18n/config";

/**
 * #195: `/[lang]/rankings/models?open=1` ranks only open-weight models.
 *
 * Why: the open-weight view is a filter of the models board. It must keep only rows
 *   whose `tools.open_weight` column is true, ranked 1..n among themselves, leave the
 *   unfiltered board as it was, say so when no model is open-weight (never fall back
 *   to the full board), and not become a duplicate page for search engines.
 * What: the rankings and tools repositories are stubbed (no database). The model board
 *   holds m1 (closed), m2 (open), m3 (closed), m4 (open), each with a coding metric.
 *   The checks run the real `loadCurrentRankings()`, the real middleware, and the real
 *   `generateMetadata` and page components of `/rankings/[list]` and the open-weight
 *   route that `?open=1` is rewritten to, walking the returned element trees.
 * Test: `npx vitest run tests/unit/rankings-open-weight-195.test.ts`. No network.
 */

const ORIGIN = "https://aipowerranking.com";
const METRIC = vi.hoisted(() => ({
  metrics: { terminal_bench: 50 },
  metrics_provenance: { terminal_bench: { source: "https://www.vals.ai/benchmarks/terminal-bench-4" } },
}));

const state = vi.hoisted(() => ({
  current: {} as Record<string, unknown>,
  /** The ids whose `tools.open_weight` column is true. */
  openWeight: new Set<string>(),
  openWeightReads: 0,
}));

const NOT_FOUND = new Error("NEXT_NOT_FOUND");
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw NOT_FOUND;
  },
  useRouter: () => ({ push: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("../../lib/db/connection", () => ({ getDb: () => ({}) }));
vi.mock("../../lib/db/repositories/rankings.repository", () => ({
  rankingsRepository: {
    getCurrentRankings: async (list = "combined") => state.current[list] ?? null,
    findAllForList: async () => [],
    findAll: async () => [],
  },
}));

const toolOf = vi.hoisted(() => (id: string) => ({
  id,
  db_id: id,
  slug: `${id}-slug`,
  name: `Tool ${id}`,
  category: "other",
  kind: id.startsWith("m") ? "model" : "harness",
  status: "active",
  info: {},
  ...(id.startsWith("m") ? METRIC : {}),
}));

vi.mock("../../lib/db/repositories/tools.repository", () => ({
  ToolsRepository: class {
    async findById(id: string) {
      return toolOf(id);
    }
    async findBySlug() {
      return null;
    }
    async findColumnStatuses(ids: string[]) {
      return new Map(ids.map((id) => [id, "active"] as [string, string]));
    }
    async findOpenWeightIds(ids: string[]) {
      state.openWeightReads += 1;
      return new Set(ids.filter((id) => state.openWeight.has(id)));
    }
  },
}));

const MODEL_BOARD = ["m1", "m2", "m3", "m4"];

function stored(list: string, ids: string[]) {
  return {
    id: `${list}-2026-11`,
    period: "2026-11",
    list,
    algorithm_version: "8.1",
    is_current: true,
    published_at: new Date("2026-11-01T00:00:00Z"),
    created_at: new Date("2026-11-01T00:00:00Z"),
    // previous ranks are the stored order reversed, so a renumbering is visible.
    data: ids.map((id, i) => ({
      tool_id: id,
      tool_slug: `${id}-slug`,
      rank: i + 1,
      score: 90 - i,
      movement: { previous_position: ids.length - i, change: 0 },
    })),
  };
}

const params = (p: Record<string, string>) => ({ params: Promise.resolve(p) }) as never;

type Meta = { alternates?: { canonical?: string }; robots?: unknown; openGraph?: { url?: unknown } };

/** Every element in a rendered server tree whose props match `test`. */
function findIn(node: ReactNode, test: (props: Record<string, any>) => boolean, out: Record<string, any>[] = []) {
  if (Array.isArray(node)) {
    for (const child of node) findIn(child, test, out);
    return out;
  }
  if (!isValidElement(node)) return out;
  const props = node.props as Record<string, any>;
  if (test(props)) out.push(props);
  findIn(props.children, test, out);
  return out;
}

const gridOf = (tree: ReactNode) => findIn(tree, (p) => Array.isArray(p["initialRankings"]));
const emptyNoteOf = (tree: ReactNode) => findIn(tree, (p) => p["data-note"] === "open-weight-empty");

async function unfilteredRoute() {
  return import("../../app/[lang]/rankings/[list]/page");
}
async function openWeightRoute() {
  // The route `?open=1` is rewritten to (#195).
  return import("../../app/[lang]/rankings/[list]/open-weight/page");
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_BASE_URL", undefined);
  vi.stubEnv("NEXTAUTH_URL", undefined);
  vi.stubEnv("VERCEL_BRANCH_URL", undefined);
  vi.stubEnv("VERCEL_ENV", "production");
  state.current = { model: stored("model", MODEL_BOARD), harness: stored("harness", ["h1", "h2"]) };
  state.openWeight = new Set(["m2", "m4"]);
  state.openWeightReads = 0;
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

vi.setConfig({ testTimeout: 60_000 });

describe("#195 the open-weight board", () => {
  it("keeps only open-weight rows, ranked 1..n with previous ranks renumbered among them", async () => {
    const { loadCurrentRankings } = await import("../../lib/rankings/current-rankings");
    const board = (await loadCurrentRankings("model", { openWeightOnly: true }))!;
    expect(board.rankings.map((r) => r.tool.slug)).toEqual(["m2-slug", "m4-slug"]);
    expect(board.rankings.map((r) => r.rank)).toEqual([1, 2]);
    // stored previous ranks 3 (m2) and 1 (m4) renumber to 2 and 1 among the two.
    expect(board.rankings.map((r) => r.previousRank)).toEqual([2, 1]);
    // the D63 count stays the whole board's.
    expect(board.metricRowCount).toBe(4);
  });

  it("the unfiltered board is unchanged and reads no open-weight column", async () => {
    const { loadCurrentRankings } = await import("../../lib/rankings/current-rankings");
    const board = (await loadCurrentRankings("model"))!;
    expect(board.rankings.map((r) => [r.tool.slug, r.rank, r.previousRank])).toEqual([
      ["m1-slug", 1, 4],
      ["m2-slug", 2, 3],
      ["m3-slug", 3, 2],
      ["m4-slug", 4, 1],
    ]);
    expect(state.openWeightReads).toBe(0);
  });
});

describe("#195 the ?open=1 URL", () => {
  async function run(url: string) {
    const { default: middleware } = await import("../../middleware");
    return middleware(new NextRequest(url), {} as never) as Response;
  }

  it("/en/rankings/models?open=1 is rewritten to the open-weight route, keeping its URL", async () => {
    const res = await run("https://aipowerranking.com/en/rankings/models?open=1");
    expect(res.status).toBe(200);
    expect(new URL(res.headers.get("x-middleware-rewrite") ?? "", ORIGIN).pathname).toBe("/en/rankings/models/open-weight");
  });

  it.each([
    "https://aipowerranking.com/en/rankings/models",
    "https://aipowerranking.com/en/rankings/models?open=0",
    "https://aipowerranking.com/en/rankings/productivity-tools?open=1",
  ])("%s is not rewritten", async (url) => {
    const res = await run(url);
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("the internal path itself answers a 308 to the ?open=1 URL", async () => {
    const res = await run("https://aipowerranking.com/de/rankings/models/open-weight");
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe("https://aipowerranking.com/de/rankings/models?open=1");
  });
});

describe("#195 the open-weight page", () => {
  it("renders only the open-weight rows, ranked 1..n", async () => {
    const { default: Page } = await openWeightRoute();
    const tree = await Page(params({ lang: "en", list: "models" }));
    const [grid] = gridOf(tree);
    expect(grid?.["initialRankings"].map((r: any) => [r.tool.slug, r.rank])).toEqual([
      ["m2-slug", 1],
      ["m4-slug", 2],
    ]);
    expect(emptyNoteOf(tree)).toEqual([]);
  });

  it("the unfiltered models page still renders every model row and no empty note", async () => {
    const { default: Page } = await unfilteredRoute();
    const tree = await Page(params({ lang: "en", list: "models" }));
    const [grid] = gridOf(tree);
    expect(grid?.["initialRankings"].map((r: any) => r.tool.slug)).toEqual(["m1-slug", "m2-slug", "m3-slug", "m4-slug"]);
    expect(emptyNoteOf(tree)).toEqual([]);
    expect(state.openWeightReads).toBe(0);
  });

  it("with no open-weight model it shows the empty message and no grid (which would fetch the full board)", async () => {
    state.openWeight = new Set();
    const { default: Page } = await openWeightRoute();
    const tree = await Page(params({ lang: "en", list: "models" }));
    expect(gridOf(tree)).toEqual([]);
    const [note] = emptyNoteOf(tree);
    expect(note?.["children"]).toBe("No open-weight models are ranked yet.");
  });

  it("the empty message exists in every locale's dictionary", async () => {
    for (const locale of locales) {
      const dict = (await import(`../../i18n/dictionaries/${locale}.json`)).default;
      const text = dict.rankings.lists.openWeightEmpty;
      expect(typeof text, locale).toBe("string");
      expect(text.length, locale).toBeGreaterThan(0);
    }
  });

  it("only the models list has an open-weight page", async () => {
    const { default: Page } = await openWeightRoute();
    await expect(Page(params({ lang: "en", list: "productivity-tools" }))).rejects.toBe(NOT_FOUND);
    await expect(Page(params({ lang: "en", list: "coding-harnesses" }))).rejects.toBe(NOT_FOUND);
  });
});

describe("#195 SEO of the open-weight view", () => {
  it.each(["en", "ja"])("%s: its canonical is the unfiltered models page, and its metadata is that page's", async (lang) => {
    const filtered = (await (await openWeightRoute()).generateMetadata(params({ lang, list: "models" }))) as Meta;
    const unfiltered = (await (await unfilteredRoute()).generateMetadata(params({ lang, list: "models" }))) as Meta;
    expect(filtered.alternates?.canonical).toBe(`${ORIGIN}/${lang}/rankings/models`);
    expect(String(filtered.openGraph?.url)).toBe(`${ORIGIN}/${lang}/rankings/models`);
    expect(filtered).toEqual(unfiltered);
  });
});
