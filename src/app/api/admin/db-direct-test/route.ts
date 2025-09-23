import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * GET /api/admin/db-direct-test
 * Test database directly without using repository
 */
export async function GET() {
  try {
    // Check authentication
    const user = await currentUser();
    const isAdmin = user?.publicMetadata?.isAdmin === true;

    if (!user || !isAdmin) {
      return NextResponse.json({ error: "Unauthorized - Admin access required" }, { status: 401 });
    }

    const results: any = {
      timestamp: new Date().toISOString(),
      tests: {},
    };

    // Test 1: Check environment variables
    results.tests.environment = {
      USE_DATABASE: process.env["USE_DATABASE"],
      USE_DATABASE_IS_TRUE: process.env["USE_DATABASE"] === "true",
      DATABASE_URL_EXISTS: !!process.env["DATABASE_URL"],
      DATABASE_URL_LENGTH: process.env["DATABASE_URL"]?.length || 0,
    };

    // Test 2: Try to get database connection
    try {
      const { getDb } = await import("@/lib/db/connection");
      const db = getDb();

      results.tests.getDb = {
        success: !!db,
        hasConnection: !!db,
        connectionType: db ? typeof db : "null",
      };

      if (db) {
        // Test 3: Try a simple query using Drizzle
        try {
          const { sql } = await import("drizzle-orm");
          const testQuery = await db.execute(sql`SELECT 1 as test`);
          results.tests.simpleQuery = {
            success: true,
            result: testQuery,
          };
        } catch (queryErr: any) {
          results.tests.simpleQuery = {
            success: false,
            error: queryErr.message,
          };
        }

        // Test 4: Try to count articles
        try {
          const { articles } = await import("@/lib/db/article-schema");
          const { sql } = await import("drizzle-orm");

          const countResult = await db.select({ count: sql`count(*)` }).from(articles);

          results.tests.articlesCount = {
            success: true,
            count: countResult[0]?.count || 0,
          };
        } catch (countErr: any) {
          results.tests.articlesCount = {
            success: false,
            error: countErr.message,
          };
        }
      } else {
        results.tests.connectionFailed = {
          reason: "getDb() returned null",
          possibleCauses: [
            "USE_DATABASE is not 'true'",
            "DATABASE_URL is missing or invalid",
            "Connection error occurred",
          ],
        };
      }
    } catch (importErr: any) {
      results.tests.importError = {
        success: false,
        error: importErr.message,
        stack: importErr.stack,
      };
    }

    // Test 5: Try ArticlesRepository
    try {
      const { ArticlesRepository } = await import("@/lib/db/repositories/articles.repository");
      const repo = new ArticlesRepository();
      results.tests.repository = {
        success: true,
        message: "ArticlesRepository created successfully",
      };

      // Try to get articles
      try {
        const articles = await repo.getArticles({ limit: 1 });
        results.tests.getArticles = {
          success: true,
          count: articles.length,
        };
      } catch (getErr: any) {
        results.tests.getArticles = {
          success: false,
          error: getErr.message,
        };
      }
    } catch (repoErr: any) {
      results.tests.repository = {
        success: false,
        error: repoErr.message,
        stack: repoErr.stack,
      };
    }

    return NextResponse.json(results, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error: any) {
    console.error("Direct DB test error:", error);
    return NextResponse.json(
      {
        error: "Test Failed",
        message: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}
