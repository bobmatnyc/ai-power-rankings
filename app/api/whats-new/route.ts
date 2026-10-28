import type { NextRequest } from "next/server";
import { cachedJsonResponse, uncachedJsonResponse } from "@/lib/api-cache";
import { CHANGELOG_ENTRIES } from "@/lib/data/changelog-entries";
import { getDb } from "@/lib/db/connection";
import { NewsRepository } from "@/lib/db/repositories/news";
import { ToolsRepository } from "@/lib/db/repositories/tools.repository";
import { loggers } from "@/lib/logger";
import { composeFeed, platformFeedItem } from "@/lib/services/whats-new-feed";

/**
 * Unified feed item type
 */
type UnifiedFeedItem =
  | {
      type: "news";
      date: string;
      id: string;
      slug: string;
      title: string;
      summary: string;
      published_at: string;
      source: string;
      source_url?: string;
    }
  | {
      type: "tool";
      date: string;
      id: string;
      name: string;
      slug: string;
      description: string;
      updatedAt: string;
      category: string;
      logo_url?: string;
    }
  | {
      type: "platform";
      date: string;
      id: string;
      title: string;
      description: string;
      category: string;
      changeType: "feature" | "improvement" | "fix" | "news";
      version: string;
    };

/** The 503 body for a failed news read (#152). */
const NEWS_UNAVAILABLE = {
  error: "Updates temporarily unavailable",
  message: "The news service is currently unavailable. Please try again later.",
};

/**
 * Combined endpoint for the What's New modal and page: news, tool updates and
 * the platform changelog in one feed, newest first.
 *
 * Why: A failed news read came back as an empty list, so the route served a
 * 200 feed with no news that the edge cached for a minute (#152).
 * What: 503 `no-store` when the database is missing or the news read fails,
 * even if the tools read succeeded — the feed is one merged list with no
 * per-section marker, so a partial feed would read as "no news this week".
 * 500 `no-store` for any other failure. Otherwise a 200 cached
 * `public, max-age=60, s-maxage=60`. #231: platform items come from the
 * build-time changelog module with 3 of 20 slots reserved; the body carries
 * `_sources` and `_degraded`, and a degraded feed is `no-store`.
 * Test: `tests/unit/whats-new-route-fail-closed.test.ts`,
 * `tests/unit/whats-new-feed-231.test.ts`.
 */
export async function GET(request: NextRequest) {
  try {
    // Ensure database connection is available
    const db = getDb();
    if (!db) {
      loggers.api.error("Database connection not available");
      // #152: never let the edge keep an outage response.
      return uncachedJsonResponse(NEWS_UNAVAILABLE, 503);
    }

    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get("days") || "7", 10);

    loggers.api.debug("Fetching What's New data", { days });

    // Calculate date threshold
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - days);

    // Fetch all data in parallel for maximum performance
    const [newsRead, toolsResult] = await Promise.all([
      // Fetch recent news.
      // #152: `getPageFiltered` throws on a failed read, where `getPaginated`
      // returned an empty page. The rejection is captured here, not thrown,
      // so the route can answer it with a 503 rather than the generic 500.
      (async () => {
        const allNews = await new NewsRepository().getPageFiltered({ limit: 100, offset: 0 });

        const recentNews = allNews
          .filter((article) => {
            const articleDate = new Date(article.publishedAt);
            return articleDate >= dateThreshold;
          })
          .map((article) => {
            const publishedAtStr = article.publishedAt instanceof Date
              ? article.publishedAt.toISOString()
              : String(article.publishedAt);
            return {
              id: article.id,
              slug: article.slug,
              title: article.title,
              summary: article.summary || article.content.substring(0, 150) + "...",
              published_at: publishedAtStr,
              source: article.source || "AI News",
              source_url: article.sourceUrl || undefined,
            };
          });

        return { ok: true as const, news: recentNews };
      })().catch((error: unknown) => ({ ok: false as const, error })),

      // Fetch recent tool updates
      (async () => {
        const toolsRepo = new ToolsRepository();
        // #314: active tools only; inactive seeded rows (0018, 0027) have updated_at = now().
        const allTools = await toolsRepo.findByStatus("active");

        const recentTools = allTools
          .filter((tool): tool is typeof tool & { updated_at: string } => {
            if (!tool.updated_at) return false;
            const toolDate = new Date(tool.updated_at);
            return !isNaN(toolDate.getTime()) && toolDate >= dateThreshold;
          })
          .map((tool) => {
            const toolData = tool.info || {};
            return {
              id: tool.id,
              name: tool.name,
              slug: tool.slug,
              description: (tool as any).description || "",
              updatedAt: tool.updated_at,
              category: tool.category,
              logo_url: (toolData as any).logo_url || (toolData as any).metadata?.logo_url || (tool as any).logo_url || null,
            };
          });

        return recentTools;
      })(),
    ]);

    // #152: a news failure fails the whole feed; see the doc comment above.
    if (!newsRead.ok) {
      loggers.api.error("What's New API: news read failed", {
        error: newsRead.error instanceof Error ? newsRead.error.message : String(newsRead.error),
      });
      return uncachedJsonResponse(NEWS_UNAVAILABLE, 503);
    }
    const newsResult = newsRead.news;

    // #231: platform items come from the build-time changelog module. The
    // hardcoded 2025-10 list never changed, so the feed showed no recent change.
    const platformAvailable = CHANGELOG_ENTRIES.length > 0;
    if (!platformAvailable) {
      loggers.api.error("What's New API: generated changelog module has no entries");
    }
    const platformItems = CHANGELOG_ENTRIES.filter(
      (entry) => new Date(entry.date) >= dateThreshold
    ).map(platformFeedItem);

    // #231: 3 of the 20 slots are held for platform items (supervisor ruling).
    const unifiedFeed: UnifiedFeedItem[] = composeFeed<UnifiedFeedItem>([
      ...newsResult.map((item) => ({
          ...item,
          type: "news" as const,
          date: item.published_at,
        } as UnifiedFeedItem)
      ),
      ...toolsResult.map((item) => ({
          ...item,
          type: "tool" as const,
          date: item.updatedAt,
        } as UnifiedFeedItem)
      ),
      ...platformItems,
    ]);

    // #231: per-source status, so a missing source is visible in the body.
    const body = {
      feed: unifiedFeed,
      days,
      _sources: {
        news: { status: "ok", count: newsResult.length },
        tools: { status: "ok", count: toolsResult.length },
        platform: { status: platformAvailable ? "ok" : "unavailable", count: platformItems.length },
      },
      _degraded: !platformAvailable,
      _timestamp: new Date().toISOString(),
    };

    // #231: a degraded feed is served but never cached.
    if (!platformAvailable) return uncachedJsonResponse(body, 200);

    return cachedJsonResponse(
      body,
      "/api/whats-new",
      200, // HTTP 200 OK
      { maxAge: 60, sMaxAge: 60 } // Cache for 1 minute
    );
  } catch (error) {
    loggers.api.error("What's New API error", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    // #152: an error body must not be kept by any cache.
    return uncachedJsonResponse(
      {
        error: "Internal server error",
        message: "An error occurred while fetching updates. Please try again later.",
      },
      500
    );
  }
}
