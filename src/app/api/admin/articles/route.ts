import { type NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/clerk-auth";
import { ArticlesRepository } from "@/lib/db/repositories/articles.repository";
import { getDb } from "@/lib/db/connection";

/**
 * GET /api/admin/articles
 * List all articles with filtering options
 */
export async function GET(request: NextRequest) {
  try {
    // Check admin authentication (automatically skipped in local dev)
    const isAuth = await isAuthenticated();
    if (!isAuth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check database availability
    const db = getDb();
    if (!db) {
      return NextResponse.json(
        { error: "Database connection not available" },
        { status: 503 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "active";
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const includeStats = searchParams.get("includeStats") === "true";

    const articlesRepo = new ArticlesRepository();

    // Get articles
    const articles = await articlesRepo.getArticles({
      status,
      limit,
      offset,
    });

    // Get statistics if requested
    let stats: Awaited<ReturnType<typeof articlesRepo.getArticleStats>> | undefined;
    if (includeStats) {
      stats = await articlesRepo.getArticleStats();
    }

    return NextResponse.json({
      articles,
      stats,
      pagination: {
        limit,
        offset,
        total: stats?.totalArticles || articles.length,
      },
    });
  } catch (error) {
    console.error("[API] Error fetching articles:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch articles" },
      { status: 500 }
    );
  }
}