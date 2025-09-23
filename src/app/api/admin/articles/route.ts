import { type NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/clerk-auth";
import { getDb } from "@/lib/db/connection";
import { ArticlesRepository } from "@/lib/db/repositories/articles.repository";

/**
 * GET /api/admin/articles
 * List all articles with filtering options
 */
export async function GET(request: NextRequest) {
  console.log("[API] Articles endpoint - Request received");

  try {
    // Check if auth is disabled (development mode)
    const isAuthDisabled = process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";
    console.log("[API] Auth disabled mode:", isAuthDisabled);

    // Check admin authentication (automatically skipped in local dev)
    console.log("[API] Checking authentication...");
    const isAuth = await isAuthenticated();
    console.log("[API] Authentication result:", isAuth);

    if (!isAuth && !isAuthDisabled) {
      console.log("[API] Articles endpoint - unauthorized access attempt");
      // Add more detailed error for debugging
      return NextResponse.json(
        {
          error: "Unauthorized",
          details: "Authentication required. Please ensure you are logged in.",
          authDisabled: isAuthDisabled,
        },
        { status: 401 }
      );
    }

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

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("[API] Error fetching articles - Full error:", error);
    console.error("[API] Error stack:", error instanceof Error ? error.stack : "No stack");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch articles" },
      { status: 500 }
    );
  }
}
