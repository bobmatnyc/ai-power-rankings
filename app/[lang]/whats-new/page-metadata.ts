import type { Metadata } from "next";
import { localizedAlternates } from "@/lib/seo/alternates";

export const WHATS_NEW_TITLE = "What's New | AI Power Rankings";
export const WHATS_NEW_OG_DESCRIPTION = "Latest AI tool rankings, news, and platform updates";

/**
 * Per-page metadata for a `/[lang]/whats-new` route.
 *
 * Why: #156: the layout serves several pages, so a canonical there would name
 * the index for every child. Each page supplies its own path instead.
 * What: self-canonical `alternates` for `path`, and an `openGraph` whose `url`
 * is that canonical (a page's `openGraph` replaces the layout's, so the title
 * and description are repeated here).
 * Test: `tests/unit/seo-canonical-origin.test.ts`.
 */
export function whatsNewPageMetadata(lang: string, path: string): Metadata {
  const alternates = localizedAlternates(lang, path);
  return {
    openGraph: {
      title: WHATS_NEW_TITLE,
      description: WHATS_NEW_OG_DESCRIPTION,
      url: alternates.canonical,
    },
    alternates,
  };
}
