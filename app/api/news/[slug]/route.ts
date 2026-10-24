import { type NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/connection";
import { NewsRepository } from "@/lib/db/repositories/news";
import { loggers } from "@/lib/logger";
import { loadNewsToolCatalogueOrNull } from "@/lib/news-tool-catalogue";
import { primaryArticleTool } from "@/lib/news-tool-resolver";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;

    // Ensure database connection is available
    const db = getDb();
    if (!db) {
      loggers.api.error("Database connection not available");
      return NextResponse.json(
        {
          error: "Database connection unavailable",
          message: "The database service is currently unavailable. Please try again later.",
        },
        { status: 503 }
      );
    }

    loggers.api.debug("Getting news article by slug", { slug });

    const newsRepo = new NewsRepository();

    // Get the specific news article by slug
    const article = await newsRepo.getBySlug(slug);

    if (!article) {
      return NextResponse.json(
        {
          error: "Article not found",
          message: "The requested article could not be found.",
        },
        { status: 404 }
      );
    }

    // Get tool mentions from database
    const toolMentions = article.toolMentions || [];

    // #109: the primary tool comes from the tool catalogue only (stored mention
    // ids, then exact names, then whole-word title matches). A failed catalogue
    // read is logged and leaves `tool` null; the article is still served.
    const catalogue = await loadNewsToolCatalogueOrNull("/api/news/[slug]");
    // See #109: the same primary-tool rule as /api/news and the tool page.
    const matchingTool = catalogue ? primaryArticleTool(article, catalogue) : null;

    // Transform to the format expected by the frontend
    const transformedArticle = {
      id: article.id,
      slug: article.slug,
      title: article.title,
      content: article.content || article.summary || "",
      summary: article.summary,
      published_date: article.publishedAt.toISOString(),
      source: article.source || "AI News",
      source_url: article.sourceUrl,
      tags: article.tags || [],
      tool_mentions: toolMentions,
      created_at: article.publishedAt.toISOString(),
      updated_at: article.publishedAt.toISOString(),
    };

    // Include matched tool if found
    let toolInfo = null;
    if (matchingTool) {
      toolInfo = {
        id: matchingTool.id,
        slug: matchingTool.slug,
        name: matchingTool.name,
        description: matchingTool.description,
        category: matchingTool.category,
        info: matchingTool.info || {},
      };
    }

    return NextResponse.json({
      article: transformedArticle,
      tool: toolInfo,
      _source: "database",
      _timestamp: new Date().toISOString(),
    });
  } catch (error) {
    loggers.api.error("News article API error", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        error: "Internal server error",
        message: "An error occurred while fetching the article. Please try again later.",
      },
      { status: 500 }
    );
  }
}