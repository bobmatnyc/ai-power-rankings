import { isValidElement, type ReactNode } from "react";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { locales } from "../../i18n/config";

/**
 * #196: `/[lang]/rankings/coding-harnesses?category=<value>` filters the harness board.
 *
 * Why: the #191 URL table sends the old `/best-*` pages to `?category=` views of the
 *   harness board. Each value the table names must show only that category's tools, an
 *   empty or unknown value the whole board, a category with no ranked tool an empty
 *   message (never the full board), and no view may become a page of its own for search
 *   engines (D51). The 308s stay held until the release is ruled on.
 * What: the rankings and tools repositories are stubbed (no database; the board reads no
 *   column beyond the joined tool, so no pglite is needed). The harness board holds one
 *   tool per table category plus a `code-assistant` tool. The checks run the real
 *   middleware, the real `generateMetadata` and page components of `/rankings/[list]`
 *   and the category route `?category=` is rewritten to, walking the returned element
 *   trees, and read the real URL table.
 * Test: `npx vitest run tests/unit/rankings-category-196.test.ts`. No network.
 */

const ORIGIN = "https://aipowerranking.com";

const state = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

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

/** Tool `h-<category>` is a harness of that category. */
vi.mock("../../lib/db/repositories/tools.repository", () => ({
  ToolsRepository: class {
    async findById(id: string) {
      return { id, db_id: id, slug: id, name: `Tool ${id}`, category: id.slice(2), kind: "harness", status: "active", info: {} };
    }
    async findBySlug() {
      return null;
    }
    async findColumnStatuses(ids: string[]) {
      return new Map(ids.map((id) => [id, "active"] as [string, string]));
    }
  },
}));

const { HARNESS_CATEGORIES } = await import("../../lib/rankings/harness-category");
const { URL_TABLE_ROWS, PENDING_TARGETS, isPendingTarget, resolveTableRedirect } = await import("../../lib/seo/url-table");

// One tool per category, in reverse order so board order differs from category order, plus a non-table category.
const BOARD = [...[...HARNESS_CATEGORIES].reverse(), "code-assistant"].map((c) => `h-${c}`);

function stored(list: string, ids: string[]) {
  return {
    id: `${list}-2026-11`,
    period: "2026-11",
    list,
    algorithm_version: "8.1",
    is_current: true,
    published_at: new Date("2026-11-01T00:00:00Z"),
    created_at: new Date("2026-11-01T00:00:00Z"),
    data: ids.map((id, i) => ({ tool_id: id, tool_slug: id, rank: i + 1, score: 90 - i })),
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
const emptyNoteOf = (tree: ReactNode) => findIn(tree, (p) => p["data-note"] === "category-empty");
const shownSlugs = (tree: ReactNode) => gridOf(tree)[0]?.["initialRankings"].map((r: any) => r.tool.slug);

const unfilteredRoute = () => import("../../app/[lang]/rankings/[list]/page");
// The route a known `?category=` is rewritten to (#196).
const categoryRoute = () => import("../../app/[lang]/rankings/[list]/category/[category]/page");

async function run(url: string) {
  const { default: middleware } = await import("../../middleware");
  return middleware(new NextRequest(url), {} as never) as Response;
}
const rewrittenPath = (res: Response) => {
  const to = res.headers.get("x-middleware-rewrite");
  return to === null ? null : new URL(to, ORIGIN).pathname;
};

/** The table rows that target the harness board, and the `category` each names ("" for none). */
const harnessRows = URL_TABLE_ROWS.filter((row) => row.destination.split("?")[0] === "/en/rankings/coding-harnesses");
const tableCategories = [...new Set(harnessRows.map((row) => new URL(row.destination, ORIGIN).searchParams.get("category") ?? ""))]
  .filter(Boolean)
  .sort();

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_BASE_URL", undefined);
  vi.stubEnv("NEXTAUTH_URL", undefined);
  vi.stubEnv("VERCEL_BRANCH_URL", undefined);
  vi.stubEnv("VERCEL_ENV", "production");
  state.current = { harness: stored("harness", BOARD), model: stored("model", []) };
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

vi.setConfig({ testTimeout: 60_000 });

describe("#196 the category values", () => {
  it("are exactly the categories the URL table's harness-board rows name", () => {
    expect(harnessRows).toHaveLength(97);
    expect(tableCategories).toEqual([...HARNESS_CATEGORIES].sort());
  });
});

describe("#196 the filtered board", () => {
  it.each([...HARNESS_CATEGORIES])("?category=%s renders only that category's tool, with its board rank", async (category) => {
    const { default: Page } = await categoryRoute();
    const tree = await Page(params({ lang: "en", list: "coding-harnesses", category }));
    const [grid] = gridOf(tree);
    expect(grid?.["initialRankings"].map((r: any) => [r.tool.slug, r.tool.category, r.rank])).toEqual([
      [`h-${category}`, category, BOARD.indexOf(`h-${category}`) + 1],
    ]);
    expect(emptyNoteOf(tree)).toEqual([]);
  });

  it.each(["no-such-category", ""])("an unknown or empty category (%j) renders the unfiltered board", async (category) => {
    const { default: Page } = await categoryRoute();
    const tree = await Page(params({ lang: "en", list: "coding-harnesses", category }));
    expect(shownSlugs(tree)).toEqual(BOARD);
    expect(emptyNoteOf(tree)).toEqual([]);
  });

  it("a category with no ranked tool shows the empty message and no grid (which would fetch the full board)", async () => {
    state.current["harness"] = stored("harness", BOARD.filter((id) => id !== "h-testing-tool"));
    const { default: Page } = await categoryRoute();
    const tree = await Page(params({ lang: "en", list: "coding-harnesses", category: "testing-tool" }));
    expect(gridOf(tree)).toEqual([]);
    const [note] = emptyNoteOf(tree);
    expect(note?.["children"]).toBe("No tools in this category are ranked yet.");
  });

  it("the empty message exists in every locale's dictionary", async () => {
    for (const locale of locales) {
      const dict = (await import(`../../i18n/dictionaries/${locale}.json`)).default;
      const text = dict.rankings.lists.categoryEmpty;
      expect(typeof text, locale).toBe("string");
      expect(text.length, locale).toBeGreaterThan(0);
    }
  });

  it("the unfiltered board still renders every row", async () => {
    const { default: Page } = await unfilteredRoute();
    expect(shownSlugs(await Page(params({ lang: "en", list: "coding-harnesses" })))).toEqual(BOARD);
  });

  it("only the harness board has category views", async () => {
    const { default: Page } = await categoryRoute();
    await expect(Page(params({ lang: "en", list: "productivity-tools", category: "app-builder" }))).rejects.toBe(NOT_FOUND);
  });
});

describe("#196 the ?category= URL in every locale", () => {
  it.each(locales.flatMap((lang) => HARNESS_CATEGORIES.map((category) => [lang, category])))(
    "/%s/rankings/coding-harnesses?category=%s is rewritten to its category route, keeping its URL",
    async (lang, category) => {
      const res = await run(`${ORIGIN}/${lang}/rankings/coding-harnesses?category=${category}`);
      expect(res.status).toBe(200);
      expect(rewrittenPath(res)).toBe(`/${lang}/rankings/coding-harnesses/category/${category}`);
    }
  );

  it.each([
    `${ORIGIN}/en/rankings/coding-harnesses`,
    `${ORIGIN}/en/rankings/coding-harnesses?category=`,
    `${ORIGIN}/ja/rankings/coding-harnesses?category=no-such-category`,
    `${ORIGIN}/en/rankings/models?category=app-builder`,
  ])("%s is not rewritten (the page as it is)", async (url) => {
    const res = await run(url);
    expect(res.status).toBe(200);
    expect(rewrittenPath(res)).toBeNull();
  });

  it("an internal category path answers a 308 to the ?category= URL", async () => {
    const res = await run(`${ORIGIN}/de/rankings/coding-harnesses/category/code-review`);
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe(`${ORIGIN}/de/rankings/coding-harnesses?category=code-review`);
  });
});

describe("#196 SEO of a category view (D51)", () => {
  it.each(["en", "ja"])("%s: its metadata is the unfiltered board's, canonical /rankings", async (lang) => {
    const filtered = (await (await categoryRoute()).generateMetadata(
      params({ lang, list: "coding-harnesses", category: "app-builder" })
    )) as Meta;
    const unfiltered = (await (await unfilteredRoute()).generateMetadata(params({ lang, list: "coding-harnesses" }))) as Meta;
    expect(filtered.alternates?.canonical).toBe(`${ORIGIN}/${lang}/rankings`);
    expect(String(filtered.openGraph?.url)).toBe(`${ORIGIN}/${lang}/rankings`);
    expect(filtered).toEqual(unfiltered);
  });
});

describe("#196 the 308 hold stays in place", () => {
  it("PENDING_TARGETS still holds the harness board", () => {
    expect(PENDING_TARGETS.map(String)).toContain(String(/^\/en\/rankings\/coding-harnesses$/));
  });

  it("every table row targeting the harness board is held: no 308 resolves to it", () => {
    for (const row of harnessRows) {
      expect(isPendingTarget(row.destination), row.source).toBe(true);
      expect(resolveTableRedirect(row.source), row.source).toBeNull();
    }
  });

  it("a held source is still served, not redirected", async () => {
    const res = await run(`${ORIGIN}/de/best-ai-app-builders`);
    expect(res.status).not.toBe(308);
    expect(res.headers.get("location")).toBeNull();
  });
});
