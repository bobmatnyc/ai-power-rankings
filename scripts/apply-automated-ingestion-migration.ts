/**
 * Apply automated ingestion migration
 * Creates the automated_ingestion_runs table and adds tracking columns to articles
 */

import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { readFileSync } from "fs";
import { join } from "path";

// Load environment variables
config({ path: ".env.local" });
config({ path: ".env" });

async function applyMigration() {
  console.log("=".repeat(60));
  console.log("Automated Ingestion Migration");
  console.log("=".repeat(60));
  console.log("");

  // Get database URL
  const DATABASE_URL = process.env.DATABASE_URL_DEVELOPMENT || process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    console.error("DATABASE_URL not found in environment variables");
    process.exit(1);
  }

  // Extract endpoint info for logging
  const endpoint = DATABASE_URL.split("@")[1]?.split("/")[0] || "unknown";
  console.log("Database endpoint:", endpoint);
  console.log("");

  // Create SQL client
  const sql = neon(DATABASE_URL);

  try {
    // Test connection first
    console.log("1. Testing database connection...");
    const connTest = await sql`SELECT NOW() as current_time`;
    console.log("   Connection successful:", connTest[0].current_time);
    console.log("");

    // Read migration file
    const migrationPath = join(
      __dirname,
      "..",
      "lib",
      "db",
      "migrations",
      "0011_add_automated_ingestion.sql"
    );
    console.log("2. Reading migration file...");
    console.log("   Path:", migrationPath);

    const migrationSQL = readFileSync(migrationPath, "utf-8");
    console.log("   File read successfully");
    console.log("");

    // Parse SQL statements - split by breakpoint markers
    const statements = migrationSQL
      .split("--> statement-breakpoint")
      .map((block) => {
        // Remove comment lines
        return block
          .split("\n")
          .filter((line) => {
            const trimmed = line.trim();
            return (
              trimmed.length > 0 &&
              !trimmed.startsWith("--")
            );
          })
          .join("\n")
          .trim();
      })
      .filter((stmt) => stmt.length > 0);

    console.log(`3. Executing ${statements.length} SQL statements...`);
    console.log("");

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      const preview = statement.split("\n")[0].substring(0, 70);

      console.log(`   [${i + 1}/${statements.length}] ${preview}...`);

      try {
        await sql(statement);
        console.log(`       OK`);
      } catch (error) {
        // Check if error is because object already exists
        if (error instanceof Error) {
          if (
            error.message.includes("already exists") ||
            error.message.includes("duplicate key")
          ) {
            console.log(`       Skipped (already exists)`);
            continue;
          }
        }
        throw error;
      }
    }

    console.log("");
    console.log("4. Verifying migration...");
    console.log("");

    // Verify automated_ingestion_runs table
    console.log("   a) Checking automated_ingestion_runs table...");
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'automated_ingestion_runs'
      ) as table_exists;
    `;

    if (tableCheck[0].table_exists) {
      console.log("      Table exists: YES");

      // Get column details
      const columns = await sql`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'automated_ingestion_runs'
        ORDER BY ordinal_position;
      `;

      console.log(`      Columns (${columns.length}):`);
      columns.forEach((col: { column_name: string; data_type: string; is_nullable: string; column_default: string | null }) => {
        const nullable = col.is_nullable === "YES" ? "nullable" : "not null";
        const defaultVal = col.column_default ? ` default=${col.column_default.substring(0, 30)}` : "";
        console.log(`        - ${col.column_name}: ${col.data_type} (${nullable}${defaultVal})`);
      });
    } else {
      console.error("      Table exists: NO - Migration may have failed!");
    }

    console.log("");

    // Verify articles table columns
    console.log("   b) Checking articles table new columns...");
    const articleCols = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'articles'
        AND column_name IN ('ingestion_run_id', 'is_auto_ingested', 'discovery_source')
      ORDER BY column_name;
    `;

    if (articleCols.length === 3) {
      console.log("      All 3 columns exist: YES");
      articleCols.forEach((col: { column_name: string; data_type: string; is_nullable: string; column_default: string | null }) => {
        const nullable = col.is_nullable === "YES" ? "nullable" : "not null";
        const defaultVal = col.column_default ? ` default=${col.column_default}` : "";
        console.log(`        - ${col.column_name}: ${col.data_type} (${nullable}${defaultVal})`);
      });
    } else {
      console.warn(`      Expected 3 columns, found ${articleCols.length}`);
      console.log("      Found:", articleCols.map((c: { column_name: string }) => c.column_name).join(", "));
    }

    console.log("");

    // Verify indexes
    console.log("   c) Checking indexes...");
    const indexes = await sql`
      SELECT indexname, tablename
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND (
          indexname LIKE 'idx_automated_ingestion%'
          OR indexname LIKE 'idx_articles_is_auto%'
          OR indexname LIKE 'idx_articles_discovery%'
          OR indexname LIKE 'idx_articles_ingestion_run%'
        )
      ORDER BY tablename, indexname;
    `;

    console.log(`      Indexes found: ${indexes.length}`);
    indexes.forEach((idx: { indexname: string; tablename: string }) => {
      console.log(`        - ${idx.tablename}.${idx.indexname}`);
    });

    console.log("");
    console.log("=".repeat(60));
    console.log("Migration completed successfully!");
    console.log("=".repeat(60));

  } catch (error) {
    console.error("");
    console.error("Migration failed:");
    console.error(error);
    process.exit(1);
  }
}

// Run migration
applyMigration();
