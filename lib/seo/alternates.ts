import type { Metadata } from "next";
import { i18n, locales } from "@/i18n/config";
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
 * Builds a localized page's `alternates`: a self-referencing canonical, one
 * hreflang per locale plus `x-default`, and the locale's news RSS link.
 *
 * Why: pages built these URLs from `getUrl()`, which is the per-deployment
 * `*.vercel.app` host on Vercel, so canonical and hreflang named a duplicate
 * of the real domain (#153). A page's `alternates` also replaces the layout's,
 * so the RSS link has to be rebuilt here or it disappears (#155). Every locale
 * page is a real translation, so each one canonicalises to itself; pointing
 * `/de/news` at `/en/news` told search engines to drop the German page (#156).
 * What: `path` is the locale-free path (`""` for the home page, `/news`,
 * `/tools/cursor`). Returns `canonical` = `${siteOrigin()}/${lang}${path}`
 * when `lang` is in `i18n/config.ts`, else the `i18n.defaultLocale` URL;
 * `languages[locale]` = `${siteOrigin()}/${locale}${path}` for every locale,
 * `languages["x-default"]` = `${siteOrigin()}/${i18n.defaultLocale}${path}`,
 * and `types` = `newsRssAlternateTypes(lang)`. A known locale cannot
 * canonicalise to another language.
 * Test: `tests/unit/seo-canonical-origin.test.ts`.
 */
export function localizedAlternates(lang: string, path: string): Alternates & { canonical: string } {
  const origin = siteOrigin();
  const languages: Record<string, string> = {};
  for (const locale of locales) {
    languages[locale] = `${origin}/${locale}${path}`;
  }
  // #156: the language-selector fallback for searchers matching no locale.
  languages["x-default"] = `${origin}/${i18n.defaultLocale}${path}`;
  // #156: an unknown segment (`/xx/news`, `/EN/tools/cursor`) renders the
  // English content, so it canonicalises there rather than to itself.
  const canonicalLang = (locales as readonly string[]).includes(lang) ? lang : i18n.defaultLocale;
  return {
    // #156: self-canonical for every real locale.
    canonical: `${origin}/${canonicalLang}${path}`,
    languages,
    types: newsRssAlternateTypes(lang),
  };
}
