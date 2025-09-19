import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAuthenticated } from "@/lib/clerk-auth";
import { ArticleDatabaseService } from "@/lib/services/article-db-service";
import { ArticlesRepository } from "@/lib/db/repositories/articles.repository";
import { getDb } from "@/lib/db/connection";

const UpdateArticleSchema = z.object({
  title: z.string().optional(),
  summary: z.string().optional(),
  content: z.string().optional(),
  tags: z.array(z.string()).optional(),
  category: z.string().optional(),
});

/**
 * GET /api/admin/articles/[id]
 * Get a specific article with impact statistics
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { id } = params;
    // Check admin authentication
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

    const articlesRepo = new ArticlesRepository();
    const article = await articlesRepo.getArticleWithImpact(id);

    if (!article) {
      return NextResponse.json(
        { error: "Article not found" },
        { status: 404 }
      );
    }

    // Get processing logs
    const logs = await articlesRepo.getArticleProcessingLogs(id);

    // Get ranking changes
    const rankingChanges = await articlesRepo.getArticleRankingChanges(id);

    return NextResponse.json({
      article,
      processingLogs: logs,
      rankingChanges,
    });
  } catch (error) {
    console.error("[API] Error fetching article:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch article" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/articles/[id]
 * Update an article (text only, no recalculation)
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { id } = params;
    // Check admin authentication
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

    const body = await request.json();
    const updates = UpdateArticleSchema.parse(body);

    const articleService = new ArticleDatabaseService();
    const article = await articleService.updateArticle(id, updates);

    return NextResponse.json({
      success: true,
      article,
      message: "Article updated successfully (rankings not recalculated)",
    });
  } catch (error) {
    console.error("[API] Error updating article:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update article" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/articles/[id]
 * Delete an article and rollback its ranking changes
 */
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { id } = params;
    // Check admin authentication
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

    const articleService = new ArticleDatabaseService();
    await articleService.deleteArticle(id);

    return NextResponse.json({
      success: true,
      message: "Article deleted and rankings rolled back successfully",
    });
  } catch (error) {
    console.error("[API] Error deleting article:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete article" },
      { status: 500 }
    );
  }
}