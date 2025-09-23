import { currentUser } from "@clerk/nextjs/server";
import { type NextRequest, NextResponse } from "next/server";
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

    if (!isAuthDisabled) {
      // In production, verify authentication and admin status
      console.log("[API] Checking authentication...");

      try {
        // Get current user to check admin status
        const user = await currentUser();
        console.log("[API] Current user ID:", user?.id);
        console.log("[API] User publicMetadata:", user?.publicMetadata);

        if (!user) {
          console.log("[API] No authenticated user found");
          return NextResponse.json(
            {
              error: "Unauthorized",
              message: "Authentication required. Please sign in to access this resource.",
              code: "AUTH_REQUIRED",
            },
            {
              status: 401,
              headers: {
                "Content-Type": "application/json",
                "WWW-Authenticate": "Bearer",
              },
            }
          );
        }

        // Check if user has admin privileges
        const isAdmin = user.publicMetadata?.isAdmin === true;
        console.log("[API] User isAdmin:", isAdmin);

        if (!isAdmin) {
          console.log("[API] User lacks admin privileges");
          return NextResponse.json(
            {
              error: "Forbidden",
              message: "Admin access required. Your account does not have admin privileges.",
              code: "ADMIN_REQUIRED",
              userId: user.id,
              help: "To grant admin access, update your Clerk user's publicMetadata with: { isAdmin: true }",
            },
            {
              status: 403,
              headers: {
                "Content-Type": "application/json",
              },
            }
          );
        }

        console.log("[API] Authentication successful - user is admin");
      } catch (authError) {
        console.error("[API] Authentication error:", authError);
        return NextResponse.json(
          {
            error: "Authentication Error",
            message: "Failed to verify authentication status.",
            details: authError instanceof Error ? authError.message : "Unknown error",
          },
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
      }
    } else {
      console.log("[API] Skipping authentication - auth is disabled");
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
