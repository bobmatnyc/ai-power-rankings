import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The two #198 launch flags: `INSIGHTS_PREVIEW` and `INSIGHTS_ARTICLE_TEMPLATE`.
 *
 * Why: #198: the launch is the `INSIGHTS_PREVIEW` flip, so the flag must lift
 * the Insights noindex (#384: "the flag flip must remove it"). The critic note
 * on #421 asks that the news Article template, which rewrites every indexed
 * `/news/<slug>` page, launch on its own flag. With both flags off nothing may
 * change.
 * What: for each of the four flag states, runs the real Insights metadata
 * helper and hub `generateMetadata`, the weekly RSS route, the news article
 * page, the nav props and the sitemap builder, with every database read
 * replaced by in-memory fixtures.
 * Test: `npx vitest run tests/unit/insights-launch-flags-198.test.ts`. No database, no network.
 */

const ORIGIN = "https://aipowerranking.com";
const NOW = new Date("2026-11-05T12:00:00.000Z");
const NOT_FOUND = { message: "NEXT_NOT_FOUND" };
const NOINDEX = { index: false, follow: false, googleBot: { index: false, follow: false } };

const weekly = vi.hoisted(() => ({ getStoredDigest: vi.fn(), listDigests: vi.fn(), listDigestWeeks: vi.fn() }));
const monthly = vi.hoisted(() => ({ getStoredSummary: vi.fn(), listPeriods: vi.fn() }));
const loadNewsArticle = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("../../lib/services/weekly-digest.repository", () => weekly);
vi.mock("../../lib/services/whats-new-summary.service", () => monthly);
vi.mock("../../lib/news-article", () => ({ loadNewsArticle }));
vi.mock("../../lib/db/repositories/news", () => ({
  newsRepository: { getPublishedSlugs: vi.fn(async () => []) },
}));
vi.mock("../../lib/db/repositories/tools.repository", () => ({
  toolsRepository: { findAll: vi.fn(async () => []) },
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => createElement("a", { href }, children),
}));
vi.mock("../../components/news/news-detail-content", () => ({
  default: function NewsDetailContent() {
    return null;
  },
}));

const DETAIL = {
  article: {
    id: "a1",
    slug: "cursor-launch",
    title: "Cursor ships a terminal agent",
    content: "Cursor shipped a terminal agent.",
    summary: "Cursor released a terminal agent.",
    published_date: "2026-09-01T00:00:00.000Z",
    source: "The Verge",
    source_url: "https://verge.example/cursor",
    tags: [],
    tool_mentions: [],
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
  },
  tool: null,
  tools: [],
};

const digest = (week: string) => ({
  id: `id-${week}`,
  week,
  content: "# Title\n\nTwo agents shipped terminal modes.\n",
  createdAt: new Date("2026-11-02T07:31:00.000Z"),
  generatedAt: new Date("2026-11-02T07:31:00.000Z"),
  updatedAt: new Date("2026-11-02T07:31:00.000Z"),
});

/** The first element in a server tree whose props carry `article`. */
function articleElement(node: ReactNode): ReactElement | undefined {
  if (Array.isArray(node)) return node.map(articleElement).find(Boolean);
  if (!isValidElement(node)) return undefined;
  const props = node.props as Record<string, unknown>;
  if ("article" in props) return node;
  return articleElement(props["children"] as ReactNode);
}

type Template = "NewsDetailContent" | "ArticleTemplate";

/** One row of the flag matrix and what every surface must do in it. */
interface FlagState {
  name: string;
  preview: string | undefined;
  template: string | undefined;
  insightsLive: boolean;
  newsTemplate: Template;
}

const STATES: FlagState[] = [
  { name: "both off", preview: undefined, template: undefined, insightsLive: false, newsTemplate: "NewsDetailContent" },
  { name: "PREVIEW on, template off", preview: "true", template: undefined, insightsLive: true, newsTemplate: "NewsDetailContent" },
  { name: "PREVIEW off, template on", preview: undefined, template: "true", insightsLive: false, newsTemplate: "ArticleTemplate" },
  { name: "both on", preview: "true", template: "true", insightsLive: true, newsTemplate: "ArticleTemplate" },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_BASE_URL", undefined);
  weekly.listDigests.mockResolvedValue([digest("2026-W44")]);
  weekly.listDigestWeeks.mockResolvedValue([{ week: "2026-W44", updatedAt: new Date("2026-11-02T07:31:00.000Z") }]);
  monthly.listPeriods.mockResolvedValue([{ period: "2026-10", updatedAt: new Date("2026-11-01T08:05:00.000Z") }]);
  loadNewsArticle.mockResolvedValue(DETAIL);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function setFlags(state: FlagState): void {
  vi.stubEnv("INSIGHTS_PREVIEW", state.preview);
  vi.stubEnv("INSIGHTS_ARTICLE_TEMPLATE", state.template);
}

describe.each(STATES)("#198 launch flags: $name", (state) => {
  it("Insights metadata: noindex while INSIGHTS_PREVIEW is off, indexable when it is on", async () => {
    setFlags(state);
    const { insightsPreviewMetadata } = await import("../../app/[lang]/insights/preview-gate");
    const meta = insightsPreviewMetadata("ko", "/insights/weekly/2026-W44", "t", "d");
    if (state.insightsLive) expect(meta.robots).toBeUndefined();
    else expect(meta.robots).toEqual(NOINDEX);
    expect(meta.alternates?.canonical).toBe(`${ORIGIN}/en/insights/weekly/2026-W44`);
    expect(meta.alternates?.languages).toBeUndefined();
  });

  it("Insights hub: 404 while off; with the flag on, no robots meta and an /en canonical", async () => {
    setFlags(state);
    const hub = await import("../../app/[lang]/insights/page");
    const params = { params: Promise.resolve({ lang: "ja" }) };
    if (!state.insightsLive) {
      await expect(hub.generateMetadata(params)).rejects.toMatchObject(NOT_FOUND);
      return;
    }
    const meta = await hub.generateMetadata(params);
    expect(meta.robots).toBeUndefined();
    expect(meta.alternates?.canonical).toBe(`${ORIGIN}/en/insights`);
  });

  it("weekly RSS: 404 with noindex while off; a 200 feed with no X-Robots-Tag when on", async () => {
    setFlags(state);
    const { GET } = await import("../../app/[lang]/insights/weekly/rss.xml/route");
    const response = await GET(new Request(`${ORIGIN}/en/insights/weekly/rss.xml`), {
      params: Promise.resolve({ lang: "en" }),
    });
    if (state.insightsLive) {
      expect(response.status).toBe(200);
      expect(response.headers.get("X-Robots-Tag")).toBeNull();
    } else {
      expect(response.status).toBe(404);
      expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
      expect(weekly.listDigests).not.toHaveBeenCalled();
    }
  });

  it(`news article page: renders ${state.newsTemplate}`, async () => {
    setFlags(state);
    const page = await import("../../app/[lang]/news/[slug]/page");
    const element = articleElement(await page.default({ params: Promise.resolve({ lang: "fr", slug: "cursor-launch" }) }));
    expect((element?.type as { name?: string }).name).toBe(state.newsTemplate);
  });

  it("nav: the Insights link follows INSIGHTS_PREVIEW only", async () => {
    setFlags(state);
    const { insightsNavProps } = await import("../../app/[lang]/insights/preview-gate");
    expect(insightsNavProps()).toEqual(state.insightsLive ? { insightsNav: true } : {});
  });

  it("sitemap: /en Insights entries only while INSIGHTS_PREVIEW is on", async () => {
    setFlags(state);
    const { buildSitemapEntries } = await import("../../lib/sitemap");
    const urls = (await buildSitemapEntries(ORIGIN, NOW)).map((e) => e.url).filter((u) => u.includes("/insights"));
    expect(urls).toEqual(
      state.insightsLive
        ? [`${ORIGIN}/en/insights`, `${ORIGIN}/en/insights/weekly/2026-W44`, `${ORIGIN}/en/insights/monthly/2026-10`]
        : []
    );
  });
});

describe("insightsArticleTemplateEnabled (#198)", () => {
  it.each([
    [undefined, false],
    ["", false],
    ["false", false],
    ["1", false],
    ["TRUE", false],
    ["true", true],
  ])("INSIGHTS_ARTICLE_TEMPLATE=%j is %s, whatever INSIGHTS_PREVIEW says", async (value, expected) => {
    const gate = (await import("../../app/[lang]/insights/preview-gate")) as Record<string, unknown>;
    const enabled = gate["insightsArticleTemplateEnabled"] as
      | ((env: Record<string, string | undefined>) => boolean)
      | undefined;
    expect(enabled, "insightsArticleTemplateEnabled is exported").toBeTypeOf("function");
    expect(enabled?.({ INSIGHTS_ARTICLE_TEMPLATE: value, INSIGHTS_PREVIEW: "true" })).toBe(expected);
    expect(enabled?.({ INSIGHTS_ARTICLE_TEMPLATE: value })).toBe(expected);
  });
});
