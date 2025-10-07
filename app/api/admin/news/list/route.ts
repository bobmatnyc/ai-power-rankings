import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { ArticlesRepository } from "@/lib/db/repositories/articles.repository";
import { loggers } from "@/lib/logger";

/**
 * GET /api/admin/news/list
 *
 * Returns news articles sorted by published date with statistics
 * Query params: limit (default: all), offset (default: 0)
 */
export async function GET(request: NextRequest) {
  // Check admin authentication
  const authResult = await requireAdmin();
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const articlesRepo = new ArticlesRepository();

    // Get pagination parameters
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : undefined;
    const offset = searchParams.get("offset") ? parseInt(searchParams.get("offset")!, 10) : undefined;

    // Get articles with pagination
    const articles = await articlesRepo.getArticles({ limit, offset });

    // Get total count for pagination
    const allArticles = await articlesRepo.findAll();

    // Sort by published date (newest first)
    const sortedArticles = articles.sort((a, b) => {
      const dateA = new Date(a.publishedDate || a.createdAt);
      const dateB = new Date(b.publishedDate || b.createdAt);
      return dateB.getTime() - dateA.getTime();
    });

    // Calculate statistics using all articles
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    const currentMonthArticles = allArticles.filter((article) => {
      const date = new Date(article.publishedDate || article.createdAt);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });

    const lastMonthArticles = allArticles.filter((article) => {
      const date = new Date(article.publishedDate || article.createdAt);
      return date.getMonth() === lastMonth && date.getFullYear() === lastMonthYear;
    });

    const totalToolMentions = allArticles.reduce((sum, article) => {
      return sum + (Array.isArray(article.toolMentions) ? article.toolMentions.length : 0);
    }, 0);

    const averageToolMentions = allArticles.length > 0 ? totalToolMentions / allArticles.length : 0;

    return NextResponse.json({
      success: true,
      articles: sortedArticles,
      total: allArticles.length,
      stats: {
        total: allArticles.length,
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
