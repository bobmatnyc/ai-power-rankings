#!/usr/bin/env tsx

/**
 * Regenerate October 2025 Rankings After Jules Fix
 *
 * This script updates the existing October 2025 ranking to remove the Jules duplicate.
 * Instead of inserting a new ranking, it updates the existing one with recalculated scores.
 */

import { getDb, closeDb } from '../lib/db/connection';
import { rankings, tools } from '../lib/db/schema';
import { eq } from 'drizzle-orm';
import { RankingEngineV7, ALGORITHM_V7_WEIGHTS } from '../lib/ranking-algorithm-v7';

interface ToolScore {
  tool_id: string;
  tool_name: string;
  tool_slug: string;
  category: string;
  status: string;
  overall_score: number;
  factor_scores: Record<string, number>;
  rank: number;
}

function calculateTier(rank: number): string {
  if (rank <= 5) return "S";
  if (rank <= 15) return "A";
  if (rank <= 30) return "B";
  if (rank <= 45) return "C";
  return "D";
}

async function regenerateOctoberRankings() {
  const db = getDb();
  console.log("\n🔄 Regenerating October 2025 Rankings (Post-Jules Fix)\n");
  console.log("=".repeat(80));

  // Step 1: Get previous rankings for movement calculation
  console.log("\n📥 Loading September 2025 rankings for movement data...");
  const septRankingsResult = await db
    .select()
    .from(rankings)
    .where(eq(rankings.period, '2025-09'))
    .limit(1);

  const previousRankMap: Map<string, number> = new Map();

  if (septRankingsResult.length > 0) {
    const prevData = septRankingsResult[0].data as any;
    const prevRankings = Array.isArray(prevData) ? prevData : prevData?.rankings || [];

    prevRankings.forEach((r: any) => {
      const toolId = r.tool_id || r.id;
      const rank = r.rank || r.position;
      if (toolId && rank) {
        previousRankMap.set(toolId, rank);
      }
    });

    console.log(`✓ Loaded ${previousRankMap.size} previous rankings`);
  } else {
    console.log("⚠️  No September rankings found");
  }

  // Step 2: Load all ACTIVE tools (this will exclude the redirect Jules)
  console.log("\n📚 Loading active tools from database...");
  const allTools = await db.select().from(tools).where(eq(tools.status, "active"));
  console.log(`✓ Found ${allTools.length} active tools (redirects excluded)\n`);

  // Step 3: Calculate scores with v7.2
  console.log("🧮 Calculating scores with Algorithm v7.2...\n");
  const engine = new RankingEngineV7(ALGORITHM_V7_WEIGHTS);
  const toolScores: ToolScore[] = [];

  for (const tool of allTools) {
    const toolData = tool.data as any;

    const metrics = {
      tool_id: tool.id,
      name: tool.name,
      category: tool.category,
      status: tool.status,
      info: toolData,
    };

    try {
      const score = engine.calculateToolScore(metrics);

      toolScores.push({
        tool_id: tool.id,
        tool_name: tool.name,
        tool_slug: tool.slug,
        category: tool.category,
        status: tool.status,
        overall_score: score.overallScore,
        factor_scores: score.factorScores,
        rank: 0, // Will be assigned after sorting
      });
    } catch (error) {
      console.error(`   ⚠️  Error scoring ${tool.name}:`, error);
    }
  }

  // Step 4: Sort and assign ranks
  toolScores.sort((a, b) => b.overall_score - a.overall_score);
  toolScores.forEach((tool, index) => {
    tool.rank = index + 1;
  });

  console.log(`✓ Scored and ranked ${toolScores.length} tools\n`);
  console.log("🏆 Top 10 Rankings:\n");
  console.log("Rank | Tool                         | Score | Tier | Movement");
  console.log("-".repeat(75));

  toolScores.slice(0, 10).forEach((tool) => {
    const prevRank = previousRankMap.get(tool.tool_id);
    let movement = "NEW";

    if (prevRank) {
      const change = prevRank - tool.rank;
      if (change > 0) movement = `↑${change}`;
      else if (change < 0) movement = `↓${Math.abs(change)}`;
      else movement = "→";
    }

    console.log(
      `${String(tool.rank).padStart(4)} | ` +
      `${tool.tool_name.substring(0, 28).padEnd(28)} | ` +
      `${tool.overall_score.toFixed(1).padStart(5)} | ` +
      `${calculateTier(tool.rank).padStart(4)} | ` +
      `${movement.padStart(8)}`
    );
  });

  // Step 5: Build rankings data structure
  const rankingsData = toolScores.map((tool) => {
    const prevRank = previousRankMap.get(tool.tool_id);
    const rankChange = prevRank ? prevRank - tool.rank : 0;

    return {
      tool_id: tool.tool_id,
      tool_name: tool.tool_name,
      tool_slug: tool.tool_slug,
      rank: tool.rank,
      score: tool.overall_score,
      tier: calculateTier(tool.rank),
      factor_scores: tool.factor_scores,
      category: tool.category,
      status: tool.status,
      movement: {
        previous_position: prevRank || null,
        change: rankChange,
        direction: rankChange > 0 ? "up" : rankChange < 0 ? "down" : "same",
      },
    };
  });

  // Step 6: Update existing October ranking
  console.log("\n\n💾 Updating October 2025 rankings in database...");

  const period = "2025-10";

  try {
    // Update the existing October 2025 ranking
    const result = await db
      .update(rankings)
      .set({
        data: rankingsData as any,
        updatedAt: new Date(),
      })
      .where(eq(rankings.period, period))
      .returning({ id: rankings.id });

    if (result.length === 0) {
      console.log("⚠️  No existing October ranking found, inserting new one...");

      // Unset all current rankings first
      await db.update(rankings).set({ isCurrent: false });

      // Insert new ranking
      await db.insert(rankings).values({
        period,
        algorithmVersion: "7.2",
        isCurrent: true,
        publishedAt: new Date(),
        data: rankingsData as any,
      });
      console.log("✓ Inserted new October 2025 ranking");
    } else {
      console.log(`✓ Updated October 2025 ranking with ${rankingsData.length} tools`);
    }

    console.log("\n" + "=".repeat(80));
    console.log("✅ October 2025 Rankings Regenerated Successfully!");
    console.log("=".repeat(80));

    console.log("\n📊 Summary:");
    console.log(`   Period:            ${period}`);
    console.log(`   Total Tools:       ${rankingsData.length}`);
    console.log(`   Timestamp:         ${new Date().toISOString()}`);

    // Verify Jules only appears once
    const julesEntries = rankingsData.filter(r => r.tool_name === 'Google Jules');
    console.log(`\n🔍 Jules Verification:`);
    console.log(`   Found ${julesEntries.length} Jules entry (expected: 1)`);
    if (julesEntries.length === 1) {
      const jules = julesEntries[0];
      console.log(`   ✓ Rank: #${jules.rank}`);
      console.log(`   ✓ Score: ${jules.score.toFixed(1)}`);
      console.log(`   ✓ Slug: ${jules.tool_slug}`);
    } else if (julesEntries.length > 1) {
      console.log(`   ❌ ERROR: Multiple Jules entries found!`);
      julesEntries.forEach((entry, i) => {
        console.log(`      Entry ${i + 1}: rank #${entry.rank}, slug: ${entry.tool_slug}`);
      });
    }

  } catch (error) {
    console.error("\n❌ Error updating rankings:", error);
    throw error;
  } finally {
    await closeDb();
  }
}

// Run the script
regenerateOctoberRankings()
  .then(() => {
    console.log("\n✨ Done! Rankings updated after Jules fix\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Fatal Error:", error);
    process.exit(1);
  });
