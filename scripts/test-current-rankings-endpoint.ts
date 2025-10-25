/**
 * Test Current Rankings Endpoint
 *
 * Directly tests the database query that the API endpoint uses
 */

import { rankingsRepository } from "../lib/db/repositories/rankings.repository";
import { loggers } from "../lib/logger";

async function testCurrentRankings() {
  console.log("🧪 Testing current rankings query...\n");

  try {
    const startTime = Date.now();
    const currentRankings = await rankingsRepository.getCurrentRankings();
    const queryTime = Date.now() - startTime;

    if (!currentRankings) {
      console.log("❌ No current rankings found");
      console.log("   This means is_current = true is not set on any ranking");
      process.exit(1);
    }

    console.log("✅ Current rankings found!");
    console.log(`   Query time: ${queryTime}ms`);
    console.log(`   Period: ${currentRankings.period}`);
    console.log(`   Algorithm: ${currentRankings.algorithm_version}`);
    console.log(`   Is Current: ${currentRankings.is_current ? "✅ YES" : "❌ NO"}`);
    console.log(`   Published: ${currentRankings.published_at}`);

    // Check the data field
    const rankingsData = currentRankings.data;
    let rankingsCount = 0;

    if (Array.isArray(rankingsData)) {
      rankingsCount = rankingsData.length;
    } else if (rankingsData && typeof rankingsData === "object") {
      if (rankingsData["rankings"] && Array.isArray(rankingsData["rankings"])) {
        rankingsCount = rankingsData["rankings"].length;
      } else if (rankingsData["data"] && Array.isArray(rankingsData["data"])) {
        rankingsCount = rankingsData["data"].length;
      }
    }

    console.log(`   Rankings count: ${rankingsCount} tools`);

    if (rankingsCount === 0) {
      console.log("\n⚠️  Warning: Rankings data is empty or in unexpected format");
      console.log("   Data structure:", JSON.stringify(rankingsData).substring(0, 200));
    } else {
      console.log("\n✅ Rankings data looks good!");
    }

    console.log("\n🎉 Test passed! The /api/rankings/current endpoint should work.");
    process.exit(0);

  } catch (error) {
    console.error("\n❌ Error testing current rankings:", error);
    process.exit(1);
  }
}

testCurrentRankings().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
