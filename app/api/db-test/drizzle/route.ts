import { count, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { articles } from "@/lib/db/article-schema";
import { getDb } from "@/lib/db/connection";

export async function GET() {
  try {
    const useDatabase = process.env["USE_DATABASE"];
    if (useDatabase !== "true") {
      return NextResponse.json({
        error: "Database disabled",
        USE_DATABASE: useDatabase,
      });
    }

    // Get Drizzle connection
    const db = getDb();
    if (!db) {
      return NextResponse.json({
        error: "getDb() returned null",
        hint: "This means database connection failed or is disabled",
      });
    }

    // Test Drizzle query - count articles
    const countResult = await db.select({ total: count() }).from(articles);

    const articleCount = countResult[0]?.total || 0;

    // Get sample article
    const sampleArticles = await db
      .select({
        id: articles.id,
        title: articles.title,
        createdAt: articles.createdAt,
      })
      .from(articles)
      .orderBy(desc(articles.createdAt))
      .limit(1);

    return NextResponse.json({
      status: "success",
      connection: "drizzle-orm",
      articleCount: articleCount,
      sampleArticle: sampleArticles[0] || null,
      dbInstance: !!db,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        stack: error instanceof Error ? error.stack?.split("\n").slice(0, 3) : undefined,
        hint: "Drizzle ORM query failed - check schema alignment",
      },
      { status: 500 }
    );
  }
}
