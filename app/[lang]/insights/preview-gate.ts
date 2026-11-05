import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { canonicalLocale, ENGLISH_ONLY_OG_LOCALE, englishOnlyAlternates } from "@/lib/seo/alternates";
import { siteOrigin } from "@/lib/site-origin";

/**
 * Whether the `/[lang]/insights` routes render (#198).
 *
 * Why: #198 ships the Insights pages in slices before the redesign is signed
 * off. Until then the routes must not exist for visitors or crawlers, in any
 * environment, unless a deploy opts in. Same shape as `designPreviewEnabled`
 * (#190), but off by default everywhere, development included.
 * What: true only when `INSIGHTS_PREVIEW` is exactly `"true"`. Unset, empty or
 * any other value is off. Read at request time; the pages render on demand.
 * Test: `tests/unit/insights-weekly-198.test.tsx`.
 */
export function insightsPreviewEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.INSIGHTS_PREVIEW === "true";
}

/** #198: answers 404 (the `[lang]` not-found page) unless the preview flag is on; call before any read. */
export function requireInsightsPreview(): void {
  if (!insightsPreviewEnabled()) notFound();
}

export const INSIGHTS_TITLE = "Insights | AI Power Rankings";

/** #198: the channel title of each cadence's feed; the feed and the page head share it. */
export const INSIGHTS_FEED_TITLES = {
  weekly: "AI Power Rankings - Weekly Insights",
  monthly: "AI Power Rankings - Monthly Insights",
} as const;

/**
 * The `<link rel="alternate" type="application/rss+xml">` entries for the Insights feeds (#198).
 *
 * Why: #198: proposal M5-7 asks for RSS per cadence; a feed reader finds a
 * feed through the page head. The feeds 404 while the preview is off, so they
 * are advertised only when it is on.
 * What: `[]` when `insightsPreviewEnabled(env)` is false. Otherwise the weekly
 * and monthly feed, each `${siteOrigin()}/${canonicalLocale(lang)}/insights/<cadence>/rss.xml`,
 * the same per-locale shape as the news feed link (#156).
 * Test: `tests/unit/insights-sitemap-198.test.ts`.
 */
export function insightsFeedLinks(
  lang: string,
  env: Record<string, string | undefined> = process.env
): Array<{ title: string; url: string }> {
  if (!insightsPreviewEnabled(env)) return [];
  const base = `${siteOrigin()}/${canonicalLocale(lang)}`;
  return (["weekly", "monthly"] as const).map((cadence) => ({
    title: INSIGHTS_FEED_TITLES[cadence],
    url: `${base}/insights/${cadence}/rss.xml`,
  }));
}

/**
 * Metadata for an `/[lang]/insights` page while it is a preview.
 *
 * Why: #198: the preview must stay out of search until #191 releases the
 * held `/whats-new` redirects with the launch, so every Insights page is
 * `noindex`. The body is English in every locale, so it follows the #156
 * English-only rule (an `/en` canonical, no hreflang).
 * What: absolute `title`, `description`, `robots` noindex/nofollow (also for
 * googleBot), `englishOnlyAlternates(lang, path)` with `insightsFeedLinks(lang)`
 * appended to its RSS types, and an `openGraph` whose `url` is that canonical
 * and whose `locale` is `en`.
 * Test: `tests/unit/insights-weekly-198.test.tsx`, `tests/unit/insights-sitemap-198.test.ts`.
 */
export function insightsPreviewMetadata(
  lang: string,
  path: string,
  title: string,
  description: string
): Metadata {
  const base = englishOnlyAlternates(lang, path);
  // #198: the Insights feeds join the site-wide news feed only while the preview is on.
  const newsFeeds = base.types?.["application/rss+xml"];
  const alternates = {
    ...base,
    types: {
      ...base.types,
      "application/rss+xml": [...(Array.isArray(newsFeeds) ? newsFeeds : []), ...insightsFeedLinks(lang)],
    },
  };
  return {
    title: { absolute: title },
    description,
    // #198: noindex until the Insights launch; see #191 for the held redirects.
    robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
    openGraph: { title, description, url: alternates.canonical, locale: ENGLISH_ONLY_OG_LOCALE },
    alternates,
  };
}

/** The locale-free path of a weekly Insight (#198); proposal M5-7 names `/insights/weekly/<yyyy-Www>`. */
export function weeklyInsightPath(week: string): string {
  return `/insights/weekly/${week}`;
}

/** #198: the locale-free path of a monthly Insight; proposal M5-7 names `/insights/monthly/<yyyy-mm>`. */
export function monthlyInsightPath(period: string): string {
  return `/insights/monthly/${period}`;
}
