import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { locales } from "../../i18n/config";
import type { NewsArticleDetail } from "../../lib/news-article";

/**
 * #443: the Article template printed an en-US publication date on every locale.
 *
 * Why: the template formatted its date with a fixed `en-US`, so `/fr/news/<slug>`
 * read "September 1, 2026".
 * What: renders the real news article page (Article template on,
 * `loadNewsArticle` stubbed) for every locale and checks the `<time>` text.
 * The publication instant is 23:30 UTC and the process zone is Asia/Tokyo,
 * where it is already the next day, so the date must still be the UTC day
 * (#239). `<html lang>` is not covered: it stays `en` until the layout change
 * parked for #443 ships.
 * Test: `npx vitest run tests/unit/article-dates-443.test.tsx`. No database, no network.
 */

const loadNewsArticle = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("../../lib/news-article", () => ({ loadNewsArticle }));
vi.mock("../../components/news/news-detail-content", () => ({ default: () => null }));

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

// The first import of the page pulls in its whole tree; a cold import can outlast the 5 s default.
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

async function renderNewsArticlePage(lang: string): Promise<string> {
  const { default: NewsArticlePage } = await import("../../app/[lang]/news/[slug]/page");
  const page = await NewsArticlePage({ params: Promise.resolve({ lang, slug: DETAIL.article.slug }) });
  return renderToStaticMarkup(page as ReactElement);
}

describe("news article page: publication date per locale (#443)", () => {
  it.each([...locales])("%s: the publication date is in the route locale, on the UTC day", async (lang) => {
    const html = await renderNewsArticlePage(lang);
    expect(html).toContain(`<time dateTime="2026-09-01T23:30:00.000Z">${EXPECTED_DATE[lang]}</time>`);
  });
});
