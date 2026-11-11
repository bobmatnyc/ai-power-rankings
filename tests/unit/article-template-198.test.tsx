import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArticleTemplate, type ArticleLabels } from "../../components/news/article-template";
import en from "../../i18n/dictionaries/en.json";
import { locales } from "../../i18n/config";
import type { NewsArticleDetail } from "../../lib/news-article";

/**
 * The Article template of #198 and its flag on the news article page.
 *
 * Why: #198 (proposal M5-7) adds an Article template for news articles. News
 * pages hold most of the site's views, so with `INSIGHTS_PREVIEW` off the
 * article page must render the existing detail view, unchanged.
 * What: renders `ArticleTemplate` to static HTML, and runs the real article
 * page with `loadNewsArticle` and the existing detail view stubbed, once with
 * the flag off and once on.
 * Test: `npx vitest run tests/unit/article-template-198.test.tsx`. No database, no network.
 */

const loadNewsArticle = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("../../lib/news-article", () => ({ loadNewsArticle }));
vi.mock("../../components/news/news-detail-content", () => ({ default: function NewsDetailContent() { return null; } }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const BODY = [
  "Cursor shipped a terminal agent. See [the post](https://cursor.example/blog) and [our page](/en/tools/cursor).",
  "",
  "<script>alert('xss')</script>",
  "",
  "**Related Links:**",
  "- [Old link](https://old.example/a)",
].join("\n");

const DETAIL: NewsArticleDetail = {
  article: {
    id: "a1",
    slug: "cursor-launch",
    title: "Cursor ships a terminal agent",
    content: BODY,
    summary: "Cursor released a terminal agent on Tuesday. It runs tasks from the command line.",
    published_date: "2026-09-01T00:00:00.000Z",
    source: "The Verge",
    source_url: "https://verge.example/cursor",
    tags: ["launch"],
    tool_mentions: ["t-cursor"],
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
  },
  tool: { id: "t-cursor", slug: "cursor", name: "Cursor", kind: "harness", description: "d", category: "code-editor", info: {} },
  tools: [
    { slug: "cursor", name: "Cursor", kind: "harness" },
    { slug: "claude-sonnet", name: "Claude Sonnet", kind: "model" },
  ],
};

const EN_LABELS: ArticleLabels = en.news.article;

const render = (detail: Partial<NewsArticleDetail> = {}, labels: ArticleLabels = EN_LABELS) =>
  renderToStaticMarkup(<ArticleTemplate lang="fr" labels={labels} {...DETAIL} {...detail} />);

/** #198: text as `renderToStaticMarkup` escapes it, so a label with `'` or `&` still matches. */
const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

const withSourceUrl = (source_url: string | null) => ({ article: { ...DETAIL.article, source_url } });

beforeEach(() => {
  vi.clearAllMocks();
  loadNewsArticle.mockResolvedValue(DETAIL);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("ArticleTemplate (#198)", () => {
  it("renders the header: news eyebrow, one h1, UTC date and linked source", () => {
    const html = render();
    expect(html).toContain('data-template="article"');
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toMatch(/<h1[^>]*>Cursor ships a terminal agent<\/h1>/);
    expect(html).toContain('href="/fr/news"');
    expect(html).toContain('<time dateTime="2026-09-01T00:00:00.000Z">September 1, 2026</time>');
    expect(html).toContain('<a href="https://verge.example/cursor" target="_blank" rel="noopener noreferrer"');
  });

  it("shows the summary as a lead and one tag per tool linking its page", () => {
    const html = render();
    expect(html).toMatch(/data-part="summary"[^>]*>Cursor released a terminal agent on Tuesday\./);
    const tagHrefs = [...html.matchAll(/href="(\/fr\/tools\/[^"]+)"/g)].map((m) => m[1]);
    expect(tagHrefs).toEqual(["/fr/tools/cursor", "/fr/tools/claude-sonnet"]);
  });

  it("falls back to the primary tool when the catalogue read failed (tools null)", () => {
    const html = render({ tools: null });
    expect([...html.matchAll(/href="(\/fr\/tools\/[^"]+)"/g)].map((m) => m[1])).toEqual(["/fr/tools/cursor"]);
  });

  it("renders the body without its Related Links block or raw HTML; external links open safely", () => {
    const html = render();
    expect(html).toMatch(/data-part="body"[^>]*><p>Cursor shipped a terminal agent\./);
    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain("Related Links");
    expect(html).toContain('<a href="https://cursor.example/blog" target="_blank" rel="noopener noreferrer">the post</a>');
    expect(html).toContain('<a href="/en/tools/cursor">our page</a>');
  });

  it("lists the referenced links once each and links the original", () => {
    const html = render();
    expect(html).toContain("Referenced links");
    expect(html.match(/href="https:\/\/old\.example\/a"/g)).toHaveLength(1);
    expect(html).toContain("Read the original at The Verge");
  });

  it("omits the summary lead when it repeats the body, and the source link when there is no URL", () => {
    const html = render({ article: { ...DETAIL.article, summary: BODY, source_url: null } });
    expect(html).not.toContain('data-part="summary"');
    expect(html).not.toContain("Read the original");
    expect(html).toContain("<span>The Verge</span>");
  });

  // #198: the source is linked only for an http(s) URL (#421 review).
  it.each([
    "javascript:alert(1)",
    " JavaScript:alert(document.cookie)",
    "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
    "vbscript:msgbox(1)",
    "ftp://verge.example/cursor",
    "/relative/junk",
    "verge.example/cursor",
    "   ",
  ])("source link: %j renders the source as text and no link to it", (url) => {
    const html = render(withSourceUrl(url));
    expect(html).toContain("<span>The Verge</span>");
    expect(html).not.toContain("Read the original");
    expect(html).not.toMatch(/href="(javascript|data|vbscript|ftp):/i);
    expect(html).not.toContain(`href="${escapeHtml(url)}"`);
  });

  it.each(["http://verge.example/cursor", "https://verge.example/cursor"])("source link: %s links the source and the original", (url) => {
    const html = render(withSourceUrl(url));
    expect(html.match(new RegExp(`<a href="${url}" target="_blank" rel="noopener noreferrer"`, "g"))).toHaveLength(2);
    expect(html).toContain(">The Verge</a>");
    expect(html).toContain("Read the original at The Verge");
  });
});

describe("ArticleTemplate labels per locale (#198)", () => {
  // #198: each locale renders its own `news.article` labels, never the English ones (#421 review).
  it.each(locales)("%s: renders the locale's own labels", async (locale) => {
    const dict = (await import(`../../i18n/dictionaries/${locale}.json`)).default as { news: { article: ArticleLabels } };
    const labels = dict.news.article;
    expect(Object.keys(labels).sort(), `${locale} has every label`).toEqual(Object.keys(EN_LABELS).sort());
    if (locale !== "en") {
      for (const key of Object.keys(EN_LABELS) as (keyof ArticleLabels)[]) {
        expect(labels[key], `${locale}.news.article.${key} is translated`).not.toBe(EN_LABELS[key]);
      }
    }
    expect(labels.readOriginal).toContain("{source}");

    const html = render({}, labels);
    expect(html).toContain(`href="/fr/news" class="hover:underline">${escapeHtml(labels.eyebrow)}</a>`);
    expect(html).toContain(`aria-label="${escapeHtml(labels.tools)}"`);
    expect(html).toContain(`>${escapeHtml(labels.referencedLinks)}</h2>`);
    expect(html).toContain(escapeHtml(labels.readOriginal.replace("{source}", "The Verge")));
    expect(render({ article: { ...DETAIL.article, content: "" } }, labels)).toContain(`>${escapeHtml(labels.noContent)}</p>`);
    if (locale !== "en") {
      for (const english of ["News<", "Tools in this article", "Referenced links", "Read the original", "No content available"]) {
        expect(html, `${locale} shows no English "${english}"`).not.toContain(english);
      }
    }
  });
});

/** The first element in a server tree whose props carry `article`. */
function articleElement(node: ReactNode): ReactElement | undefined {
  if (Array.isArray(node)) return node.map(articleElement).find(Boolean);
  if (!isValidElement(node)) return undefined;
  const props = node.props as Record<string, unknown>;
  if ("article" in props) return node;
  return articleElement(props["children"] as ReactNode);
}

describe("the news article page and INSIGHTS_ARTICLE_TEMPLATE (#198)", () => {
  const params = { params: Promise.resolve({ lang: "fr", slug: "cursor-launch" }) };

  it.each([undefined, "", "false", "1", "TRUE"])("INSIGHTS_ARTICLE_TEMPLATE=%j: the existing detail view, same props, even with INSIGHTS_PREVIEW on", async (flag) => {
    // #198: the template has its own flag; INSIGHTS_PREVIEW alone no longer swaps it.
    vi.stubEnv("INSIGHTS_PREVIEW", "true");
    vi.stubEnv("INSIGHTS_ARTICLE_TEMPLATE", flag);
    const page = await import("../../app/[lang]/news/[slug]/page");
    const element = articleElement(await page.default(params));
    expect((element?.type as { name?: string }).name).toBe("NewsDetailContent");
    expect(Object.keys(element?.props ?? {}).sort()).toEqual(["article", "dict", "lang", "tool"]);
    expect(renderToStaticMarkup((await page.default(params)) as ReactElement)).not.toContain('data-template="article"');
  });

  it("INSIGHTS_ARTICLE_TEMPLATE=true: the Article template with the per-kind tool tags", async () => {
    vi.stubEnv("INSIGHTS_ARTICLE_TEMPLATE", "true");
    const page = await import("../../app/[lang]/news/[slug]/page");
    const element = articleElement(await page.default(params));
    expect(element?.type).toBe(ArticleTemplate);
    // #198: the page hands the template its locale's labels (#421 review).
    const fr = (await import("../../i18n/dictionaries/fr.json")).default;
    expect(element?.props).toMatchObject({ lang: "fr", labels: fr.news.article, tools: DETAIL.tools, tool: DETAIL.tool });
  });

  it("keeps the article metadata whatever the flag", async () => {
    const page = await import("../../app/[lang]/news/[slug]/page");
    vi.stubEnv("INSIGHTS_ARTICLE_TEMPLATE", "");
    const off = await page.generateMetadata(params);
    vi.stubEnv("INSIGHTS_ARTICLE_TEMPLATE", "true");
    expect(await page.generateMetadata(params)).toEqual(off);
    expect(off.robots).toBeUndefined();
  });
});
