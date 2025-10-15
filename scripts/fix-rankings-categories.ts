#!/usr/bin/env tsx

/**
 * Fix Rankings Categories - Ensure category field is in rankings data
 *
 * This script updates the current rankings to include the category field
 * directly in the rankings JSONB data, so we don't rely solely on tool lookups.
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { rankings, tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function fixRankingsCategories() {
  const db = getDb();

  console.log("🔧 Fixing Rankings Categories\n");
  console.log("=".repeat(80));

  // 1. Get current rankings
  console.log("\n1. Fetching current rankings...\n");
  const currentRankings = await db
    .select()
    .from(rankings)
    .where(eq(rankings.isCurrent, true))
    .limit(1);

  if (currentRankings.length === 0) {
    console.log("❌ No current rankings found!");
    return;
  }

  const rankingRecord = currentRankings[0];
  const rankingsData = rankingRecord.data as any;

  let rankingsArray = [];
  if (Array.isArray(rankingsData)) {
    rankingsArray = rankingsData;
  } else if (rankingsData?.rankings) {
    rankingsArray = rankingsData.rankings;
  } else if (rankingsData?.data) {
    rankingsArray = rankingsData.data;
  }

  console.log(`✓ Found ${rankingsArray.length} rankings\n`);

  // 2. Get all tools
  console.log("2. Fetching all tools...\n");
  const allTools = await db.select().from(tools);
  const toolMap = new Map(allTools.map(t => [t.id, t]));
  console.log(`✓ Found ${allTools.length} tools\n`);

  // 3. Update rankings with categories
  console.log("3. Updating rankings with categories...\n");
  let updated = 0;
  let missing = 0;

  const updatedRankings = rankingsArray.map((ranking: any) => {
    const tool = toolMap.get(ranking.tool_id);

    if (tool) {
      // Add category to ranking if missing or incorrect
      if (ranking.category !== tool.category) {
        console.log(`  ✓ ${ranking.tool_name}: ${ranking.category || 'none'} → ${tool.category}`);
        updated++;
      }

      return {
        ...ranking,
        category: tool.category,
        status: tool.status,
      };
    } else {
      console.log(`  ⚠️  ${ranking.tool_name || ranking.tool_id}: Tool not found in database`);
      missing++;
      return ranking;
    }
  });

  console.log(`\n✓ Updated: ${updated} rankings`);
  console.log(`  Missing: ${missing} tools\n`);

  // 4. Save updated rankings
  console.log("4. Saving updated rankings to database...\n");

  const updateResult = await db
    .update(rankings)
    .set({
      data: updatedRankings,
      updatedAt: new Date(),
    })
    .where(eq(rankings.id, rankingRecord.id))
    .returning();

  if (updateResult.length > 0) {
    console.log("✅ Rankings updated successfully!");
  } else {
    console.log("❌ Failed to update rankings");
  }

  console.log("\n" + "=".repeat(80));
}

async function main() {
  try {
    await fixRankingsCategories();
  } catch (error) {
    console.error("\n❌ Error:", error);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

main();
