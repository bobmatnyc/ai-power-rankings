import { type NextRequest, NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/admin-auth";
import { getNewsRepo } from "@/lib/json-db";
import { loggers } from "@/lib/logger";

/**
 * GET /api/admin/news/list
 *
 * Returns all news articles sorted by published date
 */
export async function GET(_request: NextRequest) {
  return withAdminAuth(async (): Promise<NextResponse> => {
    try {
      const newsRepo = getNewsRepo();
      const articles = await newsRepo.getAll();

      // Sort by published date (newest first)
      const sortedArticles = articles.sort((a, b) => {
        const dateA = new Date(a.published_date || a.created_at);
        const dateB = new Date(b.published_date || b.created_at);
        return dateB.getTime() - dateA.getTime();
      });

      return NextResponse.json({
        success: true,
        articles: sortedArticles,
        total: sortedArticles.length,
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