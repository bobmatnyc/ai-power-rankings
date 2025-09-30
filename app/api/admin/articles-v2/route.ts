import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/connection";
import { ArticlesRepository } from "@/lib/db/repositories/articles.repository";

// Force Node.js runtime
export const runtime = "nodejs";

export async function GET() {
  try {
    console.log("[articles-v2] Starting request");

    // Check if auth is disabled
    const isAuthDisabled = process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";
    console.log("[articles-v2] Auth disabled:", isAuthDisabled);

    if (!isAuthDisabled) {
      // Use Clerk auth directly
      console.log("[articles-v2] Checking auth...");
      const authResult = await auth();
      console.log("[articles-v2] Auth result - userId:", authResult?.userId);

      if (!authResult?.userId) {
        return NextResponse.json(
          { error: "Unauthorized", message: "Authentication required" },
          { status: 401 }
        );
      }

      // For now, skip admin check to isolate the issue
      console.log("[articles-v2] User authenticated, proceeding...");
    }

    // Check database
    const db = getDb();
    if (!db) {
      return NextResponse.json({ error: "Database not available" }, { status: 503 });
    }

    // Get articles
    const articlesRepo = new ArticlesRepository();
    const articles = await articlesRepo.getArticles({
      limit: 10,
      offset: 0,
      status: "active",
    });

    return NextResponse.json({
      articles: articles.slice(0, 10),
      count: articles.length,
      version: "v2",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[articles-v2] Error:", error);
    return NextResponse.json(
      {
        error: "Failed",
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
