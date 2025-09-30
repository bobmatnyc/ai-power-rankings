import { NextResponse } from "next/server";

interface TestResult {
  status: "PASS" | "FAIL" | "SKIP";
  message?: string;
  error?: string;
  [key: string]: unknown;
}

/**
 * GET /api/public-db-test
 * Public database test endpoint (no authentication required)
 * Used to diagnose production database issues
 */
export async function GET() {
  try {
    const tests: Record<string, TestResult> = {};

    const results = {
      timestamp: new Date().toISOString(),
      environment: {
        NODE_ENV: process.env["NODE_ENV"] || "not set",
        USE_DATABASE: process.env["USE_DATABASE"] || "not set",
        DATABASE_URL_EXISTS: !!process.env["DATABASE_URL"],
        DATABASE_URL_LENGTH: process.env["DATABASE_URL"]?.length || 0,
      },
      tests,
    };

    // Test 1: Environment check
    const dbUrl = process.env["DATABASE_URL"];
    const useDb = process.env["USE_DATABASE"];

    tests["environment"] = {
      status: dbUrl && useDb === "true" ? "PASS" : "FAIL",
      hasDbUrl: !!dbUrl,
      useDbIsTrue: useDb === "true",
      shouldConnect: useDb === "true" && !!dbUrl && !dbUrl?.includes("YOUR_PASSWORD"),
    };

    // Test 2: Try database connection if configured
    if (useDb === "true" && dbUrl && !dbUrl.includes("YOUR_PASSWORD")) {
      try {
        // Test direct Neon connection
        const { neon } = await import("@neondatabase/serverless");
        const sql = neon(dbUrl);

        tests["neonConnection"] = {
          status: "PASS",
          message: "Neon client created successfully",
        };

        try {
          // Test basic query
          const timeResult = await sql`SELECT NOW() as current_time`;
          tests["basicQuery"] = {
            status: "PASS",
            message: "Basic query successful",
            serverTime: timeResult?.[0]?.["current_time"],
          };

          try {
            // Test the specific query that's failing
            const articlesCountResult = await sql`SELECT COUNT(*) as count FROM articles`;
            tests["articlesCount"] = {
              status: "PASS",
              message: "Articles count query successful",
              count: articlesCountResult?.[0]?.["count"],
            };

            try {
              // Test the ORDER BY query that's failing in production
              const articlesOrderResult = await sql`
                SELECT id, title, published_date, status
                FROM articles
                ORDER BY published_date DESC
                LIMIT 3
              `;

              tests["articlesOrderQuery"] = {
                status: "PASS",
                message: "Articles ORDER BY query successful",
                rowCount: articlesOrderResult.length,
                firstRow: articlesOrderResult[0]
                  ? {
                      id: articlesOrderResult[0]?.["id"],
                      title: articlesOrderResult[0]?.["title"]?.toString().substring(0, 50),
                      published_date: articlesOrderResult[0]?.["published_date"],
                      status: articlesOrderResult[0]?.["status"],
                    }
                  : null,
              };
            } catch (orderError) {
              tests["articlesOrderQuery"] = {
                status: "FAIL",
                message: "Articles ORDER BY query failed - THIS IS THE PRODUCTION ERROR",
                error: orderError instanceof Error ? orderError.message : String(orderError),
                errorType:
                  orderError instanceof Error ? orderError.constructor.name : typeof orderError,
              };
            }
          } catch (countError) {
            tests["articlesCount"] = {
              status: "FAIL",
              message: "Articles count query failed",
              error: countError instanceof Error ? countError.message : String(countError),
            };
          }
        } catch (queryError) {
          tests["basicQuery"] = {
            status: "FAIL",
            message: "Basic query failed",
            error: queryError instanceof Error ? queryError.message : String(queryError),
          };
        }
      } catch (connectionError) {
        tests["neonConnection"] = {
          status: "FAIL",
          message: "Failed to create Neon connection",
          error:
            connectionError instanceof Error ? connectionError.message : String(connectionError),
        };
      }
    } else {
      tests["connectionSkipped"] = {
        status: "SKIP",
        reason: !useDb
          ? "USE_DATABASE not set"
          : useDb !== "true"
            ? "USE_DATABASE is not 'true'"
            : !dbUrl
              ? "DATABASE_URL not set"
              : "DATABASE_URL has placeholder",
      };
    }

    // Test 3: Try Drizzle connection
    try {
      const { getDb } = await import("@/lib/db/connection");
      const db = getDb();

      if (db) {
        tests["drizzleConnection"] = {
          status: "PASS",
          message: "Drizzle connection established",
        };

        try {
          // Test Articles Repository
          const { ArticlesRepository } = await import("@/lib/db/repositories/articles.repository");
          const repo = new ArticlesRepository();

          const articles = await repo.getArticles({ limit: 2 });
          tests["articlesRepository"] = {
            status: "PASS",
            message: "ArticlesRepository.getArticles() successful",
            count: articles.length,
          };
        } catch (repoError) {
          tests["articlesRepository"] = {
            status: "FAIL",
            message: "ArticlesRepository.getArticles() failed",
            error: repoError instanceof Error ? repoError.message : String(repoError),
          };
        }
      } else {
        tests["drizzleConnection"] = {
          status: "FAIL",
          message: "getDb() returned null",
        };
      }
    } catch (drizzleError) {
      tests["drizzleConnection"] = {
        status: "FAIL",
        message: "Failed to import Drizzle",
        error: drizzleError instanceof Error ? drizzleError.message : String(drizzleError),
      };
    }

    // Summary
    const allTests = Object.values(tests);
    const passedTests = allTests.filter((t) => t.status === "PASS").length;
    const failedTests = allTests.filter((t) => t.status === "FAIL").length;

    const summary = {
      totalTests: allTests.length,
      passed: passedTests,
      failed: failedTests,
      status: failedTests === 0 ? "healthy" : failedTests < passedTests ? "degraded" : "unhealthy",
    };

    return NextResponse.json(
      { ...results, summary },
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("Public DB test error:", error);
    return NextResponse.json(
      {
        error: "Test Failed",
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
