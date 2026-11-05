import { locales } from '@/i18n/config';
import { loggers } from '@/lib/logger';
import { escapeXml } from '@/lib/news-rss';
import { listDigests } from '@/lib/services/weekly-digest.repository';
import { listPeriods } from '@/lib/services/whats-new-summary.service';
import { siteOrigin } from '@/lib/site-origin';
import { firstSentence, formatPeriod } from '@/lib/whats-new-period';
import { digestBody, digestRange } from '@/lib/weekly-digest-window';
import { INSIGHTS_FEED_TITLES, insightsPreviewEnabled, monthlyInsightPath, weeklyInsightPath } from './preview-gate';

/**
 * RSS 2.0 feeds of the Insights preview, one per cadence (#198).
 *
 * Why: #198 slice 3: proposal M5-7 asks for "RSS per cadence". The feeds sit
 * beside the pages they list, at `/{lang}/insights/weekly/rss.xml` and
 * `/{lang}/insights/monthly/rss.xml`, the `<section>/rss.xml` shape of the news
 * and What's New feeds. Like the pages they are a preview: behind
 * `INSIGHTS_PREVIEW`, `X-Robots-Tag: noindex`; each Insights page head
 * advertises them while the flag is on (`insightsFeedLinks`). This module lives under the route
 * directory so no file outside `/insights` names an Insights URL.
 * What: `buildInsightsRssFeed` renders one RSS 2.0 document; every text node
 * goes through `escapeXml`. Item links and guids are the `/en` permalinks on
 * `siteOrigin()`, the canonical URLs. `insightsFeedResponse` is the whole GET.
 * Test: `tests/unit/insights-rss-198.test.ts`.
 */

export type InsightsCadence = 'weekly' | 'monthly';

/** #198: most items one Insights feed carries. */
export const INSIGHTS_RSS_ITEM_LIMIT = 20;

const CHANNEL: Record<InsightsCadence, { title: string; description: string }> = {
  weekly: {
    title: INSIGHTS_FEED_TITLES.weekly, // #198: shared with the page-head feed link
    description: 'Weekly insights on AI coding tools: what moved, what shipped and what to watch.',
  },
  monthly: {
    title: INSIGHTS_FEED_TITLES.monthly, // #198: shared with the page-head feed link
    description: 'Monthly insights on AI coding tools from AI Power Rankings.',
  },
};

export interface InsightsRssItem {
  title: string;
  /** Locale-free path, e.g. `/insights/weekly/2026-W44`. */
  path: string;
  description: string;
  date: Date;
}

export interface InsightsRssOptions {
  cadence: InsightsCadence;
  lang: string;
  /** Absolute site origin, e.g. `https://aipowerranking.com`. */
  baseUrl: string;
  items: readonly InsightsRssItem[];
  now: Date;
}

/** One RSS 2.0 document for a cadence; items newest first, at most `INSIGHTS_RSS_ITEM_LIMIT`. */
export function buildInsightsRssFeed({ cadence, lang, baseUrl, items, now }: InsightsRssOptions): string {
  const origin = baseUrl.replace(/\/+$/, '');
  const channel = CHANNEL[cadence];
  const rendered = [...items]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, INSIGHTS_RSS_ITEM_LIMIT)
    .map((item) => {
      // #198: the /en permalink is the canonical URL (English-only, #156).
      const link = `${origin}/en${item.path}`;
      return [
        '    <item>',
        `      <title>${escapeXml(item.title)}</title>`,
        `      <link>${escapeXml(link)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
        `      <pubDate>${item.date.toUTCString()}</pubDate>`,
        `      <description>${escapeXml(item.description)}</description>`,
        '    </item>',
      ].join('\n');
    });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    `    <title>${escapeXml(channel.title)}</title>`,
    `    <link>${escapeXml(`${origin}/en/insights`)}</link>`,
    `    <description>${escapeXml(channel.description)}</description>`,
    `    <language>${escapeXml(lang)}</language>`,
    `    <lastBuildDate>${now.toUTCString()}</lastBuildDate>`,
    `    <atom:link href="${escapeXml(`${origin}/${lang}/insights/${cadence}/rss.xml`)}" rel="self" type="application/rss+xml"/>`,
    ...rendered,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');
}

/** Weekly items from the #181 digest reader. */
async function weeklyItems(): Promise<InsightsRssItem[]> {
  const digests = await listDigests(INSIGHTS_RSS_ITEM_LIMIT);
  return digests.map((d) => ({
    title: `Weekly insight: ${digestRange(d.week)}`,
    path: weeklyInsightPath(d.week),
    description: firstSentence(digestBody(d.content)) ?? `Weekly insight for ${digestRange(d.week)}.`,
    date: d.createdAt,
  }));
}

/**
 * Monthly items from the #182 period list. The list holds no body, so the
 * description is a fixed line, as in the #181 What's New feed.
 */
async function monthlyItems(): Promise<InsightsRssItem[]> {
  const periods = await listPeriods();
  return periods.map((p) => ({
    title: `Monthly insight: ${formatPeriod(p.period)}`,
    path: monthlyInsightPath(p.period),
    description: `Monthly insight for ${formatPeriod(p.period)}.`,
    date: p.updatedAt,
  }));
}

// #198: the same CDN window as the news and What's New feeds.
const FEED_CACHE_CONTROL = 'public, s-maxage=300, stale-while-revalidate=1800';
// #198: a preview feed stays out of search, like the noindex pages.
const ROBOTS = 'noindex, nofollow';

function textResponse(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': ROBOTS },
  });
}

/**
 * The GET of `/{lang}/insights/<cadence>/rss.xml` (#198).
 *
 * What: 404 when `INSIGHTS_PREVIEW` is off, before any read, and for a locale
 * outside `i18n/config`. Otherwise reads the cadence's rows and returns the
 * feed with `X-Robots-Tag: noindex, nofollow`. A failed read is a 503 marked
 * `no-store`, never an empty 200 the CDN would keep as the feed. No rows
 * stored gives a valid feed with no items.
 * Test: `tests/unit/insights-rss-198.test.ts`.
 */
export async function insightsFeedResponse(cadence: InsightsCadence, lang: string): Promise<Response> {
  if (!insightsPreviewEnabled()) return textResponse(404, 'Not Found');
  if (!(locales as readonly string[]).includes(lang)) return textResponse(404, 'Not Found');

  let items: InsightsRssItem[];
  try {
    items = cadence === 'weekly' ? await weeklyItems() : await monthlyItems();
  } catch (error) {
    loggers.api.error('RSS feed: insights read failed', {
      cadence,
      lang,
      error: error instanceof Error ? error.message : String(error),
    });
    return textResponse(503, 'Insights feed temporarily unavailable');
  }

  const xml = buildInsightsRssFeed({ cadence, lang, baseUrl: siteOrigin(), items, now: new Date() });
  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': FEED_CACHE_CONTROL,
      'X-Robots-Tag': ROBOTS,
    },
  });
}
