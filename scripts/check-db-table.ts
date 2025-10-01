/**
 * Check if user_preferences table exists in the database
 */

import { getDb } from "../lib/db/connection";
import { sql } from "drizzle-orm";

async function checkTableExists() {
  console.log("🔍 Checking if user_preferences table exists in database\n");

  try {
    const db = getDb();

    // Query PostgreSQL information schema
    const result = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'user_preferences'
      );
    `);

    const exists = result.rows[0]?.exists;

    if (exists) {
      console.log("⚠️  user_preferences table EXISTS in database");
      console.log("\nRecommended actions:");
      console.log("1. If this is a production database, create a migration script to:");
      console.log("   - Export existing preferences to Clerk privateMetadata");
      console.log("   - Then drop the table");
      console.log("\n2. If this is a development database, you can safely drop it:");
      console.log("   DROP TABLE user_preferences CASCADE;");

      // Check if table has any data
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as count FROM user_preferences;
      `);

      const count = countResult.rows[0]?.count || 0;
      console.log(`\n📊 Table contains ${count} record(s)`);

      if (count > 0) {
        console.log("\n⚠️  WARNING: Table has data! Migration required before dropping.");
      } else {
        console.log("\n✅ Table is empty, safe to drop.");
      }
    } else {
      console.log("✅ user_preferences table does NOT exist in database");
      console.log("✅ Database cleanup already complete!");
    }

  } catch (error) {
    console.error("❌ Error checking database:", error);
    process.exit(1);
  }
}

checkTableExists()
  .then(() => {
    console.log("\n✨ Check completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Check failed:", error);
    process.exit(1);
  });
