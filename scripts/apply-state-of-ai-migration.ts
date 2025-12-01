/**
 * Apply State of AI Summaries Migration
 * Run this script to create the state_of_ai_summaries table
 *
 * Usage: npx tsx scripts/apply-state-of-ai-migration.ts
 */

import fs from "node:fs/promises";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

async function applyMigration() {
  try {
    console.log("🚀 Starting State of AI migration...\n");

    // Get database URL
    const DATABASE_URL = process.env["DATABASE_URL"];
    if (!DATABASE_URL) {
      throw new Error("DATABASE_URL not found in environment variables");
    }

    // Create Neon client
    const sql = neon(DATABASE_URL);

    // Test connection
    console.log("📡 Testing database connection...");
    const connectionTest = await sql`SELECT NOW() as current_time, version() as pg_version`;
    console.log("✅ Connected to database");
    console.log(`   Server time: ${connectionTest[0]?.["current_time"]}`);
    console.log(
      `   PostgreSQL: ${connectionTest[0]?.["pg_version"]?.toString().split(" ")[1] || "Unknown"}\n`
    );

    // Check if table already exists
    console.log("🔍 Checking if state_of_ai_summaries table exists...");
    const existingTables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'state_of_ai_summaries'
    `;

    if (existingTables.length > 0) {
      console.log("⚠️  Table state_of_ai_summaries already exists");
      console.log("   Skipping migration (table already created)\n");
      return;
    }

    // Read migration file
    console.log("📄 Reading migration file...");
    const migrationPath = path.join(
      process.cwd(),
      "lib",
      "db",
      "migrations",
      "0010_add_state_of_ai_summaries.sql"
    );

    const migrationContent = await fs.readFile(migrationPath, "utf-8");
    console.log(`✅ Loaded migration: 0010_add_state_of_ai_summaries.sql\n`);

    // Apply migration
    console.log("⚡ Applying migration...");
    const startTime = Date.now();

    // Split SQL into individual statements (Neon doesn't support multi-statement prepared queries)
    // Remove comments and split by semicolons
    const cleanedContent = migrationContent
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");

    const statements = cleanedContent
      .split(";")
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0);

    console.log(`   Executing ${statements.length} SQL statements...`);

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      if (!stmt) continue;

      try {
        // Use raw query execution for DDL statements
        await sql([stmt] as any);
        console.log(`   ✓ Statement ${i + 1}/${statements.length} executed`);
      } catch (error) {
        console.error(`   ✗ Failed at statement ${i + 1}/${statements.length}:`);
        console.error(`   ${stmt.substring(0, 100)}...`);
        throw error;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Migration applied successfully in ${duration}ms\n`);

    // Verify table creation
    console.log("🔍 Verifying table creation...");
    const tableCheck = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'state_of_ai_summaries'
      ORDER BY ordinal_position
    `;

    console.log("\n📊 Table structure:");
    console.log("   Columns:");
    tableCheck.forEach((col: any) => {
      console.log(
        `   - ${col.column_name} (${col.data_type})${col.is_nullable === "NO" ? " NOT NULL" : ""}`
      );
    });

    // Check indexes
    const indexCheck = await sql`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'state_of_ai_summaries'
    `;

    console.log("\n   Indexes:");
    indexCheck.forEach((idx: any) => {
      console.log(`   - ${idx.indexname}`);
    });

    console.log("\n✅ Migration completed successfully!");
    console.log("\n📋 Next steps:");
    console.log("   1. Generate a State of AI editorial via the admin UI:");
    console.log("      → http://localhost:3007/en/admin/state-of-ai");
    console.log("   2. Or use the API endpoint:");
    console.log("      → POST /api/admin/state-of-ai/generate");
    console.log("   3. View on What's New page:");
    console.log("      → http://localhost:3007/en/whats-new\n");
  } catch (error) {
    console.error("\n❌ Migration failed:");
    console.error(error instanceof Error ? error.message : "Unknown error");
    if (error instanceof Error && error.stack) {
      console.error("\nStack trace:");
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run migration
applyMigration();
