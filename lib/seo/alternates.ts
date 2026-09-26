import type { Metadata } from "next";
import { i18n, locales } from "@/i18n/config";
import { siteOrigin } from "@/lib/site-origin";

type Alternates = NonNullable<Metadata["alternates"]>;

export const NEWS_RSS_TITLE = "AI Power Rankings - News & Updates";

/**
 * The locale a `[lang]` segment's URLs are built for: `lang` itself when it is
 * a locale in `i18n/config.ts`, else `i18n.defaultLocale`.
 *
 * Why: nothing rejects an unknown segment, so `/xx/news` and `/EN/tools/cursor`
 * render the English page with a 200. Naming the junk segment in canonical,
 * `og:url` or the RSS link made it an indexable duplicate and advertised a
 * feed that 404s (#156).
 * Test: `tests/unit/seo-canonical-origin.test.ts`.
 */
export function canonicalLocale(lang: string): string {
  return (locales as readonly string[]).includes(lang) ? lang : i18n.defaultLocale;
}

/**
 * The `<link rel="alternate" type="application/rss+xml">` entry for a locale's news feed.
 *
 * Why: `app/[lang]/layout.tsx` advertises the feed for every page, but Next.js
 * replaces the whole `alternates` object when a page sets its own, so every
 * page with a canonical silently dropped the RSS discovery link (#155).
 * What: `alternates.types` naming `${siteOrigin()}/${canonicalLocale(lang)}/news/rss.xml`.
 * Test: `tests/unit/seo-canonical-origin.test.ts`.
 */
export function newsRssAlternateTypes(lang: string): NonNullable<Alternates["types"]> {
  return {
    "application/rss+xml": [
      // #156: an unknown segment advertises the English feed, not a 404.
      { title: NEWS_RSS_TITLE, url: `${siteOrigin()}/${canonicalLocale(lang)}/news/rss.xml` },
    ],
  };
}

/**
 * `og:locale` for a page built with `englishOnlyAlternates()`: its body is
 * English whatever the `[lang]` segment says (#156).
 */
export const ENGLISH_ONLY_OG_LOCALE = i18n.defaultLocale;

/**
 * `alternates` for a page whose body is English in every locale: an English
 * canonical, no hreflang, and the page locale's news RSS link.
 *
 * Why: #156: a page whose main body is English in every locale (news
 * articles and the news list, the content-loader pages, the best-* guides,
 * what's new) is a duplicate of its `/en` page, not a translation, even when
 * its navigation is translated. Hreflang next to a cross-language canonical
 * would contradict it, so none is emitted. Pages pair it with `og:url` =
 * `canonical` and `og:locale` = `ENGLISH_ONLY_OG_LOCALE`.
 * What: `canonical` = `${siteOrigin()}/${i18n.defaultLocale}${path}` for any
 * `lang`; `types` = `newsRssAlternateTypes(lang)`; no `languages`.
 * Test: `tests/unit/seo-canonical-origin.test.ts`.
 */
export function englishOnlyAlternates(
  lang: string,
  path: string
): Alternates & { canonical: string } {
  return {
    canonical: `${siteOrigin()}/${i18n.defaultLocale}${path}`,
    types: newsRssAlternateTypes(lang),
  };
}

/**
 * Builds a localized page's `alternates`: a self-referencing canonical, one
 * hreflang per locale plus `x-default`, and the locale's news RSS link.
 *
 * Why: pages built these URLs from `getUrl()`, which is the per-deployment
 * `*.vercel.app` host on Vercel, so canonical and hreflang named a duplicate
 * of the real domain (#153). A page's `alternates` also replaces the layout's,
 * so the RSS link has to be rebuilt here or it disappears (#155). A page with
 * per-locale body content is a real translation, so each locale canonicalises
 * to itself; pointing `/de/rankings` at `/en/rankings` told search engines to
 * drop the German page (#156). Pages whose body is English in every locale use
 * `englishOnlyAlternates()` instead.
 * What: `path` is the locale-free path (`""` for the home page, `/news`,
 * `/tools/cursor`). Returns `canonical` =
 * `${siteOrigin()}/${canonicalLocale(lang)}${path}` (pages use it as `og:url`
 * too);
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
  return {
    // #156: self-canonical for every real locale; an unknown segment
    // (`/xx/news`, `/EN/tools/cursor`) renders English, so it points there.
    canonical: `${origin}/${canonicalLocale(lang)}${path}`,
    languages,
    types: newsRssAlternateTypes(lang),
  };
}
