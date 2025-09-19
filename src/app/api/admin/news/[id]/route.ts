import { type NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/clerk-auth";
import { getNewsRepo } from "@/lib/json-db";
import type { NewsArticle } from "@/lib/json-db/schemas";
import { loggers } from "@/lib/logger";

/**
 * GET /api/admin/news/[id]
 * Get a single news article by ID
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async (): Promise<NextResponse> => {
    try {
      const { id } = await params;
      const newsRepo = getNewsRepo();
      const article = await newsRepo.getById(id);

      if (!article) {
        return NextResponse.json(
          { error: "Article not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        article,
      });
    } catch (error) {
      loggers.api.error("Error in admin/news/[id] GET", { error });
      return NextResponse.json(
        { error: "Failed to load article" },
        { status: 500 }
      );
    }
  });
}

/**
 * PUT /api/admin/news/[id]
 * Update a news article
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async (): Promise<NextResponse> => {
    try {
      const { id } = await params;
      const body = await request.json();
      const newsRepo = getNewsRepo();

      // Check if article exists
      const existingArticle = await newsRepo.getById(id);
      if (!existingArticle) {
        return NextResponse.json(
          { error: "Article not found" },
          { status: 404 }
        );
      }

      // Merge updates with existing article
      const updatedArticle: NewsArticle = {
        ...existingArticle,
        ...body,
        id, // Ensure ID cannot be changed
        slug: body.slug || existingArticle.slug,
        created_at: existingArticle.created_at, // Preserve original creation date
        updated_at: new Date().toISOString(),
      };

      // Validate required fields
      if (!updatedArticle.title || !updatedArticle.content) {
        return NextResponse.json(
          { error: "Title and content are required" },
          { status: 400 }
        );
      }

      // Save the updated article
      await newsRepo.upsert(updatedArticle);

      loggers.api.info("Article updated", { articleId: id });

      return NextResponse.json({
        success: true,
        article: updatedArticle,
      });
    } catch (error) {
      loggers.api.error("Error in admin/news/[id] PUT", { error });
      return NextResponse.json(
        { error: "Failed to update article" },
        { status: 500 }
      );
    }
  });
}

/**
 * DELETE /api/admin/news/[id]
 * Delete a news article
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async (): Promise<NextResponse> => {
    try {
      const { id } = await params;
      const newsRepo = getNewsRepo();

      // Check if article exists
      const existingArticle = await newsRepo.getById(id);
      if (!existingArticle) {
        return NextResponse.json(
          { error: "Article not found" },
          { status: 404 }
        );
      }

      // Delete the article
      const deleted = await newsRepo.delete(id);

      if (!deleted) {
        return NextResponse.json(
          { error: "Failed to delete article" },
          { status: 500 }
        );
      }

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
      return NextResponse.json(
        { error: "Failed to delete article" },
        { status: 500 }
      );
    }
  });
}