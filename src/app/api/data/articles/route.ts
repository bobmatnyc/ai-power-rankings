import { NextResponse } from "next/server";
import { isAuthenticatedManual } from "@/lib/manual-auth";

/**
 * Articles endpoint using manual authentication
 * This bypasses Clerk's middleware to avoid HTML error responses
 */
export async function GET() {
  try {
    console.log("[articles-manual] Starting articles request");

    // Check authentication using manual approach
    const isAuth = await isAuthenticatedManual();
    console.log("[articles-manual] Manual authentication result:", isAuth);

    if (!isAuth) {
      console.log("[articles-manual] User not authenticated, returning 401");
      return NextResponse.json(
        {
          error: "Unauthorized",
          message: "Admin session required for articles access",
          authenticated: false,
          timestamp: new Date().toISOString()
        },
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    console.log("[articles-manual] User authenticated, fetching articles data");

    // Mock articles data for now (in real implementation, this would query the database)
    const articles = [
      {
        id: 1,
        title: "AI Power Rankings Update",
        excerpt: "Latest updates to our AI power rankings methodology",
        created_at: new Date().toISOString(),
        status: "published",
        author: "System"
      },
      {
        id: 2,
        title: "New AI Tools Analysis",
        excerpt: "Comprehensive analysis of emerging AI tools",
        created_at: new Date().toISOString(),
        status: "draft",
        author: "System"
      }
    ];

    const response = {
      articles,
      total: articles.length,
      timestamp: new Date().toISOString(),
      authMethod: "manual-cookie",
      authenticated: true,
      message: "Articles retrieved successfully"
    };

    console.log("[articles-manual] Returning articles data");
    return NextResponse.json(response, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("[articles-manual] Error getting articles:", error);

    const errorResponse = {
      error: "Failed to get articles",
      message: error instanceof Error ? error.message : "Unknown error",
      articles: [],
      total: 0,
      timestamp: new Date().toISOString(),
      authMethod: "manual-cookie",
      stack: process.env["NODE_ENV"] === "development" && error instanceof Error ? error.stack : undefined,
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