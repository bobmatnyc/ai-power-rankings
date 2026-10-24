import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #193 slice 3: the "Related news" section of the tool page's profile block.
 *
 * Why: the tool page listed no news about the tool in its server HTML.
 * What: runs the real tool page with the tools, rankings and news repositories
 * and `unstable_cache` replaced by in-memory fakes, and renders it to static
 * HTML as the server does. Covers the cap of 5 and its order (date, then id),
 * primary-tool-only attribution (a secondary mention never counts), title-only
 * attribution, empty and failure text, a non-active tool, locale links, the
 * unknown-slug 404, that a failed scan is not cached, the cache tags against
 * `invalidateArticleCache()`, and that the scan never selects `content`.
 * Test: `npx vitest run tests/unit/tool-news-193.test.tsx`. No database, no network.
 */

interface CatalogueRow {
  id: string;
  slug: string;
  name: string;
  category: string;
  status: string;
  info: Record<string, unknown>;
}

const tool = (slug: string, name: string, status = "active"): CatalogueRow => ({
  id: `tool-${slug}`,
  slug,
  name,
  category: "code-editor",
  status,
  info: { product: { tagline: `${name} tagline` } },
});

const CATALOGUE: CatalogueRow[] = [
  tool("cursor", "Cursor"),
  tool("windsurf", "Windsurf"),
  tool("void-editor", "Void Editor"),
  tool("trae", "Trae", "inactive"),
  tool("quiet-tool", "Quiet Tool"),
  tool("stealth-editor", "Stealth Editor", "pending_review"),
];

interface NewsRow {
  id: string;
  slug: string;
  title: string;
  sourceName: string | null;
  publishedDate: Date | null;
  createdAt: Date;
  toolMentions: unknown;
}

const mention = (slug: string) => ({ toolId: `tool-${slug}`, name: slug });
const day = (d: number) => new Date(Date.UTC(2026, 9, d, 12));
const article = (id: string, published: Date | null, mentions: unknown[], over: Partial<NewsRow> = {}): NewsRow => ({
  id,
  slug: `story-${id}`,
  title: `Story ${id}`,
  sourceName: "The Wire",
  publishedDate: published,
  createdAt: day(1),
  toolMentions: mentions,
  ...over,
});

// Cursor's primary-tool articles. Newest five, in order: c8 (Oct 20, via
// created_at), c7 and c6 (both Oct 18, so id desc puts c7 first), c5, c4.
const NEWS: NewsRow[] = [
  article("c1", day(2), [mention("cursor")]),
  article("c2", day(3), [mention("cursor")]),
  article("c3", day(4), [mention("cursor")]),
  article("c4", day(10), [mention("cursor")]),
  article("c5", day(12), [mention("cursor")]),
  article("c6", day(18), [mention("cursor")]),
  article("c7", day(18), [mention("cursor")]),
  article("c8", null, [mention("cursor")], { createdAt: day(20) }),
  // Newest of all, but its primary tool is Windsurf: Cursor is a secondary mention.
  article("w1", day(25), [mention("windsurf"), mention("cursor")], { title: "Windsurf and Cursor roundup" }),
  // No mentions: attributed by the multi-word name in its title.
  article("v1", day(5), [], { title: "Void Editor ships 1.0", sourceName: null }),
  article("t1", day(6), [mention("trae")], { title: "Trae pauses new sign-ups" }),
];

const db = vi.hoisted(() => ({
  catalogue: [] as unknown[],
  news: [] as unknown[],
  newsError: null as Error | null,
  newsScans: 0,
  selected: [] as unknown[],
}));

vi.mock("server-only", () => ({}));

vi.mock("../../lib/db/repositories/tools.repository", () => {
  class ToolsRepository {
    findBySlug = async (slug: string) =>
      (db.catalogue as Array<{ slug: string }>).find((r) => r.slug === slug) ?? null;
    findByStatus = async (status: string) =>
      (db.catalogue as Array<{ status: string }>).filter((r) => r.status === status);
    findAll = async () => db.catalogue;
  }
  return { ToolsRepository, toolsRepository: new ToolsRepository() };
});

vi.mock("../../lib/db/repositories/rankings.repository", () => ({
  rankingsRepository: {
    getCurrentRankings: async () => ({
      period: "2026-10",
      algorithm_version: "v7.9",
      is_current: true,
      data: { rankings: [{ tool_id: "tool-cursor", tool_slug: "cursor", tool_name: "Cursor", rank: 1, score: 80 }] },
    }),
    getLatestBefore: async () => null,
  },
  RankingsRepository: class {},
}));

// The real repository class, minus the scan: the page-level tests count and fail it here.
vi.mock("../../lib/db/repositories/news", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/db/repositories/news")>();
  class NewsRepository extends actual.NewsRepository {
    override async getToolNewsRows() {
      db.newsScans++;
      if (db.newsError) throw db.newsError;
      return db.news as never;
    }
  }
  return { ...actual, NewsRepository, RealNewsRepository: actual.NewsRepository };
});

// A query builder that records what `select()` was asked for.
vi.mock("../../lib/db/connection", () => ({
  getDb: () => ({
    select: (columns: unknown) => {
      db.selected.push(columns);
      return { from: () => ({ where: async () => [] }) };
    },
  }),
}));

vi.mock("../../lib/memory-cache", () => ({ invalidateCachePattern: () => 0 }));

// A server-wide data cache: keyed by keyParts, kept across requests, never caching a rejection.
const dataCache = vi.hoisted(() => ({
  entries: new Map<string, unknown>(),
  options: new Map<string, { revalidate?: number | false; tags?: string[] }>(),
  revalidatedTags: [] as string[],
}));
vi.mock("next/cache", () => ({
  unstable_cache:
    <R,>(fn: () => Promise<R>, keyParts: string[], options: { revalidate?: number | false; tags?: string[] }) => {
      const key = JSON.stringify(keyParts);
      dataCache.options.set(key, options);
      return async (): Promise<R> => {
        if (!dataCache.entries.has(key)) dataCache.entries.set(key, await fn());
        return dataCache.entries.get(key) as R;
      };
    },
  revalidateTag: (tag: string) => dataCache.revalidatedTags.push(tag),
  revalidatePath: () => {},
}));

const request = vi.hoisted(() => ({ memo: new Map<unknown, Map<string, unknown>>() }));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  const cache =
    <A extends unknown[], R>(fn: (...args: A) => R) =>
    (...args: A): R => {
      const calls = request.memo.get(fn) ?? new Map<string, unknown>();
      request.memo.set(fn, calls);
      const key = JSON.stringify(args);
      if (!calls.has(key)) calls.set(key, fn(...args));
      return calls.get(key) as R;
    };
  return { ...actual, cache };
});

vi.setConfig({ testTimeout: 60_000 });

beforeEach(() => {
  db.catalogue = CATALOGUE;
  db.news = NEWS;
  db.newsError = null;
  db.newsScans = 0;
  db.selected = [];
  dataCache.entries = new Map();
  dataCache.revalidatedTags = [];
  request.memo = new Map();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

type Params = { lang: string; slug: string };
const params = (lang: string, slug: string) => ({ params: Promise.resolve({ lang, slug } as Params) as never });

async function renderPage(slug: string, lang = "en"): Promise<string> {
  const { default: Page } = (await import("../../app/[lang]/tools/[slug]/page")) as unknown as {
    default: (p: { params: Promise<Params> }) => Promise<ReactElement>;
  };
  return renderToStaticMarkup(await Page(params(lang, slug)));
}

function sectionBodies(html: string): Map<string, string> {
  const found = html.matchAll(/<section[^>]*data-profile-section="([^"]+)"[^>]*>([\s\S]*?)<\/section>/g);
  return new Map([...found].map((m) => [m[1]!, m[2]!]));
}
const newsSection = (html: string) => sectionBodies(html).get("Related news") ?? "";
const newsSlugs = (html: string) => [...newsSection(html).matchAll(/data-profile-news="([^"]+)"/g)].map((m) => m[1]);

const HEADINGS = ["Verdict", "Score and rank", "Change since last month", "Alternatives", "Related news"];
const EMPTY = "No news articles about";
const FAILED = "News is unavailable right now";

describe("related news on the server-rendered tool page (#193)", () => {
  it("shows exactly 5 articles, newest first, equal dates by id descending", async () => {
    const html = await renderPage("cursor");
    expect([...sectionBodies(html).keys()]).toEqual(HEADINGS);
    expect(newsSlugs(html)).toEqual(["story-c8", "story-c7", "story-c6", "story-c5", "story-c4"]);
  });

  it("puts the titles, dates and source in the server HTML, with no summary", async () => {
    const body = newsSection(await renderPage("cursor"));
    for (const id of ["c8", "c7", "c6", "c5", "c4"]) expect(body).toContain(`>Story ${id}</a>`);
    expect(body).toContain('<time dateTime="2026-10-20T12:00:00.000Z">October 20, 2026</time>');
    expect(body).toContain("The Wire");
  });

  it("excludes an article whose primary tool is another tool, even when it mentions this one", async () => {
    const cursor = await renderPage("cursor");
    expect(newsSlugs(cursor)).not.toContain("story-w1");
    expect(cursor).not.toContain("Windsurf and Cursor roundup");
    request.memo = new Map();
    expect(newsSlugs(await renderPage("windsurf"))).toEqual(["story-w1"]);
  });

  it("includes an article attributed by its title alone, with no source shown when there is none", async () => {
    const html = await renderPage("void-editor");
    expect(newsSlugs(html)).toEqual(["story-v1"]);
    expect(newsSection(html)).not.toContain("The Wire");
  });

  it("a tool with no articles shows the empty text, not the failure text", async () => {
    const body = newsSection(await renderPage("quiet-tool"));
    expect(body).toContain(`${EMPTY} Quiet Tool yet.`);
    expect(body).not.toContain(FAILED);
  });

  it("non-active tools still render the section, with their articles or the empty text", async () => {
    expect(newsSlugs(await renderPage("trae"))).toEqual(["story-t1"]);
    request.memo = new Map();
    const pending = await renderPage("stealth-editor");
    expect([...sectionBodies(pending).keys()]).toEqual(HEADINGS);
    expect(newsSection(pending)).toContain(`${EMPTY} Stealth Editor yet.`);
  });

  it.each(["en", "de"])("links each article to /%s/news/<slug>", async (lang) => {
    const body = newsSection(await renderPage("cursor", lang));
    const hrefs = [...body.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs).toEqual(["c8", "c7", "c6", "c5", "c4"].map((id) => `/${lang}/news/story-${id}`));
  });

  it("a failed scan shows the failure text while the other four sections and the page render", async () => {
    db.newsError = new Error("fixture: articles down");
    const html = await renderPage("cursor");
    const bodies = sectionBodies(html);
    expect([...bodies.keys()]).toEqual(HEADINGS);
    expect(bodies.get("Related news")).toContain(FAILED);
    expect(bodies.get("Related news")).not.toContain(EMPTY);
    expect(bodies.get("Verdict")).toContain("Cursor tagline");
    expect(bodies.get("Score and rank")).toContain("#1");
  });

  it("does not cache a failed scan: request 1 fails, request 2 succeeds, two scans", async () => {
    db.newsError = new Error("fixture: articles down");
    expect(newsSection(await renderPage("cursor"))).toContain(FAILED);
    db.newsError = null;
    request.memo = new Map(); // a second request
    expect(newsSlugs(await renderPage("cursor"))).toHaveLength(5);
    expect(db.newsScans).toBe(2);
  });

  it("an unknown slug still throws Next.js's 404", async () => {
    await expect(renderPage("no-such-tool-xyz")).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
  });
});

describe("cached news read (#193)", () => {
  it("scans once for every tool page and locale within the ISR window", async () => {
    await renderPage("cursor");
    request.memo = new Map();
    await renderPage("windsurf", "ja");
    expect(db.newsScans).toBe(1);
    expect(dataCache.options.get(JSON.stringify(["tool-news-by-slug", "v1"]))?.revalidate).toBe(1800);
  });

  it("is tagged with exactly the news tags invalidateArticleCache() clears", async () => {
    const { TOOL_NEWS_CACHE_TAGS } = await import("../../lib/tools/tool-news-data");
    const { CACHE_TAGS, invalidateArticleCache } = await import("../../lib/cache/invalidation.service");
    const cleared = (await invalidateArticleCache()).tagsRevalidated;
    const tags = dataCache.options.get(JSON.stringify(["tool-news-by-slug", "v1"]))?.tags;
    expect(tags).toEqual(TOOL_NEWS_CACHE_TAGS);
    expect(tags).toEqual([CACHE_TAGS.NEWS, CACHE_TAGS.ARTICLES, CACHE_TAGS.TOOLS]);
    for (const tag of tags ?? []) expect(cleared).toContain(tag);
  });

  it("the scan selects only the slim columns, never content", async () => {
    const news = (await import("../../lib/db/repositories/news")) as typeof import("../../lib/db/repositories/news") & {
      RealNewsRepository: typeof import("../../lib/db/repositories/news").NewsRepository;
    };
    await new news.RealNewsRepository().getToolNewsRows();
    expect(db.selected).toHaveLength(1);
    const columns = db.selected[0] as Record<string, { name: string }>;
    expect(Object.keys(columns).sort()).toEqual(
      ["createdAt", "id", "publishedDate", "slug", "sourceName", "title", "toolMentions"].sort()
    );
    expect(Object.values(columns).map((c) => c.name)).not.toContain("content");
    expect(columns).toBe(news.TOOL_NEWS_COLUMNS);
  });
});

describe("groupNewsByPrimaryTool (#193)", () => {
  it("matches the slug /api/news reports as each article's tool_slug", async () => {
    const { buildToolCatalogue, resolveArticleTools } = await import("../../lib/news-tool-resolver");
    const { groupNewsByPrimaryTool } = await import("../../lib/tools/tool-news");
    const catalogue = buildToolCatalogue(CATALOGUE);
    const grouped = groupNewsByPrimaryTool(NEWS, catalogue, 100);
    for (const row of NEWS) {
      // The /api/news route passes the mapped article ({ title, toolMentions, ... }) to the resolver.
      const apiSlug = resolveArticleTools({ ...row, toolMentions: row.toolMentions }, catalogue)[0]?.slug;
      const owner = Object.entries(grouped).find(([, items]) => items.some((i) => i.id === row.id))?.[0];
      expect(owner).toBe(apiSlug);
    }
  });

  it("never treats an inherited key as a slug", async () => {
    const { newsForTool } = await import("../../lib/tools/tool-news");
    expect(newsForTool({}, "constructor")).toEqual([]);
  });
});
