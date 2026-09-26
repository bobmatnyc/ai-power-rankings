import { locales } from "@/i18n/config";
import { NewsRepository } from "@/lib/db/repositories/news";
import { loggers } from "@/lib/logger";
import { NEWS_RSS_ITEM_LIMIT, buildNewsRssFeed } from "@/lib/news-rss";
import { siteOrigin } from "@/lib/site-origin";

/**
 * Per-locale RSS 2.0 news feed at `/{lang}/news/rss.xml`.
 *
 * Why: The locale layout advertises this URL as the RSS alternate and the news
 * page links to it, but no route served it, so it returned 404 (#150).
 * What: 404 for a locale outside `i18n/config`'s list. Otherwise reads the
 * newest active articles through the same `NewsRepository` query `/api/news`
 * (and so the `/[lang]/news` page) pages over, and renders them with
 * `buildNewsRssFeed`. A failed read is a 503 marked `no-store`, never an empty
 * 200 that the CDN would keep serving as the feed.
 * Test: `tests/unit/news-rss-route.test.ts`.
 */

// #150: rendered per request like the news page; the CDN caches it through
// the Cache-Control below, so an error response is never stored as the feed.
export const dynamic = "force-dynamic";

// #150: the same window `/api/news` gives the CDN (lib/api-cache.ts), which is
// where the news page reads its articles from.
const FEED_CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=1800";

function isSupportedLocale(lang: string): boolean {
  return (locales as readonly string[]).includes(lang);
}

function errorResponse(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ lang: string }> }
): Promise<Response> {
  const { lang } = await params;

  if (!isSupportedLocale(lang)) {
    return errorResponse(404, "Not Found");
  }

  let articles;
  try {
    // #150: `getPageFiltered` throws on a failed read and on a missing database
    // (`getDb()` itself throws in production when none is configured), where
    // `getPaginatedFiltered` would hand back an empty page that looks like a
    // valid, empty feed.
    articles = await new NewsRepository().getPageFiltered({
      limit: NEWS_RSS_ITEM_LIMIT,
      offset: 0,
    });
  } catch (error) {
    loggers.api.error("RSS feed: news read failed", {
      lang,
      error: error instanceof Error ? error.message : String(error),
    });
    return errorResponse(503, "News feed temporarily unavailable");
  }

  // #150: the canonical origin, never VERCEL_URL or the request host, so item
  // links and guids stay the same across deploys.
  const xml = buildNewsRssFeed({ lang, baseUrl: siteOrigin(), articles, now: new Date() });

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": FEED_CACHE_CONTROL,
    },
  });
}
