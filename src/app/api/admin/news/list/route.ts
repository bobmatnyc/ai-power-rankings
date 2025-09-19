import { type NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/clerk-auth";
import { newsRepository } from "@/lib/db/repositories/news";
import { getNewsRepo } from "@/lib/json-db";
import { loggers } from "@/lib/logger";

/**
 * GET /api/admin/news/list
 *
 * Returns all news articles sorted by published date with statistics
 */
export async function GET(_request: NextRequest) {
  return withAuth(async (): Promise<NextResponse> => {
    try {
      // Try database first
      const dbArticles = await newsRepository.getAll();
      let articles: any[] = [];
      let stats = null;

      // If no articles in database, fallback to JSON
      if (!dbArticles || dbArticles.length === 0) {
        loggers.api.info("No articles in database, falling back to JSON");
        const newsRepo = getNewsRepo();
        const jsonArticles = await newsRepo.getAll();

        // Sort by published date (newest first)
        articles = jsonArticles.sort((a, b) => {
          const dateA = new Date(a.published_date || a.created_at);
          const dateB = new Date(b.published_date || b.created_at);
          return dateB.getTime() - dateA.getTime();
        });
      } else {
        // Convert database articles to a consistent format
        articles = dbArticles;
        // Get statistics from database
        stats = await newsRepository.getStatistics();
      }

      return NextResponse.json({
        success: true,
        articles: articles,
        total: articles.length,
        stats: stats || {
          total: articles.length,
          currentMonth: 0,
          lastMonth: 0,
          averageToolMentions: 0
        }
      });
    } catch (error) {
      loggers.api.error("Error in admin/news/list GET", { error });
      return NextResponse.json(
        { error: "Failed to load articles" },
        { status: 500 }
      );
    }
  });
}