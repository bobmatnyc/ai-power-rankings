import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #193 slice 2: the tool page's server-rendered profile block.
 *
 * Why: the tool page body renders in the browser, so its server HTML had no
 * tool content. The profile block adds four fixed sections on the server:
 * Verdict, Score and rank, Change since last month, Alternatives.
 * What: runs the real tool page with `ToolsRepository`, `RankingsRepository`
 * and `unstable_cache` replaced by in-memory fakes, and renders it to static
 * HTML as the server does. Covers section order, the verdict fallback chain,
 * no-history / new-tool text, the algorithm-version rule for the score delta,
 * alternatives (self and non-active excluded, cap 3, score order, empty text),
 * a non-active tool, a failed ranking read, and that the ranking read is
 * cached across requests. `pickVerdict()` and `buildToolProfile()` are also
 * tested directly. React `cache()` is replaced as in tool-not-found-193.test.tsx:
 * one test is one request unless a test resets the memo itself.
 * #185: a tool's rank comes from its own list's board. The catalogue rows now carry
 * `kind` (harness, the list every fixture board belongs to); the "#185" tests cover a
 * model tool (model board), a tool in no list (no read, unranked) and that the
 * combined board is never read.
 * Test: `npx vitest run tests/unit/tool-profile-193.test.tsx`. No database, no network.
 */

interface CatalogueRow {
  id: string;
  slug: string;
  name: string;
  category: string;
  status: string;
  info: Record<string, unknown>;
  /** #185: `tools.kind`, which picks the list board the page reads. */
  kind: string;
}

interface SnapshotRow {
  period: string;
  algorithm_version: string;
  data: { rankings: Array<Record<string, unknown>> };
}

function tool(
  slug: string,
  name: string,
  category = "code-editor",
  status = "active",
  info?: Record<string, unknown>,
  kind = "harness"
) {
  return {
    id: `tool-${slug}`,
    slug,
    name,
    category,
    status,
    info: info ?? { product: { tagline: `${name} tagline` } },
    kind,
  } satisfies CatalogueRow;
}

const CATALOGUE: CatalogueRow[] = [
  tool("cursor", "Cursor"),
  tool("windsurf", "Windsurf"),
  tool("cline", "Cline"),
  tool("zed", "Zed"),
  tool("void-editor", "Void Editor"),
  tool("fresh-tool", "Fresh Tool"),
  tool("trae", "Trae", "code-editor", "inactive"),
  tool("stealth-editor", "Stealth Editor", "code-editor", "pending_review"),
  tool("lonely-agent", "Lonely Agent", "autonomous-agent"),
  tool("blank-tool", "Blank Tool", "autonomous-agent", "active", {}),
  // #185: a model (its own list) and a tool in no list.
  tool("some-model", "Some Model", "llm", "active", undefined, "model"),
  tool("other-thing", "Other Thing", "code-editor", "active", undefined, "other"),
];

const entry = (slug: string, rank: number, score: number) => ({
  tool_id: `tool-${slug}`,
  tool_slug: slug,
  tool_name: CATALOGUE.find((t) => t.slug === slug)?.name ?? slug,
  rank,
  score,
  category: CATALOGUE.find((t) => t.slug === slug)?.category ?? "code-editor",
  status: "active",
});

const CURRENT: SnapshotRow = {
  period: "2026-10",
  algorithm_version: "v7.9",
  data: {
    rankings: [
      entry("windsurf", 1, 90),
      entry("cline", 2, 85),
      entry("cursor", 3, 80),
      entry("trae", 4, 79),
      entry("zed", 5, 70),
      entry("fresh-tool", 6, 60),
      entry("lonely-agent", 7, 50),
      entry("void-editor", 8, 40),
    ],
  },
};

const PREVIOUS: SnapshotRow = {
  period: "2026-09",
  algorithm_version: "v7.9",
  data: {
    rankings: [
      entry("windsurf", 1, 88),
      entry("cline", 2, 84),
      entry("trae", 3, 81),
      entry("zed", 4, 77),
      entry("cursor", 5, 75.5),
      entry("lonely-agent", 6, 52),
      entry("void-editor", 7, 41),
    ],
  },
};

const db = vi.hoisted(() => ({
  catalogue: [] as Array<{ slug: string; status: string }>,
  current: null as unknown,
  previous: null as unknown,
  rankingError: null as Error | null,
  rankingReads: 0,
  /** #185: the list argument of every ranking read. */
  listsRead: [] as unknown[],
  /** #185: the model list's current board, when a test sets one. */
  modelCurrent: null as unknown,
}));

vi.mock("server-only", () => ({}));

vi.mock("../../lib/db/repositories/tools.repository", () => {
  class ToolsRepository {
    findBySlug = async (slug: string) => db.catalogue.find((r) => r.slug === slug) ?? null;
    findByStatus = async (status: string) => db.catalogue.filter((r) => r.status === status);
    findAll = async () => db.catalogue;
  }
  return { ToolsRepository, toolsRepository: new ToolsRepository() };
});

// #193 slice 3: the related-news scan, empty here so no test reaches a database.
vi.mock("../../lib/db/repositories/news", () => ({
  NewsRepository: class {
    getToolNewsRows = async () => [];
  },
}));

vi.mock("../../lib/db/repositories/rankings.repository", () => {
  const repo = {
    getCurrentRankings: async (list?: unknown) => {
      db.rankingReads++;
      db.listsRead.push(list);
      if (db.rankingError) throw db.rankingError;
      if (list === "model") return db.modelCurrent ? { ...(db.modelCurrent as object), is_current: true } : null;
      return db.current ? { ...(db.current as object), is_current: true } : null;
    },
    getLatestBefore: async (period: string, list?: unknown) => {
      db.listsRead.push(list);
      if (list === "model") return null;
      const previous = db.previous as { period: string } | null;
      return previous && previous.period < period ? previous : null;
    },
  };
  return { rankingsRepository: repo, RankingsRepository: class {} };
});

// A server-wide data cache: keyed by keyParts, kept across requests, never caching a rejection.
const dataCache = vi.hoisted(() => ({
  entries: new Map<string, unknown>(),
  options: [] as Array<{ revalidate?: number | false; tags?: string[] }>,
}));
vi.mock("next/cache", () => ({
  unstable_cache:
    <R,>(fn: () => Promise<R>, keyParts: string[], options: { revalidate?: number | false; tags?: string[] }) => {
      dataCache.options.push(options);
      return async (): Promise<R> => {
        const key = JSON.stringify(keyParts);
        if (!dataCache.entries.has(key)) dataCache.entries.set(key, await fn());
        return dataCache.entries.get(key) as R;
      };
    },
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
  db.current = CURRENT;
  db.previous = PREVIOUS;
  db.rankingError = null;
  db.rankingReads = 0;
  db.listsRead = [];
  db.modelCurrent = null;
  dataCache.entries = new Map();
  request.memo = new Map();
  vi.spyOn(console, "error").mockImplementation(() => {});
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

/** The profile block's `<section>` bodies keyed by heading, in document order. */
function sections(html: string): Array<{ heading: string; body: string }> {
  return [...html.matchAll(/<section[^>]*data-profile-section="([^"]+)"[^>]*>([\s\S]*?)<\/section>/g)].map((m) => ({
    heading: m[1]!,
    body: m[2]!,
  }));
}
const section = (html: string, heading: string) => sections(html).find((s) => s.heading === heading)?.body ?? "";
const alternatives = (html: string) => [...html.matchAll(/data-profile-alternative="([^"]+)"/g)].map((m) => m[1]);
const headings = (html: string) =>
  [...html.matchAll(/<section[^>]*data-profile-section[^>]*>\s*<h2[^>]*>([^<]+)<\/h2>/g)].map((m) => m[1]);

// #193 slice 3 appends "Related news"; tests/unit/tool-news-193.test.tsx covers its content.
const ORDER = ["Verdict", "Score and rank", "Change since last month", "Alternatives", "Related news"];

describe("tool profile block on the server-rendered page (#193)", () => {
  it("renders the five headings in fixed order with the verdict in the server HTML", async () => {
    const html = await renderPage("cursor");
    expect(headings(html)).toEqual(ORDER);
    expect(section(html, "Verdict")).toContain("Cursor tagline");
    expect(section(html, "Score and rank")).toContain("#3");
    expect(section(html, "Score and rank")).toContain("80.0");
  });

  it.each(["de", "ja"])("renders the same English sections in /%s", async (lang) => {
    const html = await renderPage("cursor", lang);
    expect(headings(html)).toEqual(ORDER);
    expect(alternatives(html).length).toBe(3);
    expect(html).toContain(`href="/${lang}/tools/windsurf"`);
  });

  it("within one algorithm version shows the rank delta and the score delta", async () => {
    const change = section(await renderPage("cursor"), "Change since last month");
    expect(change).toContain('data-profile-rank-delta="2"');
    expect(change).toContain("Up 2 places");
    expect(change).toContain('data-profile-score-delta="4.5"');
    expect(change).toContain("+4.5");
  });

  it("across algorithm versions shows the rank delta and hides the score delta", async () => {
    db.previous = { ...PREVIOUS, algorithm_version: "v7.10-draft" };
    db.current = { ...CURRENT, algorithm_version: "v7.10" };
    const change = section(await renderPage("cursor"), "Change since last month");
    expect(change).toContain('data-profile-rank-delta="2"');
    expect(change).not.toContain("data-profile-score-delta");
    expect(change).toContain("Score change not shown");
  });

  it("a tool absent from the previous period shows explicit new-tool text and no delta", async () => {
    const html = await renderPage("fresh-tool");
    const change = section(html, "Change since last month");
    expect(headings(html)).toEqual(ORDER);
    expect(change).toContain("New this month");
    expect(change).not.toMatch(/data-profile-(rank|score)-delta/);
  });

  it("a single ranking period shows explicit no-history text and no delta", async () => {
    db.previous = null;
    const html = await renderPage("cursor");
    const change = section(html, "Change since last month");
    expect(headings(html)).toEqual(ORDER);
    expect(change).toContain("No earlier ranking period");
    expect(change).not.toMatch(/data-profile-(rank|score)-delta/);
  });

  it("alternatives exclude self and non-active tools, are capped at 3 and ordered by score", async () => {
    // Peers by score: windsurf 90, cline 85, trae 79 (inactive), zed 70, fresh-tool 60, void-editor 40.
    expect(alternatives(await renderPage("cursor"))).toEqual(["windsurf", "cline", "zed"]);
  });

  it("a tool with no same-category peers shows explicit empty text in alternatives", async () => {
    const html = await renderPage("lonely-agent");
    expect(headings(html)).toEqual(ORDER);
    expect(alternatives(html)).toEqual([]);
    expect(section(html, "Alternatives")).toContain("No other active tools in this category");
  });

  it("a non-active tool page still renders and still shows alternatives", async () => {
    const html = await renderPage("stealth-editor");
    expect(headings(html)).toEqual(ORDER);
    expect(alternatives(html)).toEqual(["windsurf", "cline", "cursor"]);
    expect(section(html, "Score and rank")).toContain("not in the current rankings");
  });

  it("a tool with no tagline, description or summary shows the verdict fallback", async () => {
    const html = await renderPage("blank-tool");
    expect(headings(html)).toEqual(ORDER);
    expect(section(html, "Verdict")).toContain("Blank Tool has no published description yet");
  });

  it("a failed ranking read renders fallback text, not a 5xx", async () => {
    db.rankingError = new Error("fixture: rankings down");
    const html = await renderPage("cursor");
    expect(headings(html)).toEqual(ORDER);
    expect(section(html, "Verdict")).toContain("Cursor tagline");
    expect(section(html, "Change since last month")).toContain("Ranking data is unavailable");
  });

  it("an unknown slug still throws Next.js's 404", async () => {
    await expect(renderPage("no-such-tool-xyz")).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
  });

  it("caches the ranking read across requests for the page's ISR window", async () => {
    await renderPage("cursor");
    request.memo = new Map(); // a second request
    await renderPage("windsurf");
    expect(db.rankingReads).toBe(1);
    expect(dataCache.options).toContainEqual(expect.objectContaining({ revalidate: 1800 }));
    expect(dataCache.options).toContainEqual(expect.objectContaining({ tags: ["rankings", "tools"] }));
  });
});

describe("tool profile reads the tool's own list (#185)", () => {
  it("a harness tool reads only the harness board, never the combined board", async () => {
    await renderPage("cursor");
    expect(db.listsRead.length).toBeGreaterThan(0);
    expect(new Set(db.listsRead)).toEqual(new Set(["harness"]));
  });

  it("a model tool's rank comes from the model board", async () => {
    db.modelCurrent = { period: "2026-10", algorithm_version: "8.0", data: { rankings: [entry("some-model", 1, 77)] } };
    const html = await renderPage("some-model");
    expect(section(html, "Score and rank")).toContain("#1");
    expect(section(html, "Score and rank")).toContain("77.0");
    expect(new Set(db.listsRead)).toEqual(new Set(["model"]));
  });

  it("a tool in no list is unranked and makes no ranking read", async () => {
    const html = await renderPage("other-thing");
    expect(headings(html)).toEqual(ORDER);
    expect(section(html, "Score and rank")).toContain("not in the current rankings");
    expect(db.rankingReads).toBe(0);
  });

  it("a failed list read shows the unavailable text and reads no other board", async () => {
    db.rankingError = new Error("fixture: harness board down");
    const html = await renderPage("cursor");
    expect(section(html, "Change since last month")).toContain("Ranking data is unavailable");
    expect(db.listsRead).toEqual(["harness"]);
  });
});

describe("pickVerdict and buildToolProfile (#193)", () => {
  it.each([
    [{ product: { tagline: "T", description: "D" }, summary: "S" }, "T"],
    [{ product: { tagline: "  ", description: "D" }, summary: "S" }, "D"],
    [{ product: { tagline: "", description: "" }, summary: "S" }, "S"],
    [{ product: { tagline: 42 }, summary: "" }, null],
    [undefined, null],
  ])("pickVerdict(%j) is %j", async (info, expected) => {
    const { pickVerdict } = await import("../../lib/tools/tool-profile");
    expect(pickVerdict(info)).toBe(expected);
  });

  it("orders tied scores by rank, then slug", async () => {
    const { buildToolProfile } = await import("../../lib/tools/tool-profile");
    const profile = buildToolProfile(
      { id: "x", slug: "x", name: "X", category: "c" },
      {
        current: {
          period: "2026-10",
          algorithmVersion: "v7.9",
          entries: [
            { tool_slug: "b", rank: 4, score: 50 },
            { tool_slug: "a", rank: 4, score: 50 },
            { tool_slug: "c", rank: 2, score: 50 },
            { tool_slug: "d", rank: 1, score: 60 },
          ],
        },
        previous: null,
        activeTools: ["a", "b", "c", "d"].map((slug) => ({ slug, name: slug.toUpperCase(), category: "c" })),
      }
    );
    expect(profile.alternatives?.map((a) => a.slug)).toEqual(["d", "c", "a"]);
  });

  it("a rank drop is a negative delta", async () => {
    const { buildToolProfile } = await import("../../lib/tools/tool-profile");
    const snapshot = (rank: number, score: number, period: string) => ({
      period,
      algorithmVersion: "v7.9",
      entries: [{ tool_slug: "x", rank, score }],
    });
    const profile = buildToolProfile(
      { id: "x", slug: "x", name: "X", category: "c" },
      { current: snapshot(5, 70.1, "2026-10"), previous: snapshot(3, 70.3, "2026-09"), activeTools: [] }
    );
    expect(profile.change).toMatchObject({ kind: "moved", rankDelta: -2, scoreDelta: -0.2 });
  });
});
