import { currentUser } from "@clerk/nextjs/server";
import { neon } from "@neondatabase/serverless";
import { type NextRequest, NextResponse } from "next/server";

/**
 * GET /api/admin/db-test
 * Test database connection directly
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const user = await currentUser();
    const isAdmin = user?.publicMetadata?.isAdmin === true;

    if (!user || !isAdmin) {
      return NextResponse.json({ error: "Unauthorized - Admin access required" }, { status: 401 });
    }

    const results: Record<string, any> = {
      timestamp: new Date().toISOString(),
      environment: {
        NODE_ENV: process.env["NODE_ENV"],
        USE_DATABASE: process.env["USE_DATABASE"],
        NEXT_PUBLIC_USE_DATABASE: process.env["NEXT_PUBLIC_USE_DATABASE"],
        DATABASE_URL_EXISTS: !!process.env["DATABASE_URL"],
        DATABASE_URL_LENGTH: process.env["DATABASE_URL"]?.length || 0,
        DATABASE_URL_PREFIX: process.env["DATABASE_URL"]?.substring(0, 20) || "not set",
      },
      tests: {},
    };

    // Test 1: Check if DATABASE_URL is valid
    const dbUrl = process.env["DATABASE_URL"];
    if (!dbUrl) {
      results.tests.urlCheck = { status: "failed", error: "DATABASE_URL not found" };
    } else if (dbUrl.includes("YOUR_PASSWORD")) {
      results.tests.urlCheck = { status: "failed", error: "DATABASE_URL contains placeholder" };
    } else {
      results.tests.urlCheck = { status: "passed", message: "DATABASE_URL configured" };
    }

    // Test 2: Try to create connection
    if (dbUrl && !dbUrl.includes("YOUR_PASSWORD")) {
      try {
        const sql = neon(dbUrl);
        results.tests.connectionCreation = { status: "passed", message: "Neon client created" };

        // Test 3: Simple query
        try {
          const timeResult = await sql`SELECT NOW() as current_time, version() as pg_version`;
          results.tests.basicQuery = {
            status: "passed",
            serverTime: timeResult[0].current_time,
            version: timeResult[0].pg_version,
          };

          // Test 4: Check tables
          try {
            const tables = await sql`
              SELECT table_name
              FROM information_schema.tables
              WHERE table_schema = 'public'
              ORDER BY table_name
            `;
            results.tests.tables = {
              status: "passed",
              count: tables.length,
              list: tables.map((t: any) => t.table_name),
            };

            // Test 5: Check articles table
            const hasArticles = tables.some((t: any) => t.table_name === "articles");
            if (hasArticles) {
              const countResult = await sql`SELECT COUNT(*) as count FROM articles`;
              results.tests.articlesTable = {
                status: "passed",
                exists: true,
                count: countResult[0].count,
              };
            } else {
              results.tests.articlesTable = {
                status: "failed",
                exists: false,
                error: "Articles table not found",
              };
            }
          } catch (tableError) {
            results.tests.tables = {
              status: "failed",
              error: tableError instanceof Error ? tableError.message : "Unknown error",
            };
          }
        } catch (queryError) {
          results.tests.basicQuery = {
            status: "failed",
            error: queryError instanceof Error ? queryError.message : "Unknown error",
          };
        }
      } catch (connectionError) {
        results.tests.connectionCreation = {
          status: "failed",
          error: connectionError instanceof Error ? connectionError.message : "Unknown error",
        };
      }
    }

    // Test 6: Check getDb() function
    try {
      const { getDb } = await import("@/lib/db/connection");
      const db = getDb();
      results.tests.getDbFunction = {
        status: db ? "passed" : "failed",
        hasConnection: !!db,
        message: db ? "getDb() returns connection" : "getDb() returns null",
      };
    } catch (importError) {
      results.tests.getDbFunction = {
        status: "failed",
        error: importError instanceof Error ? importError.message : "Unknown error",
      };
    }

    // Summary
    const allTests = Object.values(results.tests);
    const passedTests = allTests.filter((t: any) => t.status === "passed").length;
    const failedTests = allTests.filter((t: any) => t.status === "failed").length;

    results.summary = {
      totalTests: allTests.length,
      passed: passedTests,
      failed: failedTests,
      status: failedTests === 0 ? "healthy" : failedTests < passedTests ? "degraded" : "unhealthy",
    };

    return NextResponse.json(results, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Database test failed",
        stack:
          process.env["NODE_ENV"] === "development" && error instanceof Error
            ? error.stack
            : undefined,
      },
      { status: 500 }
    );
  }
}
