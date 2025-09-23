import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * GET /api/admin/db-simple-test
 * Simple test to check environment variables only
 */
export async function GET() {
  try {
    // Check authentication
    const user = await currentUser();
    const isAdmin = user?.publicMetadata?.isAdmin === true;

    if (!user || !isAdmin) {
      return NextResponse.json({ error: "Unauthorized - Admin access required" }, { status: 401 });
    }

    // Just check environment variables
    const dbUrl = process.env["DATABASE_URL"];
    const useDb = process.env["USE_DATABASE"];

    const results: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      environment: {
        NODE_ENV: process.env["NODE_ENV"] || "not set",
        USE_DATABASE: useDb || "not set",
        USE_DATABASE_VALUE: useDb,
        USE_DATABASE_IS_TRUE: useDb === "true",
        NEXT_PUBLIC_USE_DATABASE: process.env["NEXT_PUBLIC_USE_DATABASE"] || "not set",
        DATABASE_URL_EXISTS: !!dbUrl,
        DATABASE_URL_LENGTH: dbUrl?.length || 0,
        DATABASE_URL_STARTS_WITH: dbUrl ? dbUrl.substring(0, 15) : "not set",
        DATABASE_URL_CONTAINS_PASSWORD_PLACEHOLDER: dbUrl ? dbUrl.includes("YOUR_PASSWORD") : false,
      },
      tests: {
        envCheck: {
          hasDbUrl: !!dbUrl,
          hasUseDb: !!useDb,
          useDbIsTrue: useDb === "true",
          urlIsValid: !!dbUrl && !dbUrl.includes("YOUR_PASSWORD"),
          shouldConnect: useDb === "true" && !!dbUrl && !dbUrl.includes("YOUR_PASSWORD"),
        },
      },
    };

    // Try direct Neon connection if we should
    if (results.tests.envCheck.shouldConnect && dbUrl) {
      try {
        // Dynamic import to avoid build-time issues
        const { neon } = await import("@neondatabase/serverless");
        results.tests.neonImport = { status: "success", message: "Neon module loaded" };

        try {
          const sql = neon(dbUrl);
          results.tests.neonConnection = { status: "success", message: "Neon client created" };

          try {
            const result = await sql`SELECT 1 as test`;
            results.tests.simpleQuery = {
              status: "success",
              result: result[0],
              message: "Database query successful",
            };
          } catch (queryErr) {
            results.tests.simpleQuery = {
              status: "failed",
              error: queryErr instanceof Error ? queryErr.message : "Unknown query error",
              stack: queryErr instanceof Error ? queryErr.stack : undefined,
            };
          }
        } catch (connErr) {
          results.tests.neonConnection = {
            status: "failed",
            error: connErr instanceof Error ? connErr.message : "Unknown connection error",
            stack: connErr instanceof Error ? connErr.stack : undefined,
          };
        }
      } catch (importErr) {
        results.tests.neonImport = {
          status: "failed",
          error: importErr instanceof Error ? importErr.message : "Cannot import Neon",
          stack: importErr instanceof Error ? importErr.stack : undefined,
        };
      }
    } else {
      results.tests.connectionSkipped = {
        reason: !useDb
          ? "USE_DATABASE not set"
          : useDb !== "true"
            ? "USE_DATABASE is not 'true'"
            : !dbUrl
              ? "DATABASE_URL not set"
              : dbUrl.includes("YOUR_PASSWORD")
                ? "DATABASE_URL has placeholder"
                : "Unknown reason",
      };
    }

    return NextResponse.json(results, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("Simple DB test error:", error);
    return NextResponse.json(
      {
        error: "Test Failed",
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        type: error?.constructor?.name,
      },
      { status: 500 }
    );
  }
}
