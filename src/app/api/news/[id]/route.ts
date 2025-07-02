import { type NextRequest, NextResponse } from "next/server";
import { getNewsRepo } from "@/lib/json-db";
import { loggers } from "@/lib/logger";

// GET single news article by ID
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const newsRepo = getNewsRepo();
    const article = await newsRepo.getById(id);

    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    return NextResponse.json({ article });
  } catch (error) {
    loggers.api.error("Get news article error", { error, id });

    return NextResponse.json(
      {
        error: "Failed to fetch article",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// UPDATE news article
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    // TODO: Add authentication check here

    const body = await request.json();
    const newsRepo = getNewsRepo();

    // Get existing article
    const existing = await newsRepo.getById(id);
    if (!existing) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    // Update article
    const updatedArticle = {
      ...existing,
      ...body,
      id: id, // Ensure ID doesn't change
      updated_at: new Date().toISOString(),
    };

    await newsRepo.upsert(updatedArticle);

    return NextResponse.json({
      success: true,
      article: updatedArticle,
    });
  } catch (error) {
    loggers.api.error("Update news article error", { error, id });

    return NextResponse.json(
      {
        error: "Failed to update article",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// DELETE news article
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    // TODO: Add authentication check here

    const newsRepo = getNewsRepo();
    const deleted = await newsRepo.delete(id);

    if (!deleted) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Article deleted successfully",
    });
  } catch (error) {
    loggers.api.error("Delete news article error", { error, id });

    return NextResponse.json(
      {
        error: "Failed to delete article",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
