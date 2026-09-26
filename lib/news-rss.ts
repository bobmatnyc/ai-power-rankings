/**
 * RSS 2.0 rendering for the per-locale news feed at `/{lang}/news/rss.xml`.
 *
 * Why: The locale layout advertises `/{lang}/news/rss.xml` as an RSS alternate
 * and the news page links to it, but nothing served it (#150). Rendering lives
 * here, apart from the route, so the XML contract is testable without Next.js.
 * What: `buildNewsRssFeed` turns news rows into one RSS 2.0 document. All text
 * goes through `escapeXml`; nothing is wrapped in CDATA, so a `]]>` in an
 * article cannot end a section early.
 * Test: `tests/unit/news-rss-route.test.ts`.
 */

/** Most items one feed carries; readers only poll for what is new. */
export const NEWS_RSS_ITEM_LIMIT = 50;

/** Longest description taken from `content` when an article has no summary. */
const DESCRIPTION_FALLBACK_CHARS = 500;

const CHANNEL_TITLE = "AI Power Rankings - News & Updates";
const CHANNEL_DESCRIPTION =
  "The latest AI coding tools news, updates, and industry announcements from AI Power Rankings.";

/** The fields of a `NewsRepository` row the feed reads. */
export interface NewsRssArticle {
  slug: string;
  title: string;
  summary: string | null;
  content: string;
  publishedAt: Date | string;
}

export interface NewsRssOptions {
  lang: string;
  /** Absolute site origin, e.g. `https://aipowerranking.com`. */
  baseUrl: string;
  /** Newest first; the caller owns ordering and the item cap. */
  articles: readonly NewsRssArticle[];
  /** Time stamped as `lastBuildDate`. */
  now: Date;
}

/**
 * Characters XML 1.0 forbids anywhere in a document: C0 controls other than
 * tab, LF and CR, lone surrogates, and U+FFFE/U+FFFF.
 */
const INVALID_XML_CHARS =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/**
 * Escapes text for XML element content and attribute values.
 *
 * What: Drops characters XML 1.0 cannot represent, then replaces `&`, `<`,
 * `>`, `"` and `'` with entities. `>` is escaped so `]]>` never appears.
 */
export function escapeXml(value: string): string {
  return value
    .replace(INVALID_XML_CHARS, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** RFC 822 date (as RFC 1123 formats it), or null for an unparseable value. */
function rfc822(value: Date | string): string | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toUTCString();
}

function describe(article: NewsRssArticle): string {
  if (article.summary?.trim()) return article.summary;
  // Array.from splits by code point, so the cut never halves a surrogate pair.
  const chars = Array.from(article.content ?? "");
  const cut = chars.slice(0, DESCRIPTION_FALLBACK_CHARS).join("");
  return chars.length > DESCRIPTION_FALLBACK_CHARS ? `${cut}…` : cut;
}

function renderItem(article: NewsRssArticle, lang: string, baseUrl: string): string {
  const link = `${baseUrl}/${lang}/news/${encodeURIComponent(article.slug)}`;
  const pubDate = rfc822(article.publishedAt);
  return [
    "    <item>",
    `      <title>${escapeXml(article.title)}</title>`,
    `      <link>${escapeXml(link)}</link>`,
    `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
    ...(pubDate ? [`      <pubDate>${pubDate}</pubDate>`] : []),
    `      <description>${escapeXml(describe(article))}</description>`,
    "    </item>",
  ].join("\n");
}

/**
 * Renders one RSS 2.0 document for a locale's news.
 *
 * What: One `<channel>` with title, link, description, language,
 * lastBuildDate and an `atom:link rel="self"` to the feed, then one `<item>`
 * per article in the order given. Item links are the article's localized URL,
 * `{baseUrl}/{lang}/news/{slug}`, which the article page uses as its own URL.
 * Test: `tests/unit/news-rss-route.test.ts`.
 */
export function buildNewsRssFeed({ lang, baseUrl, articles, now }: NewsRssOptions): string {
  const origin = baseUrl.replace(/\/+$/, "");
  const channelLink = `${origin}/${lang}/news`;
  const selfLink = `${channelLink}/rss.xml`;

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${escapeXml(CHANNEL_TITLE)}</title>`,
    `    <link>${escapeXml(channelLink)}</link>`,
    `    <description>${escapeXml(CHANNEL_DESCRIPTION)}</description>`,
    `    <language>${escapeXml(lang)}</language>`,
    `    <lastBuildDate>${now.toUTCString()}</lastBuildDate>`,
    `    <atom:link href="${escapeXml(selfLink)}" rel="self" type="application/rss+xml"/>`,
    ...articles.map((article) => renderItem(article, lang, origin)),
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}
