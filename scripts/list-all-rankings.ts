/**
 * List all rankings in the database to identify which should be current
 */

import { getDb } from "../lib/db/connection";
import { rankings } from "../lib/db/schema";

async function listRankings() {
  const db = getDb();
  if (!db) {
    console.error("❌ Database connection not available");
    process.exit(1);
  }

  console.log("📊 All Rankings in Database:\n");

  const allRankings = await db.select({
    id: rankings.id,
    period: rankings.period,
    isCurrent: rankings.isCurrent,
    algorithmVersion: rankings.algorithmVersion,
    publishedAt: rankings.publishedAt,
    createdAt: rankings.createdAt,
    updatedAt: rankings.updatedAt,
  }).from(rankings).orderBy(rankings.period);

  if (allRankings.length === 0) {
    console.log("⚠️  No rankings found in database");
    process.exit(1);
  }

  console.log(`Total rankings: ${allRankings.length}\n`);

  allRankings.forEach((ranking, index) => {
    console.log(`${index + 1}. Period: ${ranking.period}`);
    console.log(`   ID: ${ranking.id}`);
    console.log(`   Is Current: ${ranking.isCurrent ? "✅ YES" : "❌ NO"}`);
    console.log(`   Algorithm: ${ranking.algorithmVersion}`);
    console.log(`   Published: ${ranking.publishedAt || "Not published"}`);
    console.log(`   Created: ${ranking.createdAt}`);
    console.log(`   Updated: ${ranking.updatedAt}`);
    console.log();
  });

  const currentCount = allRankings.filter(r => r.isCurrent).length;
  console.log(`\n📍 Summary:`);
  console.log(`   Total rankings: ${allRankings.length}`);
  console.log(`   Current rankings: ${currentCount}`);
  console.log(`   Most recent period: ${allRankings[allRankings.length - 1]?.period}`);

  process.exit(0);
}

listRankings().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
