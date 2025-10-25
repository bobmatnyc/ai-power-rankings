/**
 * Verify Production Rankings Database State
 *
 * This script queries the production database to confirm:
 * 1. Which ranking (if any) has is_current = true
 * 2. All rankings in the database and their current status
 */

import { getDb } from "../lib/db/connection";
import { rankings } from "../lib/db/schema";
import { eq } from "drizzle-orm";

async function verifyProductionRankings() {
  const db = getDb();
  if (!db) {
    console.error("❌ Database connection not available");
    process.exit(1);
  }

  console.log("🔍 Verifying production rankings database state...\n");

  try {
    // Get ALL rankings to see the complete picture
    console.log("📊 All rankings in database:");
    const allRankings = await db.select().from(rankings);

    console.log(`   Total rankings: ${allRankings.length}\n`);

    allRankings.forEach((r) => {
      const currentBadge = r.isCurrent ? "✅ CURRENT" : "❌";
      console.log(`   ${currentBadge} ${r.period}`);
      console.log(`      ID: ${r.id}`);
      console.log(`      Algorithm: ${r.algorithmVersion}`);
      console.log(`      Published: ${r.publishedAt}`);
      console.log(`      Is Current: ${r.isCurrent}`);
      console.log(`      Created: ${r.createdAt}`);
      console.log(`      Updated: ${r.updatedAt}`);
      console.log(``);
    });

    // Check specifically for current ranking
    console.log("\n🎯 Checking for is_current = true:");
    const current = await db
      .select()
      .from(rankings)
      .where(eq(rankings.isCurrent, true))
      .limit(1);

    if (current.length === 0) {
      console.log("   ❌ NO ranking has is_current = true");
      console.log("\n⚠️  This explains why the API returns 404!");
      process.exit(1);
    } else {
      console.log(`   ✅ Found current ranking: ${current[0].period}`);
      console.log(`      ID: ${current[0].id}`);
      console.log(`      Algorithm: ${current[0].algorithmVersion}`);
      console.log(`      Published: ${current[0].publishedAt}`);
    }

    console.log("\n✅ Database verification complete!");
    process.exit(0);

  } catch (error) {
    console.error("\n❌ Error querying database:", error);
    process.exit(1);
  }
}

verifyProductionRankings().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
