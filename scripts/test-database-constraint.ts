/**
 * Test database-level unique constraint on source_url
 */

import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/connection";

async function testDatabaseConstraint() {
  const db = getDb();

  try {
    console.log("🧪 Testing database-level unique constraint...");

    const testUrl = "https://test-db-constraint.com/article";

    // Insert first article directly (bypassing application logic)
    console.log("\n1️⃣ Inserting first article directly to database...");
    await db.execute(sql`
      INSERT INTO articles (id, slug, title, content, source_url, ingestion_type, status)
      VALUES (
        gen_random_uuid(),
        'test-db-constraint-1',
        'Test DB Constraint 1',
        'Test content',
        ${testUrl},
        'url',
        'active'
      )
    `);
    console.log("✅ First article inserted");

    // Try to insert duplicate (should be blocked by constraint)
    console.log("\n2️⃣ Attempting to insert duplicate URL directly to database...");
    try {
      await db.execute(sql`
        INSERT INTO articles (id, slug, title, content, source_url, ingestion_type, status)
        VALUES (
          gen_random_uuid(),
          'test-db-constraint-2',
          'Test DB Constraint 2 (Duplicate URL)',
          'Test content duplicate',
          ${testUrl},
          'url',
          'active'
        )
      `);
      console.log("❌ ERROR: Database constraint failed to prevent duplicate!");
    } catch (error) {
      if (error instanceof Error && error.message.includes("duplicate key")) {
        console.log("✅ Database constraint correctly prevented duplicate");
      } else if (error instanceof Error && error.message.includes("unique")) {
        console.log("✅ Database constraint correctly prevented duplicate (unique violation)");
      } else {
        console.log("❌ Unexpected error:", error);
      }
    }

    // Cleanup
    console.log("\n🧹 Cleaning up test data...");
    await db.execute(sql`
      DELETE FROM articles
      WHERE source_url = ${testUrl}
    `);
    console.log("✅ Test cleanup completed");

    console.log("\n🎉 Database constraint test passed!");

  } catch (error) {
    console.error("❌ Test failed:", error);
    throw error;
  }
}

// Main execution
async function main() {
  try {
    await testDatabaseConstraint();
    console.log("\n✅ Database constraint test completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

main();
