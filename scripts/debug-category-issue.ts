#!/usr/bin/env tsx

/**
 * Debug Category Issue - Why are categories showing as "unknown"?
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { rankings, tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function debugCategories() {
  const db = getDb();

  console.log("🔍 Debugging Category Issue\n");
  console.log("=".repeat(80));

  // 1. Check current rankings
  console.log("\n1. Checking current rankings...\n");
  const currentRankings = await db
    .select()
    .from(rankings)
    .where(eq(rankings.isCurrent, true))
    .limit(1);

  if (currentRankings.length === 0) {
    console.log("❌ No current rankings found!");
    return;
  }

  const rankingsData = currentRankings[0].data as any;
  let rankingsArray = [];

  if (Array.isArray(rankingsData)) {
    rankingsArray = rankingsData;
  } else if (rankingsData?.rankings) {
    rankingsArray = rankingsData.rankings;
  } else if (rankingsData?.data) {
    rankingsArray = rankingsData.data;
  }

  console.log(`✓ Found ${rankingsArray.length} rankings`);
  console.log(`Period: ${currentRankings[0].period}`);
  console.log(`Algorithm: ${currentRankings[0].algorithmVersion}\n`);

  // 2. Check first 5 tool IDs from rankings
  console.log("2. Sample tool IDs from rankings:\n");
  rankingsArray.slice(0, 5).forEach((r: any, i: number) => {
    console.log(`  ${i + 1}. ${r.tool_name || 'Unknown'} - ID: ${r.tool_id}`);
  });

  // 3. Check tools table
  console.log("\n3. Checking tools table...\n");
  const allTools = await db.select().from(tools);
  console.log(`✓ Found ${allTools.length} tools in database`);

  // 4. Check if tool IDs match
  console.log("\n4. Checking ID matches:\n");
  const toolIds = rankingsArray.slice(0, 10).map((r: any) => r.tool_id);
  const toolMap = new Map(allTools.map(t => [t.id, t]));

  for (const toolId of toolIds) {
    const tool = toolMap.get(toolId);
    if (tool) {
      console.log(`  ✓ ${tool.name} - Category: ${tool.category}`);
    } else {
      console.log(`  ❌ Tool ID ${toolId} NOT FOUND in tools table`);
    }
  }

  // 5. Check categories in tools table
  console.log("\n5. Categories in tools table:\n");
  const categoryCounts = new Map<string, number>();
  allTools.forEach(t => {
    const count = categoryCounts.get(t.category) || 0;
    categoryCounts.set(t.category, count + 1);
  });

  Array.from(categoryCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => {
      console.log(`  ${cat}: ${count} tools`);
    });

  console.log("\n" + "=".repeat(80));
}

async function main() {
  try {
    await debugCategories();
  } catch (error) {
    console.error("\n❌ Error:", error);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

main();
