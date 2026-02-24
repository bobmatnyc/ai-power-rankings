/**
 * Apply semantic deduplication migration
 * Adds articles_skipped_semantic column to automated_ingestion_runs table
 */

import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

// Load environment variables
config({ path: ".env.local" });
config({ path: ".env" });

async function applyMigration() {
  console.log("=".repeat(60));
  console.log("Semantic Deduplication Migration");
  console.log("=".repeat(60));
  console.log("");

  const DATABASE_URL = process.env.DATABASE_URL_DEVELOPMENT || process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    console.error("DATABASE_URL not found in environment variables");
    process.exit(1);
  }

  // Extract endpoint info for logging
  const endpoint = DATABASE_URL.split("@")[1]?.split("/")[0] || "unknown";
  console.log("Database endpoint:", endpoint);
  console.log("");

  const sql = neon(DATABASE_URL);

  try {
    // Test connection
    console.log("1. Testing database connection...");
    const connTest = await sql`SELECT NOW() as current_time`;
    console.log("   Connection successful:", connTest[0].current_time);
    console.log("");

    // Apply migration
    console.log("2. Adding articles_skipped_semantic column...");
    await sql`
      ALTER TABLE automated_ingestion_runs
      ADD COLUMN IF NOT EXISTS articles_skipped_semantic integer DEFAULT 0
    `;
    console.log("   Column added successfully");
    console.log("");

    // Verify
    console.log("3. Verifying migration...");
    const cols = await sql`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'automated_ingestion_runs'
      AND column_name = 'articles_skipped_semantic'
    `;

    if (cols.length > 0) {
      console.log("   Column exists: YES");
      console.log(`   Type: ${cols[0].data_type}`);
      console.log(`   Default: ${cols[0].column_default}`);
    } else {
      console.error("   Column verification failed!");
      process.exit(1);
    }

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

applyMigration();
