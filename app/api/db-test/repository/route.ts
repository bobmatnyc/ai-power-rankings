import { NextResponse } from "next/server";
import { ArticlesRepository } from "@/lib/db/repositories/articles.repository";

export async function GET() {
  try {
    const useDatabase = process.env["USE_DATABASE"];
    if (useDatabase !== "true") {
      return NextResponse.json({
        error: "Database disabled",
        USE_DATABASE: useDatabase,
      });
    }

    // Test ArticlesRepository
    const repository = new ArticlesRepository();

    // Try to get articles
    const articlesResult = await repository.getArticles({
      limit: 5,
      offset: 0,
    });

    // Try to get stats
    const stats = await repository.getArticleStats();

    return NextResponse.json({
      status: "success",
      connection: "repository-pattern",
      articleCount: stats.totalArticles,
      articlesRetrieved: articlesResult.length,
      firstArticle: articlesResult[0]
        ? {
            id: articlesResult[0].id,
            title: articlesResult[0].title,
          }
        : null,
      stats: stats,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        stack: error instanceof Error ? error.stack?.split("\n").slice(0, 3) : undefined,
        hint: "Repository pattern failed - check ArticlesRepository implementation",
      },
      { status: 500 }
    );
  }
}
