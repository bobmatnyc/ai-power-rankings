import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { ArticlesRepository } from "@/lib/db/repositories/articles.repository";
import { loggers } from "@/lib/logger";

/**
 * GET /api/admin/news/list
 *
 * Returns all news articles sorted by published date with statistics
 */
export async function GET(_request: NextRequest) {
  // Check admin authentication
  const authResult = await requireAdmin();
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const articlesRepo = new ArticlesRepository();

    // Get all articles from database
    const articles = await articlesRepo.findAll();

    // Sort by published date (newest first)
    const sortedArticles = articles.sort((a, b) => {
      const dateA = new Date(a.publishedDate || a.createdAt);
      const dateB = new Date(b.publishedDate || b.createdAt);
      return dateB.getTime() - dateA.getTime();
    });

    // Calculate statistics
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    const currentMonthArticles = articles.filter((article) => {
      const date = new Date(article.publishedDate || article.createdAt);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });

    const lastMonthArticles = articles.filter((article) => {
      const date = new Date(article.publishedDate || article.createdAt);
      return date.getMonth() === lastMonth && date.getFullYear() === lastMonthYear;
    });

    const totalToolMentions = articles.reduce((sum, article) => {
      return sum + (Array.isArray(article.toolMentions) ? article.toolMentions.length : 0);
    }, 0);

    const averageToolMentions = articles.length > 0 ? totalToolMentions / articles.length : 0;

    return NextResponse.json({
      success: true,
      articles: sortedArticles,
      total: sortedArticles.length,
      stats: {
        total: articles.length,
        currentMonth: currentMonthArticles.length,
        lastMonth: lastMonthArticles.length,
        averageToolMentions: Math.round(averageToolMentions * 100) / 100,
      },
    });
  } catch (error) {
    loggers.api.error("Error in admin/news/list GET", { error });
    return NextResponse.json({ error: "Failed to load articles" }, { status: 500 });
  }
}
