import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * GET /api/admin/db-direct-test
 * Test database directly without using repository
 */
interface TestResult {
  [key: string]: unknown;
}

export async function GET() {
  try {
    // Check authentication
    const user = await currentUser();
    const isAdmin = user?.publicMetadata?.isAdmin === true;

    if (!user || !isAdmin) {
      return NextResponse.json({ error: "Unauthorized - Admin access required" }, { status: 401 });
    }

    const tests: TestResult = {};
    const results: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      tests,
    };

    // Test 1: Check environment variables
    tests["environment"] = {
      USE_DATABASE: process.env["USE_DATABASE"],
      USE_DATABASE_IS_TRUE: process.env["USE_DATABASE"] === "true",
      DATABASE_URL_EXISTS: !!process.env["DATABASE_URL"],
      DATABASE_URL_LENGTH: process.env["DATABASE_URL"]?.length || 0,
    };

    // Test 2: Try to get database connection
    try {
      const { getDb } = await import("@/lib/db/connection");
      const db = getDb();

      tests["getDb"] = {
        success: !!db,
        hasConnection: !!db,
        connectionType: db ? typeof db : "null",
      };

      if (db) {
        // Test 3: Try a simple query using Drizzle
        try {
          const { sql } = await import("drizzle-orm");
          const testQuery = await db.execute(sql`SELECT 1 as test`);
          tests["simpleQuery"] = {
            success: true,
            result: testQuery,
          };
        } catch (queryErr: unknown) {
          tests["simpleQuery"] = {
            success: false,
            error: queryErr instanceof Error ? queryErr.message : "Unknown error",
          };
        }

        // Test 4: Try to count articles
        try {
          const { articles } = await import("@/lib/db/article-schema");
          const { sql } = await import("drizzle-orm");

          const countResult = await db.select({ count: sql`count(*)` }).from(articles);

          tests["articlesCount"] = {
            success: true,
            count: countResult[0]?.count || 0,
          };
        } catch (countErr: unknown) {
          tests["articlesCount"] = {
            success: false,
            error: countErr instanceof Error ? countErr.message : "Unknown error",
          };
        }
      } else {
        tests["connectionFailed"] = {
          reason: "getDb() returned null",
          possibleCauses: [
            "USE_DATABASE is not 'true'",
            "DATABASE_URL is missing or invalid",
            "Connection error occurred",
          ],
        };
      }
    } catch (importErr: unknown) {
      tests["importError"] = {
        success: false,
        error: importErr instanceof Error ? importErr.message : "Unknown error",
        stack: importErr instanceof Error ? importErr.stack : undefined,
      };
    }

    // Test 5: Try ArticlesRepository
    try {
      const { ArticlesRepository } = await import("@/lib/db/repositories/articles.repository");
      const repo = new ArticlesRepository();
      tests["repository"] = {
        success: true,
        message: "ArticlesRepository created successfully",
      };

      // Try to get articles
      try {
        const articles = await repo.getArticles({ limit: 1 });
        tests["getArticles"] = {
          success: true,
          count: articles.length,
        };
      } catch (getErr: unknown) {
        tests["getArticles"] = {
          success: false,
          error: getErr instanceof Error ? getErr.message : "Unknown error",
        };
      }
    } catch (repoErr: unknown) {
      tests["repository"] = {
        success: false,
        error: repoErr instanceof Error ? repoErr.message : "Unknown error",
        stack: repoErr instanceof Error ? repoErr.stack : undefined,
      };
    }

    return NextResponse.json(results, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error: unknown) {
    console.error("Direct DB test error:", error);
    return NextResponse.json(
      {
        error: "Test Failed",
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
