#!/usr/bin/env tsx
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Apply Monthly Summaries Migration
 * Creates the monthly_summaries table for the What's New feature
 */

import { readFileSync } from "fs";
import { join } from "path";
import { neon } from "@neondatabase/serverless";

// Load environment variables in development
const NODE_ENV = process.env.NODE_ENV || "development";
if (NODE_ENV === "development") {
  require("dotenv").config({ path: ".env.local" });
  require("dotenv").config({ path: ".env" });
}

async function applyMigration() {
  // Get database URL
  const DATABASE_URL =
    NODE_ENV === "development"
      ? process.env.DATABASE_URL_DEVELOPMENT || process.env.DATABASE_URL
      : process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    console.error("❌ DATABASE_URL not configured");
    process.exit(1);
  }

  console.log("🔄 Applying monthly_summaries migration...");
  console.log("📍 Environment:", NODE_ENV);

  const sql = neon(DATABASE_URL);

  try {
    // Execute each SQL statement separately since Neon doesn't support multiple commands
    console.log("Creating table...");
    await sql`
      CREATE TABLE IF NOT EXISTS monthly_summaries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        period TEXT NOT NULL UNIQUE,
        content TEXT NOT NULL,
        data_hash TEXT NOT NULL,
        metadata JSONB DEFAULT '{}'::jsonb,
        generated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;

    console.log("Creating unique index on period...");
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS monthly_summaries_period_idx
        ON monthly_summaries(period)
    `;

    console.log("Creating index on generated_at...");
    await sql`
      CREATE INDEX IF NOT EXISTS monthly_summaries_generated_at_idx
        ON monthly_summaries(generated_at)
    `;

    console.log("Creating GIN index on metadata...");
    await sql`
      CREATE INDEX IF NOT EXISTS monthly_summaries_metadata_idx
        ON monthly_summaries USING gin(metadata)
    `;

    console.log("Adding table comment...");
    await sql`
      COMMENT ON TABLE monthly_summaries IS 'Stores LLM-generated monthly What''s New summaries'
    `;

    console.log("✅ Migration applied successfully!");

    // Verify the table exists
    const result = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'monthly_summaries'
      ) as table_exists
    `;

    if (result[0]?.table_exists) {
      console.log("✅ Table 'monthly_summaries' verified in database");

      // Check the table structure
      const columns = await sql`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'monthly_summaries'
        ORDER BY ordinal_position
      `;

      console.log("\n📋 Table structure:");
      columns.forEach((col: any) => {
        console.log(`  - ${col.column_name}: ${col.data_type}`);
      });

      // Check indexes
      const indexes = await sql`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'monthly_summaries'
      `;

      console.log("\n🔗 Indexes:");
      indexes.forEach((idx: any) => {
        console.log(`  - ${idx.indexname}`);
      });
    } else {
      console.error("❌ Table was not created successfully");
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Migration failed:", error);
    console.error(
      "Error details:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

// Run the migration
applyMigration().catch((error) => {
  console.error("❌ Unexpected error:", error);
  process.exit(1);
});
