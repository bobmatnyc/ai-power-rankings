#!/usr/bin/env tsx
/**
 * Apply Performance Indexes Migration
 * Runs migration 0008_add_performance_indexes.sql to optimize rankings API queries
 *
 * Usage:
 *   tsx scripts/apply-performance-indexes.ts
 */

import { readFileSync } from "fs";
import { join } from "path";
import { getDb } from "../lib/db/connection";
import { sql } from "drizzle-orm";

async function applyPerformanceIndexes() {
  console.log("🚀 Starting performance indexes migration...\n");

  try {
    // Get database connection
    const db = getDb();
    if (!db) {
      throw new Error("Failed to connect to database");
    }

    // Read migration file
    const migrationPath = join(
      process.cwd(),
      "lib/db/migrations/0008_add_performance_indexes.sql"
    );
    const migrationSQL = readFileSync(migrationPath, "utf-8");

    console.log("📄 Migration file loaded:");
    console.log("   Path:", migrationPath);
    console.log("   Size:", migrationSQL.length, "bytes\n");

    // Split SQL statements by the statement separator
    // First split by the breakpoint marker, then clean up each statement
    const statements = migrationSQL
      .split("--> statement-breakpoint")
      .map((s) => {
        // Remove comments and trim
        return s
          .split("\n")
          .filter((line) => !line.trim().startsWith("--"))
          .join("\n")
          .trim();
      })
      .filter((s) => s.length > 0 && s.toLowerCase().includes("create index"));

    console.log(`📊 Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      // Skip comments
      if (statement.startsWith("--")) {
        continue;
      }

      // Extract index name from CREATE INDEX statement
      const indexMatch = statement.match(/CREATE INDEX.*?(idx_\w+)/i);
      const indexName = indexMatch ? indexMatch[1] : `statement ${i + 1}`;

      console.log(`⚙️  Executing: ${indexName}`);

      try {
        await db.execute(sql.raw(statement));
        console.log(`   ✅ Success\n`);
      } catch (error) {
        // Check if error is "already exists" (which is OK since we use IF NOT EXISTS)
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (errorMsg.includes("already exists")) {
          console.log(`   ⏭️  Already exists (skipped)\n`);
        } else {
          console.error(`   ❌ Failed:`, errorMsg);
          throw error;
        }
      }
    }

    console.log("✅ Performance indexes migration completed successfully!\n");
    console.log("📈 Expected performance improvements:");
    console.log("   • getCurrentRankings(): 500ms → 50ms (-90%)");
    console.log("   • findByIds() batch query: 200ms → 30ms (-85%)");
    console.log("   • Overall API TTFB: 1.41s → ~0.70s (-50%)\n");

  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  }
}

// Run migration
applyPerformanceIndexes()
  .then(() => {
    console.log("🎉 Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
