import { type NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { ArticleDatabaseService } from "@/lib/services/article-db-service";
import { getDb } from "@/lib/db/connection";

/**
 * POST /api/admin/articles/[id]/recalculate
 * Recalculate rankings for a specific article
 */
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { id } = params;

    // Check admin authentication
    const isAuthenticated = await isAdminAuthenticated();
    if (!isAuthenticated) {
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

    console.log(`[API] Recalculating rankings for article: ${id}`);

    const articleService = new ArticleDatabaseService();
    await articleService.recalculateArticleRankings(id);

    return NextResponse.json({
      success: true,
      message: "Article rankings recalculated successfully",
    });
  } catch (error) {
    console.error("[API] Error recalculating rankings:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to recalculate rankings" },
      { status: 500 }
    );
  }
}