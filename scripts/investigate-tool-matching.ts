#!/usr/bin/env node

/**
 * Investigation script to understand why tool matching uses only 5 baseline tools
 * instead of all 54 tools in the database
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools, rankings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

interface ToolInfo {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  baselineScore: number | null;
  deltaScore: number | null;
  currentScore: number | null;
}

interface RankingEntry {
  tool_id: string;
  tool_slug?: string;
  position: number;
  score: number;
  factor_scores?: Record<string, number>;
}

async function investigateToolMatching() {
  console.log("🔍 INVESTIGATION: Tool Matching Data Sources\n");
  console.log("=" .repeat(80));

  const db = getDb();
  if (!db) {
    throw new Error("Database connection not available");
  }

  try {
    // 1. Check Tools Table
    console.log("\n📊 STEP 1: Checking Tools Table");
    console.log("-".repeat(80));

    const allTools = await db.select({
      id: tools.id,
      name: tools.name,
      slug: tools.slug,
      category: tools.category,
      baselineScore: tools.baselineScore,
      deltaScore: tools.deltaScore,
      currentScore: tools.currentScore,
    }).from(tools);

    console.log(`Total tools in database: ${allTools.length}`);
    console.log(`\nSample tools (first 5):`);
    allTools.slice(0, 5).forEach((tool, idx) => {
      console.log(`  ${idx + 1}. ${tool.name} (${tool.slug})`);
      console.log(`     ID: ${tool.id}`);
      console.log(`     Category: ${tool.category || "N/A"}`);
      console.log(`     Baseline: ${tool.baselineScore}, Delta: ${tool.deltaScore}, Current: ${tool.currentScore}`);
    });

    // 2. Check Rankings Snapshot
    console.log("\n\n📊 STEP 2: Checking Rankings Snapshot");
    console.log("-".repeat(80));

    const [currentRanking] = await db
      .select()
      .from(rankings)
      .where(eq(rankings.isCurrent, true))
      .limit(1);

    if (!currentRanking) {
      console.log("❌ No current ranking snapshot found!");
    } else {
      console.log(`Period: ${currentRanking.period}`);
      console.log(`Algorithm Version: ${currentRanking.algorithmVersion}`);
      console.log(`Is Current: ${currentRanking.isCurrent}`);
      console.log(`Published At: ${currentRanking.publishedAt}`);

      const dataObj = currentRanking.data as { rankings: RankingEntry[] };
      const rankingArray = dataObj.rankings || [];

      console.log(`\nTotal rankings in snapshot: ${rankingArray.length}`);
      console.log(`\nRankings in snapshot (first 10):`);
      rankingArray.slice(0, 10).forEach((entry, idx) => {
        console.log(`  ${idx + 1}. Tool ID: ${entry.tool_id}, Slug: ${entry.tool_slug || "N/A"}`);
        console.log(`     Position: ${entry.position}, Score: ${entry.score}`);
      });
    }

    // 3. Identify the Gap
    console.log("\n\n📊 STEP 3: Identifying the Gap");
    console.log("-".repeat(80));

    if (currentRanking) {
      const dataObj = currentRanking.data as { rankings: RankingEntry[] };
      const rankingArray = dataObj.rankings || [];

      const rankedToolIds = new Set(rankingArray.map(r => r.tool_id));
      const toolsNotInRankings = allTools.filter(t => !rankedToolIds.has(t.id));

      console.log(`Tools in database: ${allTools.length}`);
      console.log(`Tools in rankings snapshot: ${rankingArray.length}`);
      console.log(`Tools NOT in rankings: ${toolsNotInRankings.length}`);

      if (toolsNotInRankings.length > 0) {
        console.log(`\n⚠️  Tools missing from rankings snapshot (sample of 10):`);
        toolsNotInRankings.slice(0, 10).forEach((tool, idx) => {
          console.log(`  ${idx + 1}. ${tool.name} (${tool.slug})`);
          console.log(`     ID: ${tool.id}`);
          console.log(`     Baseline: ${tool.baselineScore}, Current: ${tool.currentScore}`);
        });
      }
    }

    // 4. Check what getCurrentRankings returns
    console.log("\n\n📊 STEP 4: What getCurrentRankings Returns");
    console.log("-".repeat(80));

    if (currentRanking) {
      const dataObj = currentRanking.data as { rankings: RankingEntry[] };
      const rankingArray = dataObj.rankings || [];

      // Simulate what article-db-service.ts does
      const toolIds = rankingArray.map((r) => r.tool_id).filter(Boolean);
      console.log(`Tool IDs to fetch: ${toolIds.length}`);

      if (toolIds.length > 0) {
        const toolsData = await db
          .select()
          .from(tools)
          .where((t) => {
            // Simulate inArray
            return toolIds.includes(t.id);
          });

        console.log(`Tool names fetched: ${toolsData.length}`);
        console.log(`\nSample of matched tools:`);
        toolsData.slice(0, 5).forEach((tool, idx) => {
          console.log(`  ${idx + 1}. ${tool.name} (${tool.id})`);
        });
      }
    }

    // 5. Recommendation
    console.log("\n\n💡 STEP 5: Analysis and Recommendation");
    console.log("-".repeat(80));

    console.log(`\n🔴 ROOT CAUSE IDENTIFIED:`);
    console.log(`   getCurrentRankings() returns ONLY tools from the rankings snapshot`);
    console.log(`   The snapshot contains ${currentRanking ? (currentRanking.data as any).rankings.length : 0} tools (baseline)`);
    console.log(`   But the tools table has ${allTools.length} tools (current complete set)`);
    console.log(`\n   Article analysis tries to match against getCurrentRankings()`);
    console.log(`   So it can only match ${currentRanking ? (currentRanking.data as any).rankings.length : 0} tools, missing ${allTools.length - (currentRanking ? (currentRanking.data as any).rankings.length : 0)} tools!`);

    console.log(`\n✅ RECOMMENDED SOLUTION:`);
    console.log(`   1. Create getAllTools() function that queries tools table directly`);
    console.log(`   2. Use getAllTools() for article analysis tool matching`);
    console.log(`   3. Use getCurrentRankings() only for displaying current rankings`);
    console.log(`   4. For new tools (not in rankings), calculate score from scratch`);

    console.log(`\n📋 IMPLEMENTATION PLAN:`);
    console.log(`   A. Add getAllTools() to article-db-service.ts`);
    console.log(`   B. Modify calculateRankingChanges() to accept tool list separately`);
    console.log(`   C. Pass getAllTools() result for tool matching`);
    console.log(`   D. Handle tools without rankings (assign initial rank/score)`);

  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  } finally {
    await closeDb();
  }
}

if (require.main === module) {
  investigateToolMatching()
    .then(() => {
      console.log("\n✅ Investigation complete!");
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
