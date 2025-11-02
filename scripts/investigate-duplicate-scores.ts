#!/usr/bin/env tsx
/**
 * Investigate Duplicate Scores Issue
 *
 * Check why Google Jules, Refact.ai, and Devin have identical scores
 */

import { getDb } from "../lib/db/connection";
import { rankings } from "../lib/db/schema";
import { eq } from "drizzle-orm";

async function investigateDuplicateScores() {
  const db = getDb();
  if (!db) {
    console.error("❌ Database connection not available");
    process.exit(1);
  }

  console.log("🔍 Investigating duplicate scores for October 2025...\n");

  try {
    // Get the three tools in question
    const suspectSlugs = ['google-jules', 'refact-ai', 'devin'];

    console.log("📊 Step 1: Get October 2025 rankings");
    const currentRankings = await db
      .select()
      .from(rankings)
      .where(eq(rankings.period, '2025-10'))
      .limit(1);

    if (currentRankings.length === 0) {
      console.log("❌ No October 2025 rankings found!");
      process.exit(1);
    }

    const ranking = currentRankings[0];
    console.log(`   Period: ${ranking.period}`);
    console.log(`   Algorithm: ${ranking.algorithmVersion}`);
    console.log(`   Is Current: ${ranking.isCurrent}`);
    console.log();

    const rankingsData = ranking.data as any[];
    console.log(`   Total tools in rankings: ${rankingsData.length}\n`);

    // Find the three suspect tools
    console.log("📈 Step 2: Display scores for suspect tools\n");
    const suspectTools = rankingsData.filter((r: any) =>
      suspectSlugs.includes(r.tool_slug)
    );

    if (suspectTools.length === 0) {
      console.log("❌ None of the suspect tools found in rankings!");
      process.exit(1);
    }

    console.log(`   Found ${suspectTools.length} of ${suspectSlugs.length} tools:\n`);

    for (const tool of suspectTools) {
      console.log(`   ${tool.tool_slug}:`);
      console.log(`      Rank: #${tool.rank}`);
      console.log(`      Score: ${tool.score}`);
      console.log(`      Tier: ${tool.tier}`);
      console.log(`      Category: ${tool.category}`);

      if (tool.factor_scores) {
        console.log(`      Factor Scores:`);
        Object.entries(tool.factor_scores).forEach(([factor, score]) => {
          console.log(`         ${factor}: ${score}`);
        });
      }
      console.log();
    }

    // Check for exact duplicates
    console.log("🔍 Step 3: Check for exact duplicate scores");
    const scorePatterns = new Map<string, string[]>();

    for (const tool of suspectTools) {
      const scoreKey = JSON.stringify({
        score: tool.score,
        factor_scores: tool.factor_scores
      });

      if (!scorePatterns.has(scoreKey)) {
        scorePatterns.set(scoreKey, []);
      }
      scorePatterns.get(scoreKey)!.push(tool.tool_slug);
    }

    let foundDuplicates = false;
    for (const [scores, toolSlugs] of scorePatterns.entries()) {
      if (toolSlugs.length > 1) {
        foundDuplicates = true;
        console.log(`   ❌ DUPLICATE SCORES FOUND IN DATABASE:`);
        console.log(`      Tools: ${toolSlugs.join(', ')}`);
        console.log(`      Identical data: ${scores.substring(0, 200)}...`);
        console.log();
      }
    }

    if (!foundDuplicates) {
      console.log("   ✅ No duplicate scores found in database!");
      console.log("   Each tool has unique scores stored.");
      console.log();
    }

    // Check if these exact scores appear elsewhere
    console.log("📊 Step 4: Check if score=60 appears for other tools");
    const score60Tools = rankingsData.filter((r: any) => r.score === 60);
    console.log(`   Tools with overall score 60: ${score60Tools.length}`);

    if (score60Tools.length > 0) {
      console.log(`   Tools with score 60:`);
      score60Tools.forEach((t: any) => {
        console.log(`      - ${t.tool_slug} (rank #${t.rank})`);
      });
    }

    // Check missing tools
    console.log("\n📊 Step 5: Check for missing tools");
    const foundSlugs = suspectTools.map((t: any) => t.tool_slug);
    const missingSlugs = suspectSlugs.filter(slug => !foundSlugs.includes(slug));

    if (missingSlugs.length > 0) {
      console.log(`   ⚠️  Missing tools: ${missingSlugs.join(', ')}`);
      console.log(`   These tools exist in the database but not in October rankings!`);
    } else {
      console.log(`   ✅ All suspect tools found in rankings`);
    }

    console.log("\n✅ Investigation complete!");
    console.log("\n" + "=".repeat(80));
    console.log("SUMMARY:");
    console.log("=".repeat(80));
    if (foundDuplicates) {
      console.log("❌ ISSUE CONFIRMED: Duplicate scores exist in database");
      console.log("   This is a DATA CORRUPTION issue that needs regeneration");
    } else {
      console.log("✅ NO DUPLICATES IN DATABASE");
      console.log("   Issue is likely in API or frontend display layer");
    }
    console.log("=".repeat(80));

    process.exit(foundDuplicates ? 1 : 0);

  } catch (error) {
    console.error("\n❌ Error investigating:", error);
    if (error instanceof Error) {
      console.error("   Error message:", error.message);
    }
    process.exit(1);
  }
}

investigateDuplicateScores().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
