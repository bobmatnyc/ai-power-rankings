#!/usr/bin/env tsx

/**
 * Generate November 2025 Rankings with Algorithm v7.6 (Fine-Tuned Market + Innovation Balance)
 *
 * This version combines:
 * 1. npm data quality fix (removed 15 incorrect mappings, 22.9M bogus downloads)
 * 2. Market-validated weights (40% adoption focus: Market Traction 12%, Innovation 10%, Resilience 8%)
 * 3. Missing data penalty (confidence multiplier 0.7-1.0 based on completeness)
 *
 * Key Changes from v7.3:
 * - Increased Developer Adoption weight: 15% → 22%
 * - Increased Market Traction weight: 12% → 18%
 * - Added data completeness confidence multiplier
 * - Fixed data path mismatch (reads from metrics.metrics.* and info.*)
 *
 * Process:
 * 1. Delete existing 2025-11 rankings if present
 * 2. Load all active tools from database (with corrected npm data)
 * 3. Calculate scores using v7.6 algorithm (market-validated weights + missing data penalty)
 * 4. Sort and rank tools by score
 * 5. Compare with previous rankings for movement data
 * 6. Insert as new ranking period (2025-11)
 * 7. Mark as current (is_current = true)
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { rankings, tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { RankingEngineV76, ALGORITHM_V76_WEIGHTS } from "@/lib/ranking-algorithm-v76";

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

async function generateV76Rankings() {
  const db = getDb();
  console.log("\n🚀 Generating November 2025 Rankings with Algorithm v7.6 (Market-Validated + npm Fix)\n");
  console.log("=".repeat(80));
  console.log("\n📊 Algorithm v7.6 Weights (Market-Validated):");
  console.log(`   Agentic Capability:    ${ALGORITHM_V76_WEIGHTS.agenticCapability.toFixed(3)} (↓ from 0.100)`);
  console.log(`   Innovation:            ${ALGORITHM_V76_WEIGHTS.innovation.toFixed(3)} (↓ from 0.100)`);
  console.log(`   Technical Performance: ${ALGORITHM_V76_WEIGHTS.technicalPerformance.toFixed(3)} (unchanged)`);
  console.log(`   Developer Adoption:    ${ALGORITHM_V76_WEIGHTS.developerAdoption.toFixed(3)} (↑ from 0.150) 🔥`);
  console.log(`   Market Traction:       ${ALGORITHM_V76_WEIGHTS.marketTraction.toFixed(3)} (↑ from 0.120) 🔥`);
  console.log(`   Business Sentiment:    ${ALGORITHM_V76_WEIGHTS.businessSentiment.toFixed(3)} (↓ from 0.130)`);
  console.log(`   Development Velocity:  ${ALGORITHM_V76_WEIGHTS.developmentVelocity.toFixed(3)} (↓ from 0.140)`);
  console.log(`   Platform Resilience:   ${ALGORITHM_V76_WEIGHTS.platformResilience.toFixed(3)} (↓ from 0.140)`);

  console.log("\n🎯 Total Adoption Focus:   40% (Developer + Market Traction)");
  console.log("\n🔧 Additional Features:");
  console.log("   ✓ Missing data penalty (0.7-1.0 confidence multiplier)");
  console.log("   ✓ npm data quality fix (22.9M bogus downloads removed)");
  console.log("   ✓ Dual data path support (metrics.metrics.* and info.*)");

  // Step 0: Delete existing 2025-11 rankings if present
  console.log("\n🗑️  Checking for existing 2025-11 rankings...");
  try {
    const existingRankings = await db
      .select()
      .from(rankings)
      .where(eq(rankings.period, "2025-11"))
      .limit(1);

    if (existingRankings.length > 0) {
      await db.delete(rankings).where(eq(rankings.period, "2025-11"));
      console.log("✓ Deleted existing 2025-11 rankings to prevent duplicate key error");
    } else {
      console.log("✓ No existing 2025-11 rankings found");
    }
  } catch (error) {
    console.warn("⚠️  Could not check/delete existing rankings:", error);
  }

  // Step 1: Get previous rankings for movement calculation
  console.log("\n📥 Loading previous rankings for movement calculation...");
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

  // Step 3: Calculate scores with v7.6
  console.log("🧮 Calculating scores with Algorithm v7.6 (Market-Validated + Missing Data Penalty)...\n");
  const engine = new RankingEngineV76(ALGORITHM_V76_WEIGHTS);
  const toolScores: ToolScore[] = [];

  for (const tool of allTools) {
    const toolData = tool.data as any;

    const metrics = {
      tool_id: tool.id,
      name: tool.name,
      slug: tool.slug,
      category: tool.category,
      status: tool.status,
      info: toolData,
      metrics: toolData.metrics || {}, // Pass nested metrics
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
  console.log("🏆 Top 20 Rankings:\n");
  console.log("Rank | Tool                         | Score | Tier | Movement");
  console.log("-".repeat(75));

  toolScores.slice(0, 20).forEach((tool) => {
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

  // Step 6: Insert into database
  console.log("\n\n💾 Inserting rankings into database...");

  const period = "2025-11";
  const algorithmVersion = "7.4";

  try {
    // First, unset all current rankings
    await db.update(rankings).set({ isCurrent: false });
    console.log("✓ Unmarked all previous rankings as current");

    // Insert new rankings
    await db.insert(rankings).values({
      period,
      algorithmVersion,
      isCurrent: true,
      publishedAt: new Date(),
      data: rankingsData as any,
    });

    console.log(`✓ Inserted ${rankingsData.length} rankings for period ${period}`);
    console.log(`✓ Marked as current with algorithm version ${algorithmVersion}`);

    console.log("\n" + "=".repeat(80));
    console.log("✅ November 2025 Rankings Generated Successfully (v7.6)!");
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
      .slice(0, 5);

    if (significantMoves.length > 0) {
      significantMoves.forEach(r => {
        const direction = r.movement.change > 0 ? "↑" : "↓";
        console.log(
          `   ${direction} ${Math.abs(r.movement.change)} positions: ` +
          `${r.tool_name} (#${r.movement.previous_position} → #${r.rank})`
        );
      });
    } else {
      console.log("   No significant position changes (±5 ranks)");
    }

  } catch (error) {
    console.error("\n❌ Error inserting rankings:", error);
    throw error;
  } finally {
    await closeDb();
  }
}

// Run the script
generateV76Rankings()
  .then(() => {
    console.log("\n✨ Done! Rankings are now live with Algorithm v7.6 (market-validated + npm fix)\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Fatal Error:", error);
    process.exit(1);
  });
