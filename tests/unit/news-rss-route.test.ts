import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression tests for #150 — the per-locale RSS feed at `/{lang}/news/rss.xml`.
 *
 * Why: The locale layout advertised `/{lang}/news/rss.xml` and the news page
 * linked to it, but no route served it, so every request was a 404.
 * What: Calls the route handler with the repository, database handle and site
 * URL replaced, then checks the response: status per locale, content type,
 * cache headers, RSS 2.0 structure, XML escaping, and that a failed read is a
 * 503 rather than an empty feed. `assertWellFormedXml` is a strict checker for
 * the subset of XML the feed emits (no CDATA, comments or DTD); its own test
 * shows it rejects the defects it is meant to catch.
 * Test: `npx vitest run tests/unit/news-rss-route.test.ts`. No database access,
 * no network.
 */

const { getPageFiltered } = vi.hoisted(() => ({
  getPageFiltered: vi.fn(),
}));

vi.mock("../../lib/db/repositories/news", () => ({
  NewsRepository: class {
    getPageFiltered = getPageFiltered;
  },
}));

vi.mock("../../lib/get-url", () => ({
  getUrl: () => "https://aipowerranking.com",
}));

import { GET } from "../../app/[lang]/news/rss.xml/route";
import { locales } from "../../i18n/config";
import { NEWS_RSS_ITEM_LIMIT } from "../../lib/news-rss";

const BASE = "https://aipowerranking.com";

function article(slug: string, overrides: Record<string, unknown> = {}) {
  return {
    id: `id-${slug}`,
    slug,
    title: `Title ${slug}`,
    summary: `Summary ${slug}`,
    content: "Body text.",
    source: "AI News",
    sourceUrl: null,
    publishedAt: new Date("2026-09-01T12:00:00.000Z"),
    toolMentions: [],
    importanceScore: 5,
    tags: [],
    category: null,
    eventType: "update",
    ...overrides,
  };
}

async function get(lang: string): Promise<Response> {
  return GET(new Request(`http://localhost/${lang}/news/rss.xml`), {
    params: Promise.resolve({ lang }),
  });
}

const ENTITY = /&(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g;

/** Throws unless `text` is legal XML character data or attribute text. */
function checkText(text: string, where: string): void {
  if (text.includes("<")) throw new Error(`raw '<' in ${where}: ${text}`);
  if (text.includes("]]>")) throw new Error(`']]>' in ${where}: ${text}`);
  if (text.replace(ENTITY, "").includes("&")) {
    throw new Error(`unescaped '&' in ${where}: ${text}`);
  }
}

/**
 * Strict well-formedness check: one XML declaration, one root element, every
 * tag well-formed and closed in order, all text and attribute values escaped.
 */
function assertWellFormedXml(xml: string): void {
  const declaration = /^<\?xml version="1\.0" encoding="UTF-8"\?>\n/;
  if (!declaration.test(xml)) throw new Error("missing XML declaration");
  const body = xml.replace(declaration, "");

  const stack: string[] = [];
  let roots = 0;
  let last = 0;
  const tagPattern = /<[^<>]*>/g;
  const tagShape =
    /^<(\/)?([A-Za-z_][\w.:-]*)((?:\s+[A-Za-z_][\w.:-]*="[^"]*")*)\s*(\/)?>$/;

  const checkBetween = (text: string): void => {
    checkText(text, stack.length ? `<${stack[stack.length - 1]}>` : "prolog/epilog");
    if (!stack.length && text.trim()) throw new Error(`text outside the root: ${text}`);
  };

  for (const match of body.matchAll(tagPattern)) {
    checkBetween(body.slice(last, match.index));
    last = (match.index ?? 0) + match[0].length;

    const shape = tagShape.exec(match[0]);
    if (!shape) throw new Error(`malformed tag: ${match[0]}`);
    const [, closing, name, attributes = "", selfClosing] = shape;
    for (const [, value] of attributes.matchAll(/="([^"]*)"/g)) {
      checkText(value ?? "", `attribute of <${name}>`);
    }

    if (closing) {
      const open = stack.pop();
      if (open !== name) throw new Error(`</${name}> closes <${open}>`);
      continue;
    }
    if (!stack.length) roots += 1;
    if (roots > 1) throw new Error("more than one root element");
    if (!selfClosing) stack.push(name ?? "");
  }

  checkBetween(body.slice(last));
  if (stack.length) throw new Error(`unclosed: ${stack.join(" > ")}`);
  if (roots !== 1) throw new Error("no root element");
}

/** Text of the first `<name>` element in `xml`, still escaped. */
function element(xml: string, name: string): string | undefined {
  return new RegExp(`<${name}(?:\\s[^>]*)?>([^<]*)</${name}>`).exec(xml)?.[1];
}

function items(xml: string): string[] {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1] ?? "");
}

const RFC_822 = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/;

describe("GET /{lang}/news/rss.xml (#150)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPageFiltered.mockResolvedValue([article("newest"), article("older")]);
  });

  it("serves a well-formed RSS 2.0 feed with the RSS content type for every supported locale", async () => {
    for (const lang of locales) {
      const response = await get(lang);
      const xml = await response.text();

      expect(response.status, lang).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("application/rss+xml; charset=utf-8");
      expect(response.headers.get("Cache-Control")).toContain("s-maxage=300");
      expect(response.headers.get("Cache-Control")).toContain("stale-while-revalidate=1800");
      assertWellFormedXml(xml);
      expect(element(xml, "language")).toBe(lang);
      expect(element(xml, "link")).toBe(`${BASE}/${lang}/news`);
    }
  });

  it("carries the required channel elements and one item per article, newest first", async () => {
    const response = await get("en");
    const xml = await response.text();

    expect(xml).toContain('<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">');
    expect(xml.match(/<channel>/g)).toHaveLength(1);
    const channel = xml.slice(0, xml.indexOf("<item>"));
    expect(element(channel, "title")).toBe("AI Power Rankings - News &amp; Updates");
    expect(element(channel, "description")).toBeTruthy();
    expect(element(channel, "lastBuildDate")).toMatch(RFC_822);
    expect(channel).toContain(
      `<atom:link href="${BASE}/en/news/rss.xml" rel="self" type="application/rss+xml"/>`
    );

    const [first, second, ...rest] = items(xml);
    expect(rest).toHaveLength(0);
    expect(element(first ?? "", "title")).toBe("Title newest");
    expect(element(first ?? "", "link")).toBe(`${BASE}/en/news/newest`);
    expect(element(first ?? "", "guid")).toBe(`${BASE}/en/news/newest`);
    expect(element(first ?? "", "pubDate")).toBe("Tue, 01 Sep 2026 12:00:00 GMT");
    expect(element(first ?? "", "description")).toBe("Summary newest");
    expect(element(second ?? "", "link")).toBe(`${BASE}/en/news/older`);

    // The newest articles, capped, from the same query the news page pages over.
    expect(getPageFiltered).toHaveBeenCalledWith({ limit: NEWS_RSS_ITEM_LIMIT, offset: 0 });
  });

  it("escapes &, < and ]]> in titles and content so the document stays well-formed", async () => {
    getPageFiltered.mockResolvedValue([
      article("tricky", {
        title: "R&D <b>bold</b> ]]> done",
        summary: null,
        content: "Use <script>&amp; then ]]> and a control \u0001 char",
      }),
    ]);

    const xml = await (await get("en")).text();

    assertWellFormedXml(xml);
    const [item] = items(xml);
    expect(element(item ?? "", "title")).toBe("R&amp;D &lt;b&gt;bold&lt;/b&gt; ]]&gt; done");
    expect(element(item ?? "", "description")).toBe(
      "Use &lt;script&gt;&amp;amp; then ]]&gt; and a control  char"
    );
    expect(xml).not.toContain("]]>");
  });

  it("returns 404 for an unsupported locale without reading news", async () => {
    const response = await get("xx");

    expect(response.status).toBe(404);
    expect(getPageFiltered).not.toHaveBeenCalled();
  });

  it("returns an uncacheable 503, not an empty feed, when the news read fails", async () => {
    getPageFiltered.mockRejectedValue(new Error("connection reset"));

    const response = await get("en");
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Content-Type")).not.toContain("rss");
    expect(body).not.toContain("<rss");
  });
});

describe("assertWellFormedXml", () => {
  const wrap = (inner: string) => `<?xml version="1.0" encoding="UTF-8"?>\n<rss>${inner}</rss>`;

  it("accepts escaped text and rejects each defect the feed tests rely on it to catch", () => {
    expect(() => assertWellFormedXml(wrap("<t>a &amp; b ]]&gt;</t>"))).not.toThrow();

    expect(() => assertWellFormedXml(wrap("<t>a & b</t>"))).toThrow(/unescaped '&'/);
    expect(() => assertWellFormedXml(wrap("<t>a ]]> b</t>"))).toThrow(/']]>'/);
    expect(() => assertWellFormedXml(wrap("<t>a < b</t>"))).toThrow();
    expect(() => assertWellFormedXml(wrap("<t><u></t></u>"))).toThrow(/closes/);
    expect(() => assertWellFormedXml(wrap('<t a="x & y"/>'))).toThrow(/unescaped '&'/);
    expect(() => assertWellFormedXml(`${wrap("")}<extra/>`)).toThrow(/more than one root/);
  });
});
