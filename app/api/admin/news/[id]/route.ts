import { type NextRequest, NextResponse } from "next/server";
import { adminEditBodyToUpdates, toAdminEditArticle } from "@/lib/admin-news-edit";
import { requireAdmin } from "@/lib/api-auth";
import { ArticlesRepository } from "@/lib/db/repositories/articles.repository";
import { loggers } from "@/lib/logger";

/**
 * GET /api/admin/news/[id]
 * Get a single news article by ID
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Check admin authentication
  const authResult = await requireAdmin();
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const { id } = await params;
    const articlesRepo = new ArticlesRepository();
    const article = await articlesRepo.findById(id);

    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    // #434: the edit page reads snake_case keys; the raw drizzle row is camelCase.
    return NextResponse.json({
      success: true,
      article: toAdminEditArticle(article),
    });
  } catch (error) {
    loggers.api.error("Error in admin/news/[id] GET", { error });
    return NextResponse.json({ error: "Failed to load article" }, { status: 500 });
  }
}

/**
 * PUT /api/admin/news/[id]
 * Update a news article
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Check admin authentication
  const authResult = await requireAdmin();
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const { id } = await params;
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const articlesRepo = new ArticlesRepository();

    // Check if article exists
    const existingArticle = await articlesRepo.findById(id);
    if (!existingArticle) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    // Validate required fields
    if (!body.title && !existingArticle.title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    // #434: map the page's snake_case fields to columns; drizzle `.set` ignores unknown keys.
    const mapped = adminEditBodyToUpdates(body, existingArticle);
    if ("error" in mapped) {
      return NextResponse.json({ error: mapped.error }, { status: 400 });
    }

    // Update the article
    const updatedArticle = await articlesRepo.updateArticle(id, {
      ...mapped.updates,
      updatedAt: new Date(),
    });

    loggers.api.info("Article updated", { articleId: id });

    return NextResponse.json({
      success: true,
      article: updatedArticle ? toAdminEditArticle(updatedArticle) : null,
    });
  } catch (error) {
    loggers.api.error("Error in admin/news/[id] PUT", { error });
    return NextResponse.json({ error: "Failed to update article" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/news/[id]
 * Delete a news article
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check admin authentication
  const authResult = await requireAdmin();
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const { id } = await params;
    const articlesRepo = new ArticlesRepository();

    // Check if article exists
    const existingArticle = await articlesRepo.findById(id);
    if (!existingArticle) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    // Delete the article
    await articlesRepo.deleteArticle(id);

    loggers.api.info("Article deleted", { articleId: id });

    return NextResponse.json({
      success: true,
      deleted: {
        id: existingArticle.id,
        title: existingArticle.title,
      },
    });
  } catch (error) {
    loggers.api.error("Error in admin/news/[id] DELETE", { error });
    return NextResponse.json({ error: "Failed to delete article" }, { status: 500 });
  }
}
