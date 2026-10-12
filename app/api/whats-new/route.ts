import type { NextRequest } from "next/server";
import { cachedJsonResponse, uncachedJsonResponse } from "@/lib/api-cache";
import { getDb } from "@/lib/db/connection";
import { NewsRepository } from "@/lib/db/repositories/news";
import { ToolsRepository } from "@/lib/db/repositories/tools.repository";
import { loggers } from "@/lib/logger";

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
 * `public, max-age=60, s-maxage=60`.
 * Test: `tests/unit/whats-new-route-fail-closed.test.ts`.
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
        const allTools = await toolsRepo.findAll();

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

    // Changelog data (static for now, can be made dynamic later)
    const changelogItems = [
      {
        id: "v0.2.0-1",
        title: "Comprehensive SEO Schema.org Markup",
        description: "Added structured data across the site including Organization, Website, SoftwareApplication, Review, and Breadcrumb schemas for improved search visibility and rich results.",
        date: "2025-10-24T00:00:00.000Z",
        category: "SEO",
        type: "feature" as const,
        version: "0.2.0",
      },
      {
        id: "v0.2.0-2",
        title: "Enhanced Article Summaries",
        description: "Upgraded AI-generated article summaries from 200-300 characters to comprehensive 750-1000 word primary content with improved quality and structure.",
        date: "2025-10-24T00:00:00.000Z",
        category: "Content",
        type: "feature" as const,
        version: "0.2.0",
      },
      {
        id: "v0.2.0-3",
        title: "Repository Organization",
        description: "Archived 9 experimental branches (2,870+ commits preserved) with comprehensive cleanup plan and clear categorization.",
        date: "2025-10-24T00:00:00.000Z",
        category: "Development",
        type: "improvement" as const,
        version: "0.2.0",
      },
      {
        id: "v0.1.4-1",
        title: "Security & TypeScript Hardening",
        description: "Fixed TypeScript errors across components, added admin endpoint protection, and reorganized documentation structure.",
        date: "2025-10-19T00:00:00.000Z",
        category: "Security",
        type: "fix" as const,
        version: "0.1.4",
      },
      {
        id: "v0.1.4-2",
        title: "Algorithm v7.2 Release",
        description: "Updated rankings with Algorithm v7.2 for October 2025, including updated i18n dictionaries and homepage tagline.",
        date: "2025-10-19T00:00:00.000Z",
        category: "Rankings",
        type: "feature" as const,
        version: "0.1.4",
      },
    ];

    // Filter changelog items by date threshold
    const recentChangelog = changelogItems.filter((item) => {
      const itemDate = new Date(item.date);
      return itemDate >= dateThreshold;
    });

    // Create unified feed with type discrimination
    const unifiedFeed: UnifiedFeedItem[] = [
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
      ...recentChangelog.map(
        (item): UnifiedFeedItem => ({
          type: "platform" as const,
          date: item.date,
          id: item.id,
          title: item.title,
          description: item.description,
          category: item.category,
          changeType: item.type,
          version: item.version,
        })
      ),
    ]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 20);

    return cachedJsonResponse(
      {
        feed: unifiedFeed,
        days,
        _source: "database",
        _timestamp: new Date().toISOString(),
      },
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
