import fs from "node:fs/promises";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";

interface MigrationResult {
  name: string;
  status: "success" | "error" | "skipped";
  message?: string;
  error?: string;
  executionTime?: number;
  statementsExecuted?: number;
}

/**
 * GET /api/admin/run-migrations
 * Run database migrations in production
 * Requires admin authentication via Clerk
 */
export async function GET() {
  const startTime = Date.now();

  try {
    // Check admin authentication
    const authResult = await requireAdmin();
    if (authResult.error) {
      return authResult.error;
    }

    // Check if database is enabled
    const USE_DATABASE = process.env["USE_DATABASE"];
    if (USE_DATABASE !== "true") {
      return NextResponse.json(
        {
          error: "Database is disabled",
          USE_DATABASE,
          message: "Set USE_DATABASE=true to enable database operations",
        },
        { status: 400 }
      );
    }

    // Get database URL
    const DATABASE_URL = process.env["DATABASE_URL"];
    if (!DATABASE_URL) {
      return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 500 });
    }

    if (DATABASE_URL.includes("YOUR_PASSWORD")) {
      return NextResponse.json(
        { error: "DATABASE_URL contains placeholder value" },
        { status: 500 }
      );
    }

    // Create Neon client
    const sql = neon(DATABASE_URL);

    // Test database connection
    const connectionTest = await sql`SELECT NOW() as current_time, version() as pg_version`;
    const dbInfo = {
      connected: true,
      serverTime: connectionTest[0]?.["current_time"],
      postgresVersion: connectionTest[0]?.["pg_version"],
    };

    // Check existing tables
    const existingTables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    const tableNames = existingTables.map(
      (t: Record<string, unknown>) => t["table_name"] as string
    );

    // Define migrations in order
    const migrations = ["0000_oval_manta.sql", "0001_easy_mesmero.sql"];

    const results: MigrationResult[] = [];

    // Process each migration
    for (const migrationFile of migrations) {
      const migrationStart = Date.now();

      try {
        // Read migration file
        const migrationPath = path.join(
          process.cwd(),
          "src",
          "lib",
          "db",
          "migrations",
          migrationFile
        );

        const migrationContent = await fs.readFile(migrationPath, "utf-8");

        // Check if migration should be skipped
        // For 0000_oval_manta.sql, skip if core tables exist
        if (migrationFile === "0000_oval_manta.sql") {
          const coreTables = ["companies", "tools", "news", "rankings", "migrations"];
          const tablesExist = coreTables.every((table) => tableNames.includes(table));

          if (tablesExist) {
            results.push({
              name: migrationFile,
              status: "skipped",
              message: "Core tables already exist",
              executionTime: Date.now() - migrationStart,
            });
            continue;
          }
        }

        // For 0001_easy_mesmero.sql, skip if articles table exists
        if (migrationFile === "0001_easy_mesmero.sql") {
          if (tableNames.includes("articles")) {
            results.push({
              name: migrationFile,
              status: "skipped",
              message: "Articles table already exists",
              executionTime: Date.now() - migrationStart,
            });
            continue;
          }
        }

        // Split migration content by statement breakpoint
        const statements = migrationContent
          .split("--> statement-breakpoint")
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && !s.startsWith("--"));

        let executedCount = 0;
        const errors: string[] = [];

        // Execute each statement
        for (const statement of statements) {
          try {
            // Skip empty statements
            if (!statement || statement.trim().length === 0) {
              continue;
            }

            // Execute the SQL statement using template literal
            await sql([statement] as unknown as TemplateStringsArray);
            executedCount++;
          } catch (error) {
            // Check if it's a "already exists" error which we can ignore
            const errorMessage = error instanceof Error ? error.message : String(error);

            if (errorMessage.includes("already exists") || errorMessage.includes("duplicate key")) {
              // Log but continue
              console.log(`Skipping statement (already exists): ${statement.substring(0, 50)}...`);
              executedCount++;
            } else {
              // Real error
              errors.push(`Statement failed: ${errorMessage}`);
              console.error("Migration statement failed:", statement.substring(0, 100), error);
            }
          }
        }

        if (errors.length > 0) {
          results.push({
            name: migrationFile,
            status: "error",
            error: errors.join("; "),
            statementsExecuted: executedCount,
            executionTime: Date.now() - migrationStart,
          });
        } else {
          results.push({
            name: migrationFile,
            status: "success",
            message: `Successfully executed ${executedCount} statements`,
            statementsExecuted: executedCount,
            executionTime: Date.now() - migrationStart,
          });
        }
      } catch (error) {
        results.push({
          name: migrationFile,
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
          executionTime: Date.now() - migrationStart,
        });
      }
    }

    // Get updated table list
    const updatedTables = await sql`
      SELECT table_name,
             (SELECT COUNT(*)
              FROM information_schema.columns
              WHERE table_schema = 'public'
              AND table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;

    // Check if key tables have data
    const tableCounts: Record<string, number> = {};
    for (const table of ["companies", "tools", "news", "rankings", "articles"]) {
      if (updatedTables.some((t: Record<string, unknown>) => t["table_name"] === table)) {
        try {
          // Use template literal properly for dynamic table query
          const query = `SELECT COUNT(*) as count FROM ${table}`;
          const result = await sql([query] as unknown as TemplateStringsArray);
          tableCounts[table] = parseInt((result[0]?.["count"] as string) || "0", 10);
        } catch {
          tableCounts[table] = -1; // Error getting count
        }
      }
    }

    // Summary
    const successCount = results.filter((r) => r.status === "success").length;
    const errorCount = results.filter((r) => r.status === "error").length;
    const skippedCount = results.filter((r) => r.status === "skipped").length;

    return NextResponse.json(
      {
        status: "completed",
        summary: {
          totalMigrations: migrations.length,
          executed: successCount,
          skipped: skippedCount,
          failed: errorCount,
          totalExecutionTime: Date.now() - startTime,
        },
        database: dbInfo,
        migrations: results,
        tables: {
          before: tableNames,
          after: updatedTables.map((t: Record<string, unknown>) => ({
            name: t["table_name"] as string,
            columns: t["column_count"] as number,
          })),
          rowCounts: tableCounts,
        },
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("Migration endpoint error:", error);

    return NextResponse.json(
      {
        error: "Migration failed",
        message: error instanceof Error ? error.message : "Unknown error",
        stack:
          process.env["NODE_ENV"] === "development" && error instanceof Error
            ? error.stack
            : undefined,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/run-migrations
 * Force run specific migrations (dangerous - use with caution)
 */
export async function POST(request: Request) {
  try {
    // Check admin authentication
    const authResult = await requireAdmin();
    if (authResult.error) {
      return authResult.error;
    }

    // Parse request body
    const body = await request.json();
    const { force = false } = body;

    if (!force) {
      return NextResponse.json(
        {
          error: "Force flag required",
          message:
            "Set force=true to run migrations. This will attempt to run migrations even if tables exist.",
        },
        { status: 400 }
      );
    }

    // For now, return a message that POST is not fully implemented
    return NextResponse.json(
      {
        error: "Force migration not yet implemented",
        message: "Use GET endpoint to run migrations safely. Force mode will be added if needed.",
      },
      { status: 501 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Request failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
