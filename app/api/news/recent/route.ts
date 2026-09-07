import { type NextRequest, NextResponse } from "next/server";
import { cachedJsonResponse } from "@/lib/api-cache";
import { getDb } from "@/lib/db/connection";
import { NewsRepository } from "@/lib/db/repositories/news";
import { loggers } from "@/lib/logger";

/** Bounds on the window and the page, so neither can reach SQL unbounded. */
const DEFAULT_DAYS = 7;
const MAX_DAYS = 365;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

/**
 * Reads one positive integer query parameter, bounded.
 *
 * Why: `parseInt("abc")` is NaN, which would reach the query as a LIMIT or an
 * interval width and fail the statement rather than fall back (#140).
 * What: Returns `fallback` when the value is not a number. Otherwise clamps it
 * into `[1, max]` — out-of-range input is clamped, never rejected and never
 * replaced by `fallback`.
 * Test: `tests/unit/news-route-pagination.test.ts`.
 */
function readBoundedInt(raw: string | null, fallback: number, max: number): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;

  return Math.min(max, Math.max(1, parsed));
}

export async function GET(request: NextRequest) {
  try {
    // Ensure database connection is available
    const db = getDb();
    if (!db) {
      loggers.api.error("Database connection not available");
      return NextResponse.json(
        {
          error: "Database connection unavailable",
          message: "The database service is currently unavailable. Please try again later.",
        },
        { status: 503 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const days = readBoundedInt(searchParams.get("days"), DEFAULT_DAYS, MAX_DAYS);
    const limit = readBoundedInt(searchParams.get("limit"), DEFAULT_LIMIT, MAX_LIMIT);

    loggers.api.debug("Getting recent news from database", { days, limit });

    const newsRepo = new NewsRepository();

    // #140: the window, the ordering and the bound are all in the query now.
    // Fetching the top 100 and filtering by date here truncated any window that
    // held more than 100 articles.
    const recentNews = await newsRepo.getRecentWithin({ days, limit });

    // Transform to a simpler format for the homepage
    const transformedNews = recentNews.map((article) => {
      return {
        id: article.id,
        slug: article.slug,
        title: article.title,
        summary: article.summary || article.content.substring(0, 150) + "...",
        published_at: article.publishedAt,
        source: article.source || "AI News",
        source_url: article.sourceUrl,
        tool_mentions: article.toolMentions || [],
        tags: article.tags || [],
      };
    });

    return cachedJsonResponse(
      {
        news: transformedNews,
        total: transformedNews.length,
        days,
        _source: "database",
        _timestamp: new Date().toISOString(),
      },
      "/api/news/recent",
      200,
      undefined,
      request
    );
  } catch (error) {
    loggers.api.error("Recent news API error", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        error: "Internal server error",
        message: "An error occurred while fetching recent news. Please try again later.",
      },
      { status: 500 }
    );
  }
}
