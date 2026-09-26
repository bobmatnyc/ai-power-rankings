import { type NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/connection";
import { ArticlesRepository } from "@/lib/db/repositories/articles.repository";
import { requireAdmin } from "@/lib/api-auth";

// Let Next.js auto-detect runtime - avoid conflicts with middleware

/**
 * GET /api/admin/articles
 * List all articles with filtering options
 */
export async function GET(request: NextRequest) {
  console.log("[API] Articles endpoint - Request received");

  // requireAdmin() applies the auth-disabled flag only in local development.
  const authResult = await requireAdmin();
  if (authResult.error) {
    return authResult.error;
  }

  try {
    // Check database availability
    console.log("[API] Getting database connection...");
    const db = getDb();
    console.log("[API] Database connection available:", !!db);

    if (!db) {
      console.log("[API] Articles endpoint - database not available");
      return NextResponse.json({ error: "Database connection not available" }, { status: 503 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "active";
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const includeStats = searchParams.get("includeStats") === "true";

    console.log(
      `[API] Articles endpoint - fetching articles with status=${status}, limit=${limit}, offset=${offset}, includeStats=${includeStats}`
    );

    const articlesRepo = new ArticlesRepository();

    // Get articles
    console.log("[API] Calling articlesRepo.getArticles...");
    const articles = await articlesRepo.getArticles({
      status,
      limit,
      offset,
    });

    console.log(`[API] Articles endpoint - found ${articles.length} articles`);
    if (articles.length > 0) {
      console.log("[API] First article sample:", JSON.stringify(articles[0], null, 2));
    }

    // Get statistics if requested
    let stats: Awaited<ReturnType<typeof articlesRepo.getArticleStats>> | undefined;
    if (includeStats) {
      console.log("[API] Getting article stats...");
      stats = await articlesRepo.getArticleStats();
      console.log("[API] Stats result:", stats);
    }

    const responseData = {
      articles,
      stats,
      pagination: {
        limit,
        offset,
        total: stats?.totalArticles || articles.length,
      },
    };

    console.log("[API] Sending response with", articles.length, "articles");

    return NextResponse.json(responseData, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    console.error("[API] Error fetching articles - Full error:", error);
    console.error("[API] Error stack:", error instanceof Error ? error.stack : "No stack");
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Failed to fetch articles",
        details:
          process.env["NODE_ENV"] === "development"
            ? error instanceof Error
              ? error.stack
              : "Unknown error"
            : undefined,
      },
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}
