import { type NextRequest, NextResponse } from "next/server";
import { cachedJsonResponse } from "@/lib/api-cache";
import { getDb } from "@/lib/db/connection";
import { NewsRepository } from "@/lib/db/repositories/news";
import { ToolsRepository } from "@/lib/db/repositories/tools.repository";
import { loggers } from "@/lib/logger";

/**
 * Combined endpoint for "What's New" modal
 * Fetches tools, news, and changelog in a single optimized query
 */
export async function GET(request: NextRequest) {
  try {
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

    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get("days") || "7", 10);

    loggers.api.debug("Fetching What's New data", { days });

    // Calculate date threshold
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - days);

    // Fetch all data in parallel for maximum performance
    const [newsResult, toolsResult] = await Promise.all([
      // Fetch recent news
      (async () => {
        const newsRepo = new NewsRepository();
        const { articles: allNews } = await newsRepo.getPaginated(100, 0);

        const recentNews = allNews
          .filter((article) => {
            const articleDate = new Date(article.publishedAt);
            return articleDate >= dateThreshold;
          })
          .sort((a, b) => {
            const dateA = new Date(a.publishedAt);
            const dateB = new Date(b.publishedAt);
            return dateB.getTime() - dateA.getTime();
          })
          .slice(0, 10)
          .map((article) => {
            return {
              id: article.id,
              slug: article.slug,
              title: article.title,
              summary: article.summary || article.content.substring(0, 150) + "...",
              published_at: article.publishedAt,
              source: article.source || "AI News",
              source_url: article.sourceUrl,
            };
          });

        return recentNews;
      })(),

      // Fetch recent tool updates
      (async () => {
        const toolsRepo = new ToolsRepository();
        const allTools = await toolsRepo.findAll();

        const recentTools = allTools
          .filter((tool): tool is typeof tool & { updated_at: string } => {
            if (!tool.updated_at) return false;
            const toolDate = new Date(tool.updated_at);
            return !isNaN(toolDate.getTime()) && toolDate >= dateThreshold;
          })
          .sort((a, b) => {
            const dateA = new Date(a.updated_at);
            const dateB = new Date(b.updated_at);
            return dateB.getTime() - dateA.getTime();
          })
          .slice(0, 10)
          .map((tool) => ({
            id: tool.id,
            name: tool.name,
            slug: tool.slug,
            description: (tool as any).description || "",
            updatedAt: tool.updated_at,
            category: tool.category,
          }));

        return recentTools;
      })(),
    ]);

    // Changelog data (static for now, can be made dynamic later)
    const changelogItems = [
      {
        id: "1",
        title: "Clerk Authentication Fixed",
        description: "Server-side session recognition now working with async/await pattern",
        date: new Date().toISOString(),
        category: "Authentication",
        type: "fix" as const,
        version: "0.1.2",
      },
      {
        id: "2",
        title: "Category Count Accuracy",
        description: "Sidebar category counts now match rankings page display",
        date: new Date().toISOString(),
        category: "UI",
        type: "fix" as const,
        version: "0.1.2",
      },
    ];

    return cachedJsonResponse(
      {
        news: newsResult,
        tools: toolsResult,
        changelog: changelogItems,
        days,
        _source: "database",
        _timestamp: new Date().toISOString(),
      },
      "/api/whats-new",
      60 // Cache for 1 minute
    );
  } catch (error) {
    loggers.api.error("What's New API error", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        error: "Internal server error",
        message: "An error occurred while fetching updates. Please try again later.",
      },
      { status: 500 }
    );
  }
}
