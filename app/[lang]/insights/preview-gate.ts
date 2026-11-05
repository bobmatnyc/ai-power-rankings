import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ENGLISH_ONLY_OG_LOCALE, englishOnlyAlternates } from "@/lib/seo/alternates";

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

/**
 * Metadata for an `/[lang]/insights` page while it is a preview.
 *
 * Why: #198: the preview must stay out of search until #191 releases the
 * held `/whats-new` redirects with the launch, so every Insights page is
 * `noindex`. The body is English in every locale, so it follows the #156
 * English-only rule (an `/en` canonical, no hreflang).
 * What: absolute `title`, `description`, `robots` noindex/nofollow (also for
 * googleBot), `englishOnlyAlternates(lang, path)` and an `openGraph` whose `url`
 * is that canonical and whose `locale` is `en`.
 * Test: `tests/unit/insights-weekly-198.test.tsx`.
 */
export function insightsPreviewMetadata(
  lang: string,
  path: string,
  title: string,
  description: string
): Metadata {
  const alternates = englishOnlyAlternates(lang, path);
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
