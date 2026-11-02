import { type NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/connection";
import { loggers } from "@/lib/logger";
import { loadNewsArticle } from "@/lib/news-article";

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

    // #368: the article page reads through the same function, with no HTTP hop.
    // See #109 and #187: the primary tool and tool tags come from the tool catalogue.
    const detail = await loadNewsArticle(slug, "/api/news/[slug]");

    if (!detail) {
      return NextResponse.json(
        {
          error: "Article not found",
          message: "The requested article could not be found.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      article: detail.article,
      tool: detail.tool,
      tools: detail.tools, // #187
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
