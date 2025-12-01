import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAuthenticated } from "@/lib/clerk-auth";
import { getDb } from "@/lib/db/connection";
import { ArticleDatabaseService } from "@/lib/services/article-db-service";
import { ArticleIngestionSchema } from "@/lib/services/article-ingestion.service";
import { invalidateArticleCache } from "@/lib/cache/invalidation.service";

/**
 * POST /api/admin/articles/ingest
 * Ingest a new article with optional dry-run mode
 */
export async function POST(request: NextRequest) {
  try {
    // Check admin authentication
    const isAuth = await isAuthenticated();
    if (!isAuth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check database availability
    const db = getDb();
    if (!db) {
      return NextResponse.json(
        { error: "Database connection not available. Please configure DATABASE_URL." },
        { status: 503 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const input = ArticleIngestionSchema.parse(body);

    console.log(`[API] Article ingestion request: type=${input.type}, dryRun=${input.dryRun}`);

    // Initialize database service
    const articleService = new ArticleDatabaseService();

    // Process the article
    const result = await articleService.ingestArticle(input);

    // Return appropriate response based on mode
    if (input.dryRun) {
      return NextResponse.json({
        success: true,
        mode: "dry_run",
        result,
        message: "Dry run completed successfully. No changes were saved.",
      });
    } else {
      // Invalidate all article-related caches after successful ingestion
      // Run asynchronously to not block response
      invalidateArticleCache().catch((error) => {
        console.error("[API] Failed to invalidate cache after article ingestion:", error);
      });

      return NextResponse.json({
        success: true,
        mode: "complete",
        result,
        message: "Article ingested and rankings updated successfully.",
      });
    }
  } catch (error) {
    console.error("[API] Article ingestion error:", error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid request data",
          details: error.issues,
        },
        { status: 400 }
      );
    }

    // Handle other errors
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 }
    );
  }
}
