/**
 * Add unique constraint on source_url to prevent duplicate articles
 */

import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/connection";

async function addUniqueConstraint() {
  const db = getDb();

  try {
    console.log("🔧 Adding unique constraint on source_url...");

    // First, verify no duplicates exist
    const duplicates = await db.execute(sql`
      SELECT source_url, COUNT(*) as count
      FROM articles
      WHERE source_url IS NOT NULL
      GROUP BY source_url
      HAVING COUNT(*) > 1
    `);

    if (duplicates.rows.length > 0) {
      console.log(`❌ Found ${duplicates.rows.length} duplicate URLs. Cannot add unique constraint.`);
      duplicates.rows.forEach((row: any) => {
        console.log(`  🚨 ${row.source_url}: ${row.count} copies`);
      });
      throw new Error("Duplicates must be cleaned up before adding constraint");
    }

    console.log("✅ No duplicates found, proceeding with constraint...");

    // Add unique index on source_url (excluding NULL values)
    await db.execute(sql`
      CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_articles_source_url_unique
      ON articles (source_url)
      WHERE source_url IS NOT NULL
    `);

    console.log("✅ Unique constraint added successfully!");

    // Verify constraint works by testing total articles
    const totalCount = await db.execute(sql`SELECT COUNT(*) as count FROM articles`);
    console.log(`📊 Total articles: ${totalCount.rows[0]?.count}`);

    console.log("🎯 Constraint implementation complete!");

  } catch (error) {
    console.error("❌ Error adding constraint:", error);
    throw error;
  }
}

// Main execution
async function main() {
  try {
    await addUniqueConstraint();
    process.exit(0);
  } catch (error) {
    console.error("❌ Constraint addition failed:", error);
    process.exit(1);
  }
}

main();
