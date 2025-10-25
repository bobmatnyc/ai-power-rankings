/**
 * Set October 2025 Rankings as Current
 *
 * This script marks the 2025-10 ranking as the current ranking
 * by setting is_current = true for that period and false for all others.
 */

import { getDb } from "../lib/db/connection";
import { rankings } from "../lib/db/schema";
import { eq } from "drizzle-orm";

async function setOctoberAsCurrent() {
  const db = getDb();
  if (!db) {
    console.error("❌ Database connection not available");
    process.exit(1);
  }

  console.log("🔄 Setting October 2025 rankings as current...\n");

  try {
    // First, get the October 2025 ranking to verify it exists
    const october2025 = await db
      .select()
      .from(rankings)
      .where(eq(rankings.period, "2025-10"))
      .limit(1);

    if (october2025.length === 0) {
      console.error("❌ October 2025 ranking not found in database");
      process.exit(1);
    }

    const ranking = october2025[0];
    console.log("✓ Found October 2025 ranking:");
    console.log(`   ID: ${ranking.id}`);
    console.log(`   Period: ${ranking.period}`);
    console.log(`   Algorithm: ${ranking.algorithmVersion}`);
    console.log(`   Published: ${ranking.publishedAt}`);
    console.log(`   Current Status: ${ranking.isCurrent ? "✅ Already current" : "❌ Not current"}`);

    if (ranking.isCurrent) {
      console.log("\n✅ October 2025 is already marked as current!");
      process.exit(0);
    }

    // Execute the updates sequentially (neon-http doesn't support transactions)
    console.log("\n🔄 Updating rankings...");

    // First, unset all current flags
    await db.update(rankings).set({ isCurrent: false });
    console.log("   ✓ Unmarked all rankings as current");

    // Then set October 2025 as current
    await db
      .update(rankings)
      .set({
        isCurrent: true,
        publishedAt: ranking.publishedAt || new Date(),
        updatedAt: new Date(),
      })
      .where(eq(rankings.id, ranking.id));

    console.log("   ✓ Marked October 2025 as current");

    console.log("\n✅ Successfully set October 2025 as current ranking!");

    // Verify the change
    console.log("\n🔍 Verifying change...");
    const verification = await db
      .select({
        period: rankings.period,
        isCurrent: rankings.isCurrent,
      })
      .from(rankings);

    verification.forEach((r) => {
      const status = r.isCurrent ? "✅ CURRENT" : "❌";
      console.log(`   ${status} ${r.period}`);
    });

    console.log("\n🎉 Done! The /api/rankings/current endpoint should now work.");
    process.exit(0);

  } catch (error) {
    console.error("\n❌ Error updating rankings:", error);
    process.exit(1);
  }
}

setOctoberAsCurrent().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
