#!/usr/bin/env node

/**
 * Script to apply timestamp indexes for performance optimization
 */

import { sql } from "drizzle-orm";
import { closeDb, getDb } from "@/lib/db/connection";

async function applyIndexes() {
  try {
    console.log("🚀 Applying timestamp indexes...");

    // Initialize database connection
    const db = getDb();
    if (!db) {
      throw new Error("Failed to get database connection");
    }
    console.log("✅ Database connected");

    // Apply indexes one by one
    console.log("\n🔧 Creating tools.updated_at index...");
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS tools_updated_at_idx ON tools (updated_at);
    `);
    console.log("✅ tools_updated_at_idx created");

    console.log("\n🔧 Creating tools.created_at index...");
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS tools_created_at_idx ON tools (created_at);
    `);
    console.log("✅ tools_created_at_idx created");

    console.log("\n🔧 Creating news.created_at index...");
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS news_created_at_idx ON news (created_at);
    `);
    console.log("✅ news_created_at_idx created");

    // Verify indexes were created
    console.log("\n🔍 Verifying indexes...");
    const result = await db.execute(sql`
      SELECT
        schemaname,
        tablename,
        indexname
      FROM pg_indexes
      WHERE tablename IN ('tools', 'news')
        AND indexname LIKE '%_at_idx'
      ORDER BY tablename, indexname;
    `);

    console.log("\n📊 Created indexes:");
    for (const row of result.rows as any[]) {
      console.log(`   ✓ ${row.tablename}.${row.indexname}`);
    }

    console.log("\n✨ All indexes applied successfully!");
  } catch (error) {
    console.error("❌ Index creation failed:", error);
    process.exit(1);
  } finally {
    // Close database connection
    await closeDb();
    console.log("👋 Database connection closed");
  }
}

// Run if called directly
if (require.main === module) {
  applyIndexes()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { applyIndexes };
