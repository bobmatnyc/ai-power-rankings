import { NextRequest } from "next/server";
import type { ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { locales } from "../../i18n/config";
import { UNMATCHED_PATH, localeNotFoundRewrite } from "../../lib/locale-not-found-rewrite";
import type { NewsArticleDetail } from "../../lib/news-article";

/**
 * #443: news article pages said `<html lang="en">` and an en-US date on every locale.
 *
 * Why: `/fr/news/<slug>` rendered under the single `app/layout.tsx`, which had
 * no `[lang]` param and hard-coded `lang="en"`; the Article template formatted
 * its publication date with a fixed `en-US`.
 * What: renders the real `[lang]` root layout around the real news article
 * page (Article template on, `loadNewsArticle` stubbed) for every locale and
 * checks `<html lang>` and the `<time>` text. The publication instant is
 * 23:30 UTC and the process zone is Asia/Tokyo, where it is already the next
 * day, so the date must still be the UTC day (#239). The non-locale roots
 * (`/`, `/design`, the global 404) still render `lang="en"`, and the
 * middleware sends a first segment that is not a locale to the global 404,
 * since the `[lang]` root layout's `notFound()` has no boundary above it.
 * Test: `npx vitest run tests/unit/html-lang-dates-443.test.tsx`. No database, no network.
 */

const loadNewsArticle = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("../../lib/news-article", () => ({ loadNewsArticle }));
vi.mock("../../components/news/news-detail-content", () => ({ default: () => null }));
vi.mock("../../components/layout/client-layout", () => ({
  ClientLayout: ({ children }: { children: ReactNode }) => <div data-client-layout>{children}</div>,
}));
vi.mock("../../components/analytics/GoogleAnalytics", () => ({ GoogleAnalytics: () => null }));
vi.mock("../../components/analytics/deferred-analytics", () => ({ DeferredAnalytics: () => null }));
vi.mock("@vercel/speed-insights/next", () => ({ SpeedInsights: () => null }));

const DETAIL: NewsArticleDetail = {
  article: {
    id: "a1",
    slug: "claude-code-secrets",
    title: "Claude Code is exposing secrets",
    content: "Body text.",
    summary: "A summary.",
    // #239: 23:30 UTC is already the next day in Tokyo; the page must print the UTC day.
    published_date: "2026-09-01T23:30:00.000Z",
    source: "The Verge",
    source_url: "https://verge.example/a",
    tags: [],
    tool_mentions: [],
    created_at: "2026-09-01T23:30:00.000Z",
    updated_at: "2026-09-01T23:30:00.000Z",
  },
  tool: null,
  tools: [],
};

/** The 2026-09-01 publication date as each locale's `long` date reads (Intl, UTC). */
const EXPECTED_DATE: Record<(typeof locales)[number], string> = {
  en: "September 1, 2026",
  de: "1. September 2026",
  fr: "1 septembre 2026",
  it: "1 settembre 2026",
  ja: "2026年9月1日",
  ko: "2026년 9월 1일",
  uk: "1 вересня 2026 р.",
  hr: "1. rujna 2026.",
  zh: "2026年9月1日",
  es: "1 de septiembre de 2026",
};

// The first import of the layout and page pulls in their whole tree; a cold import can outlast the 5 s default.
vi.setConfig({ testTimeout: 60_000 });

const originalTz = process.env.TZ;

beforeEach(() => {
  process.env.TZ = "Asia/Tokyo";
  vi.stubEnv("INSIGHTS_ARTICLE_TEMPLATE", "true");
  loadNewsArticle.mockReset().mockResolvedValue(DETAIL);
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

/** `/{lang}/news/{slug}` as Next.js composes it: the `[lang]` root layout around the article page. */
async function renderNewsArticleRoute(lang: string): Promise<string> {
  const { default: LanguageLayout } = await import("../../app/[lang]/layout");
  const { default: NewsArticlePage } = await import("../../app/[lang]/news/[slug]/page");
  const page = await NewsArticlePage({ params: Promise.resolve({ lang, slug: DETAIL.article.slug }) });
  const tree = await LanguageLayout({ children: page, params: Promise.resolve({ lang }) });
  return renderToStaticMarkup(tree as ReactElement);
}

describe("news article route: <html lang> and publication date per locale (#443)", () => {
  it.each([...locales])("%s: <html lang> is the route locale", async (lang) => {
    const html = await renderNewsArticleRoute(lang);
    expect(html.match(/<html[^>]*>/)?.[0]).toBe(`<html lang="${lang}">`);
  });

  it.each([...locales])("%s: the publication date is in the route locale, on the UTC day", async (lang) => {
    const html = await renderNewsArticleRoute(lang);
    expect(html).toContain(`<time dateTime="2026-09-01T23:30:00.000Z">${EXPECTED_DATE[lang]}</time>`);
  });
});

describe("routes outside [lang] keep <html lang=\"en\"> (#443)", () => {
  it("/ (the redirect root), /design and the global 404", async () => {
    const roots: Array<[string, () => Promise<ReactNode>]> = [
      ["(root)", async () => (await import("../../app/(root)/layout")).default({ children: <p /> })],
      ["design", async () => (await import("../../app/design/layout")).default({ children: <p /> })],
      ["global-not-found", async () => (await import("../../app/global-not-found")).default()],
    ];
    for (const [name, render] of roots) {
      const html = renderToStaticMarkup((await render()) as ReactElement);
      expect(html.match(/<html[^>]*>/)?.[0], name).toBe('<html lang="en">');
    }
  });
});

describe("localeNotFoundRewrite: a first segment that is not a locale gets the site 404 (#443)", () => {
  const rewriteOf = (path: string) =>
    localeNotFoundRewrite(new NextRequest(`http://localhost${path}`))?.headers.get("x-middleware-rewrite") ?? null;

  it.each(["/pricing", "/pricing/x", "/foo", "/EN", "/EN/news", "/xx/rankings"])("%s rewrites to the unmatched path", (path) => {
    expect(rewriteOf(path)).toBe(`http://localhost${UNMATCHED_PATH}`);
  });

  it.each([
    "/",
    ...locales.map((l) => `/${l}/news/some-article`),
    "/api/health",
    "/trpc/x",
    "/design",
    "/sign-in",
    "/sign-up/sso-callback",
    "/data/rankings",
    "/robots.txt",
    "/sitemap.xml",
    "/openapi.json",
    "/news_sitemap.xml/rankings",
    "/_vercel/speed-insights/vitals",
    "/__nextjs_original-stack-frame",
  ])("%s passes through", (path) => {
    expect(rewriteOf(path)).toBeNull();
  });
});
