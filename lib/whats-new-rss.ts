/**
 * RSS 2.0 rendering for the What's New feed at `/{lang}/whats-new/rss.xml` (#181).
 *
 * Why: #181 wants weekly digests and monthly reports in a feed. Rendering lives
 * here, apart from the route, like `lib/news-rss.ts`, so the XML contract is
 * testable without Next.js.
 * What: `buildWhatsNewRssFeed` turns digest rows and monthly periods into one
 * RSS 2.0 document, newest first. All text goes through `escapeXml`. Item links
 * are the English permalinks, which are the canonical URLs (#156). A digest's
 * description is its first sentence; a monthly report carries a fixed line,
 * since the period list holds no body.
 * Test: `tests/unit/weekly-digest-display-181.test.tsx`.
 */

import { escapeXml } from "@/lib/news-rss";
import { firstSentence, formatPeriod } from "@/lib/whats-new-period";
import { digestBody, digestRange } from "@/lib/weekly-digest-window";

/** Most items one feed carries. */
export const WHATS_NEW_RSS_ITEM_LIMIT = 50;

const CHANNEL_TITLE = "AI Power Rankings - What's New";
const CHANNEL_DESCRIPTION =
  "Weekly digests and monthly reports on AI coding tools from AI Power Rankings.";

export interface WhatsNewRssDigest {
  week: string;
  content: string;
  createdAt: Date;
}

export interface WhatsNewRssPeriod {
  period: string;
  updatedAt: Date;
}

export interface WhatsNewRssOptions {
  lang: string;
  /** Absolute site origin, e.g. `https://aipowerranking.com`. */
  baseUrl: string;
  digests: readonly WhatsNewRssDigest[];
  periods: readonly WhatsNewRssPeriod[];
  now: Date;
}

interface Item {
  title: string;
  link: string;
  description: string;
  date: Date;
}

function renderItem(item: Item): string {
  return [
    "    <item>",
    `      <title>${escapeXml(item.title)}</title>`,
    `      <link>${escapeXml(item.link)}</link>`,
    `      <guid isPermaLink="true">${escapeXml(item.link)}</guid>`,
    `      <pubDate>${item.date.toUTCString()}</pubDate>`,
    `      <description>${escapeXml(item.description)}</description>`,
    "    </item>",
  ].join("\n");
}

/** Renders one RSS 2.0 document for a locale's What's New feed. */
export function buildWhatsNewRssFeed({ lang, baseUrl, digests, periods, now }: WhatsNewRssOptions): string {
  const origin = baseUrl.replace(/\/+$/, "");
  const channelLink = `${origin}/${lang}/whats-new`;

  const items: Item[] = [
    ...digests.map((d) => ({
      title: `Weekly digest: ${digestRange(d.week)}`,
      link: `${origin}/en/whats-new/weekly/${d.week}`,
      description: firstSentence(digestBody(d.content)) ?? `Weekly digest for ${digestRange(d.week)}.`,
      date: d.createdAt,
    })),
    ...periods.map((p) => ({
      title: `What's New: ${formatPeriod(p.period)}`,
      link: `${origin}/en/whats-new/${p.period}`,
      description: `Monthly report for ${formatPeriod(p.period)}.`,
      date: p.updatedAt,
    })),
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, WHATS_NEW_RSS_ITEM_LIMIT);

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${escapeXml(CHANNEL_TITLE)}</title>`,
    `    <link>${escapeXml(channelLink)}</link>`,
    `    <description>${escapeXml(CHANNEL_DESCRIPTION)}</description>`,
    `    <language>${escapeXml(lang)}</language>`,
    `    <lastBuildDate>${now.toUTCString()}</lastBuildDate>`,
    `    <atom:link href="${escapeXml(`${channelLink}/rss.xml`)}" rel="self" type="application/rss+xml"/>`,
    ...items.map(renderItem),
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}
