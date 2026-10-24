/**
 * The cached news read behind the tool page's "Related news" section (#193).
 *
 * Why: attribution runs a JS title match, so one tool's articles cannot be
 * selected in SQL. One scan per tool page view would repeat the same work for
 * every tool and locale; one shared entry costs one scan per refresh.
 * What: `getToolNewsBySlug()` scans active articles (slim columns, no
 * `content`), reads the catalogue the way `/api/news` does, and groups each
 * article under its primary tool, newest 5 per slug. Cached through
 * `unstable_cache` for the page's ISR window, tagged with the tags
 * `invalidateArticleCache()` clears, so ingestion and admin edits refresh it.
 * A failed read resolves `null` and is not cached; the section then shows its
 * "unavailable" text and the page still renders. Read-only.
 * Test: `tests/unit/tool-news-193.test.tsx` ("cached news read").
 */
import { unstable_cache } from "next/cache";
import { NewsRepository } from "@/lib/db/repositories/news";
import { readNewsToolCatalogue } from "@/lib/news-tool-catalogue";
import { groupNewsByPrimaryTool, type ToolNewsBySlug } from "./tool-news";
import { TOOL_PROFILE_REVALIDATE_SECONDS } from "./tool-profile-data";

/** Most articles the section lists per tool. */
export const TOOL_NEWS_LIMIT = 5;

/**
 * CACHE_TAGS.NEWS, .ARTICLES and .TOOLS in lib/cache/invalidation.service.ts,
 * all cleared by `invalidateArticleCache()`. Spelled out because importing that
 * module starts the memory cache's cleanup timer; a test pins them to it.
 */
export const TOOL_NEWS_CACHE_TAGS = ["news", "articles", "tools"];

async function readToolNews(): Promise<ToolNewsBySlug> {
  const [rows, catalogue] = await Promise.all([new NewsRepository().getToolNewsRows(),readNewsToolCatalogue()]);
  return groupNewsByPrimaryTool(rows, catalogue, TOOL_NEWS_LIMIT);
}

// #193: one shared cache entry for every tool page, refreshed with the page's ISR window.
const readToolNewsCached = unstable_cache(readToolNews, ["tool-news-by-slug", "v1"], {
  revalidate: TOOL_PROFILE_REVALIDATE_SECONDS,
  tags: TOOL_NEWS_CACHE_TAGS,
});

/** Related news for every tool, or `null` when it could not be read. Never rejects. */
export async function getToolNewsBySlug(): Promise<ToolNewsBySlug | null> {
  try {
    return await readToolNewsCached();
  } catch (error) {
    console.error("Tool profile: related news unavailable:", error instanceof Error ? error.message : error);
    return null;
  }
}
