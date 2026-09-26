import type { Metadata } from "next";
import { locales } from "@/i18n/config";
import { siteOrigin } from "@/lib/site-origin";

type Alternates = NonNullable<Metadata["alternates"]>;

/**
 * Builds a localized page's `alternates`: canonical plus one hreflang per locale.
 *
 * Why: pages built these URLs from `getUrl()`, which is the per-deployment
 * `*.vercel.app` host on Vercel, so canonical and hreflang named a duplicate
 * of the real domain (#153). One builder keeps every page on `siteOrigin()`.
 * What: `path` is the locale-free path (`""` for the home page, `/news`,
 * `/tools/cursor`). Returns `canonical` = `${siteOrigin()}/${canonicalLang}${path}`
 * and `languages[locale]` = `${siteOrigin()}/${locale}${path}` for every locale.
 * Test: `tests/unit/seo-canonical-origin.test.ts`.
 */
export function localizedAlternates(path: string, canonicalLang: string): Alternates {
  const origin = siteOrigin();
  const languages: Record<string, string> = {};
  for (const locale of locales) {
    languages[locale] = `${origin}/${locale}${path}`;
  }
  return {
    canonical: `${origin}/${canonicalLang}${path}`,
    languages,
  };
}
