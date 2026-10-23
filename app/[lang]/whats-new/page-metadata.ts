import type { Metadata } from "next";
import { ENGLISH_ONLY_OG_LOCALE, englishOnlyAlternates } from "@/lib/seo/alternates";
import { formatPeriod } from "@/lib/whats-new-period";

export const WHATS_NEW_TITLE = "What's New | AI Power Rankings";
export const WHATS_NEW_OG_DESCRIPTION = "Latest AI tool rankings, news, and platform updates";

/**
 * Per-page metadata for a `/[lang]/whats-new` route.
 *
 * Why: #156: the layout serves several pages, so a canonical there would name
 * the index for every child. Each page supplies its own path instead. The
 * layout heading and the feed and summary from `/api/whats-new*` are English
 * in every locale, so every locale canonicalises to `/en` with no hreflang.
 * What: `englishOnlyAlternates()` for `path`, and an `openGraph` whose `url`
 * is that canonical and whose `locale` is `en` (a page's `openGraph` replaces
 * the layout's, so the title and description are repeated here).
 * Test: `tests/unit/seo-canonical-origin.test.ts`.
 */
export function whatsNewPageMetadata(lang: string, path: string): Metadata {
  // #156: English canonical, no hreflang: English layout literals and an
  // English-only API body.
  const alternates = englishOnlyAlternates(lang, path);
  return {
    openGraph: {
      title: WHATS_NEW_TITLE,
      description: WHATS_NEW_OG_DESCRIPTION,
      url: alternates.canonical,
      locale: ENGLISH_ONLY_OG_LOCALE, // #156: the body is English
    },
    alternates,
  };
}

/** The locale-free path of a monthly report's permalink (#54). */
export function reportPath(period: string): string {
  return `/whats-new/${period}`;
}

/**
 * Metadata for one monthly report permalink, `/[lang]/whats-new/<period>`.
 *
 * Why: #54: each stored report gets its own indexable URL. Its body is the
 * English summary in every locale, so it canonicalises to `/en` like the
 * index (#156).
 * What: Title "<Month YYYY> | What's New | AI Power Rankings" (absolute, so
 * the root template adds nothing), the description given, the English-only
 * canonical for `reportPath(period)`, and an `article` `openGraph` whose `url`
 * is that canonical and whose `locale` is `en`.
 * Test: `tests/unit/whats-new-permalink.test.ts`.
 */
export function whatsNewReportMetadata(
  lang: string,
  period: string,
  description: string
): Metadata {
  const alternates = englishOnlyAlternates(lang, reportPath(period));
  const title = `${formatPeriod(period)} | ${WHATS_NEW_TITLE}`;
  return {
    title: { absolute: title },
    description,
    openGraph: {
      title,
      description,
      url: alternates.canonical,
      locale: ENGLISH_ONLY_OG_LOCALE,
      type: "article",
    },
    alternates,
  };
}
