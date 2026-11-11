/**
 * #442: public news views link crawled URLs only when they are http(s).
 *
 * Why: `source_url` and an article body's links are crawled data. The news card
 *   (live on /{lang}/tools/{slug}) and the legacy news detail view put them into
 *   `href` unchecked, so a `javascript:` or `data:` value became a clickable link.
 * What: renders the news card and the legacy detail view to static HTML with
 *   http(s), `data:`, `javascript:` and relative inputs, and checks which hrefs
 *   appear. Matches the Article template (#198): a non-http(s) source shows no
 *   link; a non-http(s) referenced link is left out.
 * Test: `npx vitest run tests/unit/news-http-href-442.test.tsx`. No database, no network.
 */
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import en from "../../i18n/dictionaries/en.json";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("../../components/ui/tool-icon", () => ({ ToolIcon: () => null }));
vi.mock("../../components/news/article-scoring-impact", () => ({ default: () => null }));

import { NewsCard, type NewsItem } from "../../components/news/news-card";
import NewsDetailContent from "../../components/news/news-detail-content";

const UNSAFE = [
  "javascript:alert(1)",
  " JavaScript:alert(1)",
  "data:text/html,<script>alert(1)</script>",
  "/en/tools/cursor",
  "//evil.example/x",
];
const SAFE = ["https://verge.example/cursor", "http://verge.example/cursor"];

/** Every `href` value in `html`, entity-decoded enough to compare against the inputs. */
function hrefs(html: string): string[] {
  return [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"));
}

function newsItem(source_url: string): NewsItem {
  return {
    id: "n1",
    tool_id: "t1",
    tool_name: "Tool",
    tool_category: "code-editor",
    event_date: "2026-10-21T00:00:00Z",
    event_type: "update",
    title: "Item",
    description: "Desc",
    source_url,
    source_name: "The Verge",
  };
}

function detail(over: { content?: string; source_url?: string }) {
  const article = {
    id: "a1",
    slug: "s",
    title: "Title",
    content: over.content ?? "Body",
    source: "The Verge",
    source_url: over.source_url,
    published_date: "2026-10-21T00:00:00Z",
    created_at: "2026-10-21T00:00:00Z",
    updated_at: "2026-10-21T00:00:00Z",
  };
  return renderToStaticMarkup(<NewsDetailContent article={article} tool={null} dict={en as never} lang="en" />);
}

describe("news card source link (#442)", () => {
  it.each(UNSAFE)("source_url %j renders no View Source link", (url) => {
    const html = renderToStaticMarkup(<NewsCard item={newsItem(url)} />);
    expect(html).not.toContain("View Source");
    expect(hrefs(html)).not.toContain(url);
    expect(hrefs(html)).not.toContain(url.trim());
  });

  it.each(SAFE)("source_url %j links View Source to it", (url) => {
    const html = renderToStaticMarkup(<NewsCard item={newsItem(url)} />);
    expect(html).toContain("View Source");
    expect(hrefs(html)).toContain(url);
  });
});

describe("legacy news detail view (#442)", () => {
  it.each(UNSAFE)("source_url %j renders no View Source link", (url) => {
    const html = detail({ source_url: url });
    expect(html).not.toContain("View Source");
    expect(hrefs(html)).not.toContain(url);
    expect(hrefs(html)).not.toContain(url.trim());
  });

  it.each(SAFE)("source_url %j links View Source to it", (url) => {
    const html = detail({ source_url: url });
    expect(html).toContain("View Source");
    expect(hrefs(html)).toContain(url);
  });

  it("referenced links: lists only the http(s) links, never a data:, javascript: or relative href", () => {
    // The links sit in a "Related Links" block, which the body render strips, so
    // the "Referenced Links:" list is the only place they can render.
    const content = [
      "Body text.",
      "",
      "**Related Links:**",
      "- [Safe https](https://safe.example/a)",
      "- [Safe http](http://safe.example/b)",
      "- [Bad js](javascript:alert(1))",
      "- [Bad data](data:text/html,hi)",
      "- [Relative](/en/tools/cursor)",
    ].join("\n");
    const html = detail({ content });
    const links = hrefs(html);
    expect(html).toContain("Referenced Links:");
    expect(links).toContain("https://safe.example/a");
    expect(links).toContain("http://safe.example/b");
    expect(links.some((h) => /^\s*(javascript|data):/i.test(h))).toBe(false);
    expect(links).not.toContain("/en/tools/cursor");
    for (const text of ["Bad js", "Bad data", "Relative"]) {
      expect(html).not.toMatch(new RegExp(`>${text}</a>`));
    }
  });
});
