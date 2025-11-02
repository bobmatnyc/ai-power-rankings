#!/usr/bin/env tsx

/**
 * Verify Algorithm v7.3 Deployment Status
 *
 * Checks the current state of rankings in the database to determine if v7.3
 * has been deployed successfully.
 *
 * Verification checks:
 * 1. Current rankings exist for period 2025-11
 * 2. Algorithm version is 7.3
 * 3. Rankings are marked as current (is_current = true)
 * 4. Score distribution meets success criteria (<20% duplicates)
 * 5. Top 10 tools have unique scores
 * 6. Movement data is present and valid
 */

import { getDb, closeDb } from "@/lib/db/connection";
import { rankings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

interface RankingEntry {
  tool_id: string;
  tool_name: string;
  tool_slug: string;
  rank: number;
  score: number;
  tier: string;
  category: string;
  movement?: {
    previous_position: number | null;
    change: number;
    direction: string;
  };
}

async function verifyV73Deployment() {
  console.log("\n🔍 Algorithm v7.3 Deployment Verification\n");
  console.log("=".repeat(80));

  const db = getDb();
  let allChecksPassed = true;

  try {
    // Check 1: Current rankings exist
    console.log("\n✓ Check 1: Current Rankings Exist");
    console.log("-".repeat(80));

    const currentRankings = await db
      .select()
      .from(rankings)
      .where(eq(rankings.isCurrent, true))
      .limit(1);

    if (currentRankings.length === 0) {
      console.log("❌ FAIL: No current rankings found in database");
      allChecksPassed = false;
      return;
    }

    const current = currentRankings[0];
    console.log(`✓ Found current rankings`);
    console.log(`   Period: ${current.period}`);
    console.log(`   Algorithm Version: ${current.algorithmVersion}`);
    console.log(`   Published At: ${current.publishedAt?.toISOString() || "Not set"}`);
    console.log(`   Is Current: ${current.isCurrent}`);

    // Check 2: Period is 2025-11
    console.log("\n✓ Check 2: Period Verification");
    console.log("-".repeat(80));

    if (current.period !== "2025-11") {
      console.log(`❌ FAIL: Expected period 2025-11, got ${current.period}`);
      console.log(`   This indicates v7.3 rankings have not been deployed yet`);
      allChecksPassed = false;
      return;
    }

    console.log(`✓ PASS: Period is 2025-11 (November 2025)`);

    // Check 3: Algorithm version is 7.3
    console.log("\n✓ Check 3: Algorithm Version");
    console.log("-".repeat(80));

    if (current.algorithmVersion !== "7.3") {
      console.log(`❌ FAIL: Expected algorithm version 7.3, got ${current.algorithmVersion}`);
      console.log(`   This indicates a different algorithm version is deployed`);
      allChecksPassed = false;
    } else {
      console.log(`✓ PASS: Algorithm version is 7.3`);
    }

    // Check 4: Rankings data structure
    console.log("\n✓ Check 4: Rankings Data Structure");
    console.log("-".repeat(80));

    const rankingsData = current.data as any;
    let rankingsList: RankingEntry[] = [];

    if (Array.isArray(rankingsData)) {
      rankingsList = rankingsData;
    } else if (rankingsData?.rankings && Array.isArray(rankingsData.rankings)) {
      rankingsList = rankingsData.rankings;
    } else {
      console.log("❌ FAIL: Unable to parse rankings data structure");
      console.log(`   Data type: ${typeof rankingsData}`);
      allChecksPassed = false;
      return;
    }

    console.log(`✓ PASS: Found ${rankingsList.length} ranked tools`);

    if (rankingsList.length === 0) {
      console.log("❌ FAIL: Rankings list is empty");
      allChecksPassed = false;
      return;
    }

    // Check 5: Score distribution analysis
    console.log("\n✓ Check 5: Score Distribution Analysis");
    console.log("-".repeat(80));

    const scoreMap = new Map<number, string[]>();
    rankingsList.forEach((entry) => {
      const existing = scoreMap.get(entry.score) || [];
      existing.push(entry.tool_name);
      scoreMap.set(entry.score, existing);
    });

    const uniqueScores = scoreMap.size;
    const duplicateGroups = Array.from(scoreMap.entries()).filter(
      ([_, tools]) => tools.length > 1
    );
    const duplicateTools = duplicateGroups.reduce(
      (sum, [_, tools]) => sum + tools.length,
      0
    );
    const duplicatePercentage = (duplicateTools / rankingsList.length) * 100;

    console.log(`   Total Tools:           ${rankingsList.length}`);
    console.log(`   Unique Scores:         ${uniqueScores}`);
    console.log(`   Duplicate Groups:      ${duplicateGroups.length}`);
    console.log(`   Tools with Duplicates: ${duplicateTools}`);
    console.log(`   Duplicate Percentage:  ${duplicatePercentage.toFixed(1)}%`);

    // Success criterion: < 20% duplicates
    if (duplicatePercentage >= 20) {
      console.log(`\n   ❌ FAIL: Duplicate percentage (${duplicatePercentage.toFixed(1)}%) exceeds 20% threshold`);
      console.log(`   This is similar to v7.2's problem (72.5% duplicates)`);
      allChecksPassed = false;
    } else {
      console.log(`\n   ✓ PASS: Duplicate percentage (${duplicatePercentage.toFixed(1)}%) is below 20% threshold`);
    }

    // Check 6: Top 10 uniqueness
    console.log("\n✓ Check 6: Top 10 Uniqueness");
    console.log("-".repeat(80));

    const top10 = rankingsList.slice(0, 10);
    const top10Scores = new Set(top10.map((t) => t.score));

    if (top10Scores.size === 10) {
      console.log(`✓ PASS: All top 10 tools have unique scores`);
    } else {
      console.log(`❌ FAIL: Top 10 has ${10 - top10Scores.size} duplicate scores`);
      allChecksPassed = false;
    }

    // Display top 10
    console.log("\n   Top 10 Rankings:");
    console.log("   " + "-".repeat(76));
    console.log("   Rank | Tool                         | Score     | Tier | Movement");
    console.log("   " + "-".repeat(76));

    top10.forEach((entry) => {
      const movement = entry.movement?.change
        ? entry.movement.change > 0
          ? `↑${entry.movement.change}`
          : entry.movement.change < 0
          ? `↓${Math.abs(entry.movement.change)}`
          : "→"
        : "NEW";

      console.log(
        `   ${String(entry.rank).padStart(4)} | ` +
        `${entry.tool_name.substring(0, 28).padEnd(28)} | ` +
        `${entry.score.toFixed(3).padStart(9)} | ` +
        `${entry.tier.padStart(4)} | ` +
        `${movement.padStart(8)}`
      );
    });

    // Check 7: Top 20 uniqueness
    console.log("\n✓ Check 7: Top 20 Uniqueness");
    console.log("-".repeat(80));

    if (rankingsList.length >= 20) {
      const top20 = rankingsList.slice(0, 20);
      const top20Scores = new Set(top20.map((t) => t.score));

      if (top20Scores.size === 20) {
        console.log(`✓ PASS: All top 20 tools have unique scores`);
      } else {
        console.log(`⚠️  WARNING: Top 20 has ${20 - top20Scores.size} duplicate scores`);
        console.log(`   This is acceptable but not ideal`);
      }
    } else {
      console.log(`⚠️  WARNING: Only ${rankingsList.length} tools ranked (less than 20)`);
    }

    // Check 8: Movement data validation
    console.log("\n✓ Check 8: Movement Data Validation");
    console.log("-".repeat(80));

    const entriesWithMovement = rankingsList.filter(
      (e) => e.movement && e.movement.previous_position !== null
    );
    const newEntries = rankingsList.filter(
      (e) => !e.movement || e.movement.previous_position === null
    );

    console.log(`   Tools with movement data: ${entriesWithMovement.length}`);
    console.log(`   New tools (no history):   ${newEntries.length}`);

    if (entriesWithMovement.length > 0) {
      console.log(`✓ PASS: Movement data is present`);

      // Show significant movers
      const significantMoves = rankingsList
        .filter((e) => e.movement && Math.abs(e.movement.change) >= 5)
        .sort((a, b) => Math.abs(b.movement!.change) - Math.abs(a.movement!.change))
        .slice(0, 5);

      if (significantMoves.length > 0) {
        console.log(`\n   Significant Movers (±5 positions):`);
        significantMoves.forEach((entry) => {
          const direction = entry.movement!.change > 0 ? "↑" : "↓";
          console.log(
            `      ${direction} ${Math.abs(entry.movement!.change)} positions: ` +
            `${entry.tool_name} (#${entry.movement!.previous_position} → #${entry.rank})`
          );
        });
      }
    } else {
      console.log(`⚠️  WARNING: No movement data found`);
      console.log(`   This is expected if this is the first ranking period`);
    }

    // Check 9: Previous rankings check
    console.log("\n✓ Check 9: Previous Rankings Status");
    console.log("-".repeat(80));

    const previousRankings = await db
      .select()
      .from(rankings)
      .where(eq(rankings.period, "2025-10"))
      .limit(1);

    if (previousRankings.length > 0) {
      const prev = previousRankings[0];
      console.log(`✓ Found previous rankings (period ${prev.period})`);
      console.log(`   Algorithm Version: ${prev.algorithmVersion}`);
      console.log(`   Is Current: ${prev.isCurrent}`);

      if (prev.isCurrent === true) {
        console.log(`\n   ❌ FAIL: Previous rankings still marked as current`);
        console.log(`   This should have been set to false when v7.3 was deployed`);
        allChecksPassed = false;
      } else {
        console.log(`\n   ✓ PASS: Previous rankings correctly unmarked as current`);
      }
    } else {
      console.log(`⚠️  No previous rankings found for period 2025-10`);
      console.log(`   This is acceptable if this is the first deployment`);
    }

    // Check 10: Duplicate groups detail (if any)
    if (duplicateGroups.length > 0 && duplicateGroups.length <= 5) {
      console.log("\n✓ Check 10: Duplicate Score Groups Detail");
      console.log("-".repeat(80));
      console.log(`   Found ${duplicateGroups.length} groups with duplicate scores:`);

      duplicateGroups.forEach(([score, tools]) => {
        console.log(`\n   Score ${score.toFixed(3)} (${tools.length} tools):`);
        tools.forEach((toolName) => {
          const entry = rankingsList.find((r) => r.tool_name === toolName);
          if (entry) {
            console.log(`      #${entry.rank} - ${toolName}`);
          }
        });
      });
    }

    // Final summary
    console.log("\n" + "=".repeat(80));
    console.log("📊 VERIFICATION SUMMARY");
    console.log("=".repeat(80));

    if (allChecksPassed) {
      console.log("\n✅ ALL CHECKS PASSED");
      console.log("\n🎉 Algorithm v7.3 is successfully deployed and operational!");
      console.log("\n✓ Rankings for November 2025 (period 2025-11) are live");
      console.log(`✓ Algorithm version 7.3 is active`);
      console.log(`✓ Score distribution meets success criteria (${duplicatePercentage.toFixed(1)}% duplicates)`);
      console.log(`✓ Top 10 tools have unique scores`);
      console.log(`✓ Total of ${rankingsList.length} tools ranked`);

      console.log("\n📈 Improvement vs v7.2:");
      console.log(`   v7.2 Duplicates: 72.5%`);
      console.log(`   v7.3 Duplicates: ${duplicatePercentage.toFixed(1)}%`);
      console.log(`   Improvement:     ↓${(72.5 - duplicatePercentage).toFixed(1)} percentage points`);

      console.log("\n🚀 Next Steps:");
      console.log("   • Rankings are ready for production use");
      console.log("   • Consider announcing v7.3 improvements to users");
      console.log("   • Monitor user feedback on ranking changes");
      console.log("   • Update What's New modal with v7.3 features");
    } else {
      console.log("\n❌ VERIFICATION FAILED");
      console.log("\n⚠️  Algorithm v7.3 deployment has issues that need attention");
      console.log("\n📋 Recommended Actions:");
      console.log("   • Review failed checks above");
      console.log("   • Consider re-running generate-v73-rankings.ts");
      console.log("   • Verify tool data quality in database");
      console.log("   • Check algorithm implementation for bugs");

      console.log("\n🔧 If you need to re-deploy:");
      console.log("   1. Backup current rankings first");
      console.log("   2. Run: npx tsx scripts/generate-v73-rankings.ts");
      console.log("   3. Re-run this verification script");
    }

    console.log("\n" + "=".repeat(80));
    console.log();

  } catch (error) {
    console.error("\n❌ Verification Error:", error);
    console.error("\nFailed to complete verification checks");
    allChecksPassed = false;
  } finally {
    await closeDb();
  }

  // Exit with appropriate code
  process.exit(allChecksPassed ? 0 : 1);
}

// Run verification
verifyV73Deployment();
