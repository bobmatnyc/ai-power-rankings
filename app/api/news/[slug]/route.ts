import { type NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/connection";
import { NewsRepository } from "@/lib/db/repositories/news";
import { ToolsRepository } from "@/lib/db/repositories/tools.repository";
import { loggers } from "@/lib/logger";
import { findToolByText } from "@/lib/tool-matcher";

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
    const toolsRepo = new ToolsRepository();

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

    // Parse the JSONB data field if it exists
    const articleData = article.data || {};

    // Get tool mentions from database or data field
    const toolMentions = article.toolMentions || (articleData as any)?.tool_mentions || [];

    // Try to extract tool from title using the term mapping
    const matchedSlug = findToolByText(article.title);
    let matchingTool = null;

    if (matchedSlug) {
      matchingTool = await toolsRepo.findBySlug(matchedSlug);
    }

    // If no match in title, check tool_mentions
    if (!matchingTool && toolMentions.length > 0) {
      const firstToolName = toolMentions[0];
      // Try to find tool by slug or name
      matchingTool = await toolsRepo.findBySlug(
        firstToolName.toLowerCase().replace(/\s+/g, "-")
      );
    }

    // Transform to the format expected by the frontend
    const transformedArticle = {
      id: article.id,
      slug: article.slug,
      title: article.title,
      content: (articleData as any)?.content || article.summary || "",
      summary: article.summary,
      published_date: article.publishedAt || article.createdAt || new Date().toISOString(),
      source: article.source || (articleData as any)?.source || "AI News",
      source_url: article.sourceUrl || (articleData as any)?.source_url,
      tags: (articleData as any)?.tags || [],
      tool_mentions: toolMentions,
      created_at: article.createdAt,
      updated_at: article.updatedAt,
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