#!/usr/bin/env tsx

/**
 * Update October 2025 Rankings with Algorithm v7.2
 *
 * UPDATES the existing 2025-10 ranking period (instead of inserting new one)
 * with proper v7.2 algorithm calculations based on actual tool data.
 *
 * Process:
 * 1. Load all active tools from database
 * 2. Calculate scores using v7.2 algorithm
 * 3. Sort and rank tools by score
 * 4. Compare with previous rankings for movement data
 * 5. UPDATE existing 2025-10 ranking period
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { rankings, tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { RankingEngineV7, ALGORITHM_V7_WEIGHTS } from "@/lib/ranking-algorithm-v7";

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

async function updateV72Rankings() {
  const db = getDb();
  console.log("\n🔄 Updating October 2025 Rankings with Algorithm v7.2\n");
  console.log("=".repeat(80));
  console.log("\n📊 Algorithm v7.2 Weights:");
  console.log(`   Agentic Capability:    ${ALGORITHM_V7_WEIGHTS.agenticCapability.toFixed(3)} (↑ from 0.250)`);
  console.log(`   Developer Adoption:    ${ALGORITHM_V7_WEIGHTS.developerAdoption.toFixed(3)}`);
  console.log(`   Market Traction:       ${ALGORITHM_V7_WEIGHTS.marketTraction.toFixed(3)}`);
  console.log(`   Business Sentiment:    ${ALGORITHM_V7_WEIGHTS.businessSentiment.toFixed(3)} (↓ from 0.150)`);
  console.log(`   Innovation:            ${ALGORITHM_V7_WEIGHTS.innovation.toFixed(3)} (↓ from 0.125)`);
  console.log(`   Technical Performance: ${ALGORITHM_V7_WEIGHTS.technicalPerformance.toFixed(3)} (↓ from 0.125)`);
  console.log(`   Development Velocity:  ${ALGORITHM_V7_WEIGHTS.developmentVelocity.toFixed(3)}`);
  console.log(`   Platform Resilience:   ${ALGORITHM_V7_WEIGHTS.platformResilience.toFixed(3)} (↓ from 0.050)`);

  // Step 1: Get previous rankings for movement calculation
  console.log("\n📥 Loading current rankings for movement calculation...");
  const prevRankingsResult = await db
    .select()
    .from(rankings)
    .where(eq(rankings.isCurrent, true))
    .limit(1);

  const previousRankMap: Map<string, number> = new Map();

  if (prevRankingsResult.length > 0) {
    const prevData = prevRankingsResult[0].data as any;
    const prevRankings = Array.isArray(prevData) ? prevData : prevData?.rankings || [];

    prevRankings.forEach((r: any) => {
      const toolId = r.tool_id || r.id;
      const rank = r.rank || r.position;
      if (toolId && rank) {
        previousRankMap.set(toolId, rank);
      }
    });

    console.log(`✓ Loaded ${previousRankMap.size} previous rankings for movement calculation`);
  } else {
    console.log("⚠️  No previous rankings found - all movements will be 'new'");
  }

  // Step 2: Load all active tools
  console.log("\n📚 Loading active tools from database...");
  const allTools = await db.select().from(tools).where(eq(tools.status, "active"));
  console.log(`✓ Found ${allTools.length} active tools\n`);

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
  console.log("🏆 Top 15 Rankings:\n");
  console.log("Rank | Tool                         | Score | Tier | Movement");
  console.log("-".repeat(75));

  toolScores.slice(0, 15).forEach((tool) => {
    const prevRank = previousRankMap.get(tool.tool_id);
    let movement = "NEW";

    if (prevRank) {
      const change = prevRank - tool.rank;
      if (change > 0) movement = `↑${change}`;
      else if (change < 0) movement = `↓${Math.abs(change)}`;
      else movement = "→";
    }

    const isGoose = tool.tool_slug === 'goose';
    const marker = isGoose ? '🦆' : '  ';

    console.log(
      `${marker} ${String(tool.rank).padStart(2)} | ` +
      `${tool.tool_name.substring(0, 28).padEnd(28)} | ` +
      `${tool.overall_score.toFixed(1).padStart(5)} | ` +
      `${calculateTier(tool.rank).padStart(4)} | ` +
      `${movement.padStart(8)}`
    );
  });

  // Find Goose
  const goose = toolScores.find(t => t.tool_slug === 'goose');
  if (goose && goose.rank > 15) {
    console.log(`\n🦆 Goose is now at rank #${goose.rank} (score: ${goose.overall_score.toFixed(1)})`);
  }

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

  // Step 6: UPDATE database (not insert)
  console.log("\n\n💾 Updating rankings in database...");

  const period = "2025-10";
  const algorithmVersion = "7.2";

  try {
    // Get the existing ranking ID
    const existingRanking = await db
      .select()
      .from(rankings)
      .where(eq(rankings.period, period))
      .limit(1);

    if (existingRanking.length === 0) {
      throw new Error(`No ranking found for period ${period}`);
    }

    const rankingId = existingRanking[0].id;

    // First, unset all current rankings
    await db.update(rankings).set({ isCurrent: false });
    console.log("✓ Unmarked all previous rankings as current");

    // Update the existing ranking
    await db
      .update(rankings)
      .set({
        algorithmVersion,
        isCurrent: true,
        publishedAt: new Date(),
        data: rankingsData as any,
        updatedAt: new Date(),
      })
      .where(eq(rankings.id, rankingId));

    console.log(`✓ Updated ${rankingsData.length} rankings for period ${period}`);
    console.log(`✓ Marked as current with algorithm version ${algorithmVersion}`);

    console.log("\n" + "=".repeat(80));
    console.log("✅ October 2025 Rankings Updated Successfully!");
    console.log("=".repeat(80));

    console.log("\n📊 Summary:");
    console.log(`   Period:            ${period}`);
    console.log(`   Algorithm Version: v${algorithmVersion}`);
    console.log(`   Total Tools:       ${rankingsData.length}`);
    console.log(`   Timestamp:         ${new Date().toISOString()}`);
    console.log(`   Is Current:        true`);

    console.log("\n🔥 Notable Changes:");
    const significantMoves = rankingsData
      .filter(r => Math.abs(r.movement.change) >= 5)
      .sort((a, b) => Math.abs(b.movement.change) - Math.abs(a.movement.change))
      .slice(0, 10);

    if (significantMoves.length > 0) {
      significantMoves.forEach(r => {
        const direction = r.movement.change > 0 ? "↑" : "↓";
        const marker = r.tool_slug === 'goose' ? '🦆' : '  ';
        console.log(
          `${marker} ${direction} ${Math.abs(r.movement.change).toString().padStart(2)} positions: ` +
          `${r.tool_name.padEnd(25)} (#${r.movement.previous_position} → #${r.rank})`
        );
      });
    } else {
      console.log("   No significant position changes (±5 ranks)");
    }

    // Goose-specific reporting
    if (goose) {
      const prevGooseRank = previousRankMap.get(goose.tool_id) || 1;
      console.log("\n🦆 Goose Correction:");
      console.log(`   Previous Rank: #${prevGooseRank}`);
      console.log(`   New Rank:      #${goose.rank}`);
      console.log(`   Change:        ${goose.rank > prevGooseRank ? '↓' : '↑'} ${Math.abs(goose.rank - prevGooseRank)} positions`);
      console.log(`   Score:         ${goose.overall_score.toFixed(1)}/100`);
      console.log(`   Tier:          ${calculateTier(goose.rank)}`);
    }

  } catch (error) {
    console.error("\n❌ Error updating rankings:", error);
    throw error;
  } finally {
    await closeDb();
  }
}

// Run the script
updateV72Rankings()
  .then(() => {
    console.log("\n✨ Done! Rankings have been corrected with Algorithm v7.2\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Fatal Error:", error);
    process.exit(1);
  });
