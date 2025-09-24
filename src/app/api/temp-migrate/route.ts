import fs from "node:fs/promises";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";

/**
 * TEMPORARY PUBLIC MIGRATION ENDPOINT
 * DELETE THIS FILE AFTER RUNNING MIGRATIONS
 */
export async function GET() {
  const startTime = Date.now();

  try {
    // Check if database is enabled
    const USE_DATABASE = process.env["USE_DATABASE"];
    if (USE_DATABASE !== "true") {
      return NextResponse.json({ error: "Database is disabled" }, { status: 400 });
    }

    const DATABASE_URL = process.env["DATABASE_URL"];
    if (!DATABASE_URL || DATABASE_URL.includes("YOUR_PASSWORD")) {
      return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 500 });
    }

    // Create Neon client
    const sql = neon(DATABASE_URL);

    // Test connection
    const testResult = await sql`SELECT version() as version, NOW() as current_time`;
    console.log("Database connected:", testResult[0]);

    // Check existing tables
    const existingTables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    const tableNames = existingTables.map((t: any) => t["table_name"] as string);

    console.log("Existing tables:", tableNames);

    // If articles table exists, skip migrations
    if (tableNames.includes("articles")) {
      return NextResponse.json({
        status: "skipped",
        message: "Tables already exist",
        tables: tableNames,
        timestamp: new Date().toISOString(),
      });
    }

    // Read migration files
    const migrationsDir = path.join(process.cwd(), "src/lib/db/migrations");
    const migrations = ["0000_oval_manta.sql", "0001_easy_mesmero.sql"];
    const results: any[] = [];

    for (const migrationFile of migrations) {
      const migrationPath = path.join(migrationsDir, migrationFile);
      const migrationContent = await fs.readFile(migrationPath, "utf-8");

      // Split by statement breakpoint
      const statements = migrationContent
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith("--"));

      let executedCount = 0;
      const errors: string[] = [];

      for (const statement of statements) {
        if (!statement || statement.length === 0) continue;

        try {
          await sql([statement] as unknown as TemplateStringsArray);
          executedCount++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (errorMessage.includes("already exists")) {
            executedCount++;
          } else {
            errors.push(errorMessage);
            console.error("Migration error:", errorMessage);
          }
        }
      }

      results.push({
        name: migrationFile,
        status: errors.length === 0 ? "success" : "partial",
        statementsExecuted: executedCount,
        totalStatements: statements.length,
        errors: errors.length > 0 ? errors : undefined,
        executionTime: Date.now() - startTime,
      });
    }

    // Get updated tables
    const updatedTables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;

    return NextResponse.json(
      {
        status: "completed",
        summary: {
          migrationsRun: results.length,
          tablesCreated: updatedTables.length - tableNames.length,
          totalExecutionTime: Date.now() - startTime,
        },
        migrations: results,
        tables: {
          before: tableNames,
          after: updatedTables.map((t: any) => t["table_name"]),
        },
        database: {
          host: DATABASE_URL.split("@")[1]?.split("/")[0] || "unknown",
          connected: true,
        },
        timestamp: new Date().toISOString(),
        warning: "DELETE /api/temp-migrate/route.ts AFTER RUNNING THIS!",
      },
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
      }
    );
  } catch (error) {
    console.error("Migration error:", error);
    return NextResponse.json(
      {
        error: "Migration failed",
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
