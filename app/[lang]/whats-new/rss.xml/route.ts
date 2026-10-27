import { locales } from "@/i18n/config";
import { loggers } from "@/lib/logger";
import { WHATS_NEW_RSS_ITEM_LIMIT, buildWhatsNewRssFeed } from "@/lib/whats-new-rss";
import { listDigests } from "@/lib/services/weekly-digest.repository";
import { listPeriods } from "@/lib/services/whats-new-summary.service";
import { siteOrigin } from "@/lib/site-origin";

/**
 * Per-locale RSS 2.0 What's New feed at `/{lang}/whats-new/rss.xml`.
 *
 * Why: #181: weekly digests and monthly reports must be readable in a feed
 * reader, not only on the page.
 * What: 404 for a locale outside `i18n/config`'s list. Otherwise reads the
 * newest stored digests and every monthly period, and renders them with
 * `buildWhatsNewRssFeed`. A failed read is a 503 marked `no-store`, never an
 * empty 200 that the CDN would keep serving as the feed.
 * Test: `tests/unit/weekly-digest-display-181.test.tsx`.
 */

// #181: rendered per request like the news feed; the CDN caches it through the
// Cache-Control below, so an error response is never stored as the feed.
export const dynamic = "force-dynamic";

// #181: the same window as the news feed (`app/[lang]/news/rss.xml/route.ts`).
const FEED_CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=1800";

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

  if (!(locales as readonly string[]).includes(lang)) {
    return errorResponse(404, "Not Found");
  }

  let digests;
  let periods;
  try {
    [digests, periods] = await Promise.all([listDigests(WHATS_NEW_RSS_ITEM_LIMIT), listPeriods()]);
  } catch (error) {
    loggers.api.error("RSS feed: what's-new read failed", {
      lang,
      error: error instanceof Error ? error.message : String(error),
    });
    return errorResponse(503, "What's New feed temporarily unavailable");
  }

  // #181: the canonical origin, never VERCEL_URL or the request host.
  const xml = buildWhatsNewRssFeed({ lang, baseUrl: siteOrigin(), digests, periods, now: new Date() });

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": FEED_CACHE_CONTROL,
    },
  });
}
