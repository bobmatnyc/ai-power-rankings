import type { Metadata } from "next";
import { locales } from "@/i18n/config";
import { siteOrigin } from "@/lib/site-origin";

type Alternates = NonNullable<Metadata["alternates"]>;

export const NEWS_RSS_TITLE = "AI Power Rankings - News & Updates";

/**
 * The `<link rel="alternate" type="application/rss+xml">` entry for a locale's news feed.
 *
 * Why: `app/[lang]/layout.tsx` advertises the feed for every page, but Next.js
 * replaces the whole `alternates` object when a page sets its own, so every
 * page with a canonical silently dropped the RSS discovery link (#155).
 * What: `alternates.types` naming `${siteOrigin()}/${lang}/news/rss.xml`.
 * Test: `tests/unit/seo-canonical-origin.test.ts`.
 */
export function newsRssAlternateTypes(lang: string): NonNullable<Alternates["types"]> {
  return {
    "application/rss+xml": [
      { title: NEWS_RSS_TITLE, url: `${siteOrigin()}/${lang}/news/rss.xml` },
    ],
  };
}

/**
 * Builds a localized page's `alternates`: canonical, one hreflang per locale,
 * and the locale's news RSS link.
 *
 * Why: pages built these URLs from `getUrl()`, which is the per-deployment
 * `*.vercel.app` host on Vercel, so canonical and hreflang named a duplicate
 * of the real domain (#153). A page's `alternates` also replaces the layout's,
 * so the RSS link has to be rebuilt here or it disappears (#155). One builder
 * keeps every page on `siteOrigin()` and carrying all three.
 * What: `path` is the locale-free path (`""` for the home page, `/news`,
 * `/tools/cursor`). Returns `canonical` = `${siteOrigin()}/${canonicalLang}${path}`
 * (`canonicalLang` defaults to `"en"`), `languages[locale]` =
 * `${siteOrigin()}/${locale}${path}` for every locale, and
 * `types` = `newsRssAlternateTypes(lang)`.
 * Test: `tests/unit/seo-canonical-origin.test.ts`.
 */
export function localizedAlternates(
  lang: string,
  path: string,
  { canonicalLang = "en" }: { canonicalLang?: string } = {}
): Alternates {
  const origin = siteOrigin();
  const languages: Record<string, string> = {};
  for (const locale of locales) {
    languages[locale] = `${origin}/${locale}${path}`;
  }
  return {
    canonical: `${origin}/${canonicalLang}${path}`,
    languages,
    types: newsRssAlternateTypes(lang),
  };
}
