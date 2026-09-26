import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";

/**
 * GET /api/data/articles
 *
 * Why: Declared admin-only, but it used to accept any request that carried a
 * session cookie, whatever the cookie's value.
 * What: `requireAdmin()` verifies the Clerk session first (401 anonymous,
 * 403 non-admin), then returns the placeholder article list.
 * Test: `tests/unit/auth-hardening.test.ts`.
 */
export async function GET() {
  const authResult = await requireAdmin();
  if (authResult.error) {
    return authResult.error;
  }

  try {
    // Mock articles data for now (in real implementation, this would query the database)
    const articles = [
      {
        id: 1,
        title: "AI Power Rankings Update",
        excerpt: "Latest updates to our AI power rankings methodology",
        created_at: new Date().toISOString(),
        status: "published",
        author: "System",
      },
      {
        id: 2,
        title: "New AI Tools Analysis",
        excerpt: "Comprehensive analysis of emerging AI tools",
        created_at: new Date().toISOString(),
        status: "draft",
        author: "System",
      },
    ];

    const response = {
      articles,
      total: articles.length,
      timestamp: new Date().toISOString(),
      authMethod: "clerk",
      authenticated: true,
      message: "Articles retrieved successfully",
    };

    console.log("[data/articles] Returning articles data");
    return NextResponse.json(response, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("[data/articles] Error getting articles:", error);

    const errorResponse = {
      error: "Failed to get articles",
      message: error instanceof Error ? error.message : "Unknown error",
      articles: [],
      total: 0,
      timestamp: new Date().toISOString(),
      authMethod: "clerk",
      stack:
        process.env["NODE_ENV"] === "development" && error instanceof Error
          ? error.stack
          : undefined,
    };

    return NextResponse.json(errorResponse, {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}

// Use Node.js runtime
export const runtime = "nodejs";
