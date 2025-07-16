import { type NextRequest, NextResponse } from "next/server";
import { getNewsRepo } from "@/lib/json-db";
import { loggers } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    loggers.api.debug("Getting news for JSON export", { limit, offset });

    const newsRepo = getNewsRepo();

    // Get all news articles
    const allNews = await newsRepo.getAll();

    // Sort by published date (newest first)
    const sortedNews = allNews.sort(
      (a, b) => new Date(b.published_date).getTime() - new Date(a.published_date).getTime()
    );

    // Apply pagination
    const paginatedNews = sortedNews.slice(offset, offset + limit);

    return NextResponse.json(
      {
        news: paginatedNews,
        total: allNews.length,
        limit,
        offset,
        hasMore: offset + limit < allNews.length,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=3600", // Cache for 1 hour
        },
      }
    );
  } catch (error) {
    loggers.api.error("News JSON API error", { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
