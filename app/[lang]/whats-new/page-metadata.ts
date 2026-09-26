import type { Metadata } from "next";
import { ENGLISH_ONLY_OG_LOCALE, englishOnlyAlternates } from "@/lib/seo/alternates";

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
