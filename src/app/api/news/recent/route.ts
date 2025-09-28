import { type NextRequest, NextResponse } from "next/server";
import { cachedJsonResponse } from "@/lib/api-cache";
import { getDb } from "@/lib/db/connection";
import { NewsRepository } from "@/lib/db/repositories/news";
import { loggers } from "@/lib/logger";

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
    const days = parseInt(searchParams.get("days") || "7", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    loggers.api.debug("Getting recent news from database", { days, limit });

    const newsRepo = new NewsRepository();

    // Calculate date threshold
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - days);

    // Get all news articles from database
    const { articles: allNews } = await newsRepo.getPaginated(100, 0);

    // Filter for recent articles
    const recentNews = allNews
      .filter((article) => {
        const articleDate = new Date(
          article.published_at ||
            article.publishedAt ||
            article.created_at ||
            article.createdAt ||
            new Date()
        );
        return articleDate >= dateThreshold;
      })
      .sort((a, b) => {
        const dateA = new Date(
          a.published_at || a.publishedAt || a.created_at || a.createdAt || new Date()
        );
        const dateB = new Date(
          b.published_at || b.publishedAt || b.created_at || b.createdAt || new Date()
        );
        return dateB.getTime() - dateA.getTime(); // Sort by newest first
      })
      .slice(0, limit);

    // Transform to a simpler format for the homepage
    const transformedNews = recentNews.map((article) => {
      const articleData = article.data || {};

      return {
        id: article.id,
        slug: article.slug,
        title: article.title,
        summary: article.summary || (articleData as any)?.content?.substring(0, 150) + "...",
        published_at: article.published_at || article.publishedAt || article.created_at,
        source: article.source || (articleData as any)?.source || "AI News",
        source_url: article.sourceUrl || (articleData as any)?.source_url,
        tool_mentions: article.toolMentions || (articleData as any)?.tool_mentions || [],
        tags: (article as any).tags || (articleData as any)?.tags || [],
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
      "/api/news/recent"
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
