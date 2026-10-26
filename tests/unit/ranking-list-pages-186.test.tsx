import { isValidElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { locales } from "../../i18n/config";

/**
 * #186: the per-list ranking pages and their SEO.
 *
 * Why: each list has its own page in every locale, with a self-referencing canonical
 *   and full hreflang; the harness board is `/rankings` (D51), so
 *   `/rankings/coding-harnesses` canonicalises there; a list below 10 entries is
 *   noindex (D53) and left out of the sitemap; the productivity page carries the
 *   provisional-weights note (D54).
 * What: stubs `fetch` with an `/api/rankings` response per list (entry count and
 *   `list_meta` chosen per test), calls the real `generateMetadata` and page
 *   components of `app/[lang]/rankings/[list]/page.tsx` and `app/[lang]/rankings/page.tsx`,
 *   and walks the returned element tree for the notes and the list navigation.
 *   The sitemap is built from a stubbed tool catalogue with 9 and with 10 models.
 * Test: `npx vitest run tests/unit/ranking-list-pages-186.test.tsx`. No network.
 */

const ORIGIN = "https://aipowerranking.com";
const PREVIEW_HOST = "ai-power-ranking-xyz-1-m.vercel.app";

const NOT_FOUND = new Error("NEXT_NOT_FOUND");
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw NOT_FOUND;
  },
  useRouter: () => ({ push: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));

const { findAll } = vi.hoisted(() => ({ findAll: vi.fn() }));
vi.mock("../../lib/services/whats-new-summary.service", () => ({ listPeriods: async () => [] }));
vi.mock("../../lib/db/repositories/news", () => ({ newsRepository: { getPublishedSlugs: async () => [] } }));
vi.mock("../../lib/db/repositories/tools.repository", () => {
  class ToolsRepository {
    findAll = findAll;
  }
  return { ToolsRepository, toolsRepository: new ToolsRepository() };
});

/** `/api/rankings` entry count per list, as the stubbed API reports it. */
const counts: Record<string, number> = {};

const fetchMock = vi.fn(async (input: string | URL | Request) => {
  const url = new URL(String(input instanceof Request ? input.url : input));
  const list = url.searchParams.get("list") ?? "harness";
  const n = counts[list] ?? 0;
  const rankings = Array.from({ length: n }, (_, i) => ({ rank: i + 1, tool: { id: `t${i}`, name: `Tool ${i}` } }));
  return Response.json({
    rankings,
    list,
    list_meta: { list, entry_count: n, indexable: n >= 10, tier_scheme: n >= 10 ? "standard" : "thirds" },
  });
});

const params = (p: Record<string, string>) => ({ params: Promise.resolve(p) }) as never;

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_BASE_URL", undefined);
  vi.stubEnv("NEXTAUTH_URL", undefined);
  vi.stubEnv("VERCEL_BRANCH_URL", undefined);
  vi.stubEnv("VERCEL_URL", PREVIEW_HOST);
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockClear();
  Object.assign(counts, { harness: 40, model: 12, productivity: 0 });
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

vi.setConfig({ testTimeout: 60_000 });

type Meta = { alternates?: { canonical?: string; languages?: Record<string, string> }; robots?: unknown; openGraph?: { url?: unknown } };

async function listMetadata(lang: string, list: string): Promise<Meta> {
  const mod = await import("../../app/[lang]/rankings/[list]/page");
  return (await mod.generateMetadata(params({ lang, list }))) as Meta;
}

/** Every element in a rendered server tree whose props match `test`. */
function findAll_(node: ReactNode, test: (props: Record<string, any>) => boolean, out: Record<string, any>[] = []) {
  if (Array.isArray(node)) {
    for (const child of node) findAll_(child, test, out);
    return out;
  }
  if (!isValidElement(node)) return out;
  const props = node.props as Record<string, any>;
  if (test(props)) out.push(props);
  findAll_(props.children, test, out);
  return out;
}

describe("list page metadata (#186)", () => {
  it.each([
    ["models", "/rankings/models"],
    ["productivity-tools", "/rankings/productivity-tools"],
  ])("/%s has a self canonical and hreflang for every locale", async (slug, path) => {
    const metadata = await listMetadata("ja", slug);
    expect(metadata.alternates?.canonical).toBe(`${ORIGIN}/ja${path}`);
    expect(String(metadata.openGraph?.url)).toBe(`${ORIGIN}/ja${path}`);
    const languages = metadata.alternates?.languages ?? {};
    expect(Object.keys(languages).sort()).toEqual([...locales, "x-default"].sort());
    for (const locale of locales) expect(languages[locale]).toBe(`${ORIGIN}/${locale}${path}`);
    expect(languages["x-default"]).toBe(`${ORIGIN}/en${path}`);
  });

  it("D51: /rankings/coding-harnesses shows the harness board and canonicalises to /rankings", async () => {
    const metadata = await listMetadata("de", "coding-harnesses");
    expect(metadata.alternates?.canonical).toBe(`${ORIGIN}/de/rankings`);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(`https://${PREVIEW_HOST}/api/rankings`);
  });

  it("asks /api/rankings for the page's list", async () => {
    await listMetadata("en", "models");
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(`https://${PREVIEW_HOST}/api/rankings?list=model`);
  });

  it("D53: a list of exactly 9 entries is noindex; exactly 10 is indexed", async () => {
    counts["productivity"] = 9;
    expect((await listMetadata("en", "productivity-tools")).robots).toEqual({ index: false, follow: true });
    counts["productivity"] = 10;
    expect((await listMetadata("en", "productivity-tools")).robots).toBeUndefined();
  });

  it("D53 also applies to the default list on /rankings", async () => {
    counts["harness"] = 9;
    const mod = await import("../../app/[lang]/rankings/page");
    const metadata = (await mod.generateMetadata(params({ lang: "en" }))) as Meta;
    expect(metadata.robots).toEqual({ index: false, follow: true });
  });

  // #186 review: an unknown list size fails closed, so a thin list never renders indexable.
  describe("an unknown list size is noindex", () => {
    const NOINDEX = { index: false, follow: true };
    const arms: Array<[string, () => void]> = [
      ["a non-OK response", () => fetchMock.mockImplementationOnce(async () => new Response("down", { status: 503 }))],
      [
        "a thrown read",
        () =>
          fetchMock.mockImplementationOnce(async () => {
            throw new TypeError("fetch failed");
          }),
      ],
    ];

    it.each(arms)("on /rankings/models after %s", async (_label, arrange) => {
      counts["model"] = 3;
      arrange();
      expect((await listMetadata("en", "models")).robots).toEqual(NOINDEX);
    });

    it.each(arms)("on the default /rankings board after %s", async (_label, arrange) => {
      arrange();
      const mod = await import("../../app/[lang]/rankings/page");
      const metadata = (await mod.generateMetadata(params({ lang: "en" }))) as Meta;
      expect(metadata.robots).toEqual(NOINDEX);
    });
  });

  it("an unknown slug is a 404", async () => {
    await expect(listMetadata("en", "combined")).rejects.toBe(NOT_FOUND);
    const mod = await import("../../app/[lang]/rankings/[list]/page");
    await expect(mod.default(params({ lang: "en", list: "image-models" }))).rejects.toBe(NOT_FOUND);
  });
});

describe("list page body (#186)", () => {
  async function render(slug: string, lang = "en") {
    const mod = await import("../../app/[lang]/rankings/[list]/page");
    return mod.default(params({ lang, list: slug }));
  }
  const notes = (tree: ReactNode, kind: string) => findAll_(tree, (p) => p["data-note"] === kind);

  it("D54: the productivity page shows the provisional-weights note; models and harnesses do not", async () => {
    const productivity = notes(await render("productivity-tools"), "provisional-weights");
    expect(productivity).toHaveLength(1);
    expect(String(productivity[0]!.children)).toMatch(/Provisional/);
    expect(notes(await render("models"), "provisional-weights")).toHaveLength(0);
    expect(notes(await render("coding-harnesses"), "provisional-weights")).toHaveLength(0);
  });

  it("D54 note is translated in other locales", async () => {
    const [note] = notes(await render("productivity-tools", "de"), "provisional-weights");
    expect(String(note!.children)).toMatch(/^Vorläufig/);
  });

  it("D53: the short-list note appears for 9 entries and not for 10", async () => {
    counts["model"] = 9;
    expect(notes(await render("models"), "short-list")).toHaveLength(1);
    counts["model"] = 10;
    expect(notes(await render("models"), "short-list")).toHaveLength(0);
  });

  it("links all three lists in the page's locale and passes its list to the grid", async () => {
    const tree = await render("models", "fr");
    const links = findAll_(tree, (p) => typeof p["href"] === "string" && p["href"].startsWith("/fr/rankings"));
    expect(links.map((l) => l["href"])).toEqual(["/fr/rankings", "/fr/rankings/models", "/fr/rankings/productivity-tools"]);
    expect(links.find((l) => l["aria-current"] === "page")?.["href"]).toBe("/fr/rankings/models");
    const [grid] = findAll_(tree, (p) => "initialRankings" in p && "list" in p);
    expect(grid?.["list"]).toBe("model");
    expect(grid?.["initialRankings"]).toHaveLength(12);
  });
});

describe("sitemap list pages (#186, D53)", () => {
  const model = (i: number, modality?: string) => ({
    id: `m${i}`,
    slug: `model-${i}`,
    status: "active",
    kind: "productivity",
    ...(modality ? { modality } : {}),
    updated_at: "2026-01-02T00:00:00.000Z",
  });

  async function paths(tools: unknown[]): Promise<string[]> {
    findAll.mockResolvedValue(tools);
    const { buildSitemapEntries } = await import("../../lib/sitemap");
    return (await buildSitemapEntries(ORIGIN)).map((e) => new URL(e.url).pathname);
  }

  it("lists /rankings/productivity-tools in every locale with 10 active tools, and not with 9", async () => {
    const nine = await paths(Array.from({ length: 9 }, (_, i) => model(i)));
    expect(nine.filter((p) => p.endsWith("/rankings/productivity-tools"))).toEqual([]);

    const ten = await paths(Array.from({ length: 10 }, (_, i) => model(i)));
    expect(ten.filter((p) => p.endsWith("/rankings/productivity-tools")).sort()).toEqual(
      locales.map((l) => `/${l}/rankings/productivity-tools`).sort()
    );
  });

  it("never lists /rankings/coding-harnesses (its canonical is /rankings) or an empty list", async () => {
    const all = await paths([{ id: "h", slug: "h", status: "active", kind: "harness", updated_at: "2026-01-02" }]);
    expect(all.some((p) => p.includes("/rankings/coding-harnesses"))).toBe(false);
    expect(all.some((p) => p.includes("/rankings/productivity-tools"))).toBe(false);
    expect(all).toContain("/en/rankings");
  });
});
