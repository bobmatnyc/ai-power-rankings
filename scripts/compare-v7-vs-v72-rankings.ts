#!/usr/bin/env tsx

/**
 * Compare Rankings: Algorithm v7.0 vs v7.2
 *
 * Shows the impact of increasing agenticCapability weight from 0.25 to 0.35
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { RankingEngineV7 } from "@/lib/ranking-algorithm-v7";

// v7.0 weights
const WEIGHTS_V7_0 = {
  agenticCapability: 0.25,
  innovation: 0.125,
  technicalPerformance: 0.125,
  developerAdoption: 0.125,
  marketTraction: 0.125,
  businessSentiment: 0.15,
  developmentVelocity: 0.05,
  platformResilience: 0.05,
};

// v7.2 weights (current)
const WEIGHTS_V7_2 = {
  agenticCapability: 0.35,
  innovation: 0.10,
  technicalPerformance: 0.10,
  developerAdoption: 0.125,
  marketTraction: 0.125,
  businessSentiment: 0.125,
  developmentVelocity: 0.05,
  platformResilience: 0.025,
};

interface RankingResult {
  slug: string;
  name: string;
  category: string;
  v70Score: number;
  v72Score: number;
  scoreDiff: number;
  v70Rank: number;
  v72Rank: number;
  rankChange: number;
  agenticScore: number;
  sweBenchScore?: number;
}

async function calculateRankings() {
  const db = getDb();

  console.log("🔍 Fetching all active tools...\n");
  const allTools = await db.select().from(tools);

  const activeTools = allTools.filter(t => t.status === 'active');
  console.log(`✓ Found ${activeTools.length} active tools\n`);

  const results: RankingResult[] = [];

  for (const tool of activeTools) {
    const toolData = tool.data as any;

    // Create metrics object
    const metrics = {
      tool_id: tool.id,
      name: tool.name,
      category: tool.category,
      status: tool.status,
      info: toolData,
    };

    // Calculate with v7.0 weights
    const engineV70 = new RankingEngineV7(WEIGHTS_V7_0);
    const scoreV70 = engineV70.calculateToolScore(metrics);

    // Calculate with v7.2 weights
    const engineV72 = new RankingEngineV7(WEIGHTS_V7_2);
    const scoreV72 = engineV72.calculateToolScore(metrics);

    results.push({
      slug: tool.slug,
      name: tool.name,
      category: tool.category,
      v70Score: scoreV70.overallScore,
      v72Score: scoreV72.overallScore,
      scoreDiff: scoreV72.overallScore - scoreV70.overallScore,
      v70Rank: 0, // Will be set after sorting
      v72Rank: 0, // Will be set after sorting
      rankChange: 0, // Will be calculated after ranking
      agenticScore: scoreV72.factorScores.agenticCapability,
      sweBenchScore: toolData?.metrics?.swe_bench?.verified || toolData?.technical?.swe_bench_score,
    });
  }

  // Sort by v7.0 score and assign ranks
  const sortedV70 = [...results].sort((a, b) => b.v70Score - a.v70Score);
  sortedV70.forEach((item, index) => {
    const result = results.find(r => r.slug === item.slug);
    if (result) result.v70Rank = index + 1;
  });

  // Sort by v7.2 score and assign ranks
  const sortedV72 = [...results].sort((a, b) => b.v72Score - a.v72Score);
  sortedV72.forEach((item, index) => {
    const result = results.find(r => r.slug === item.slug);
    if (result) result.v72Rank = index + 1;
  });

  // Calculate rank changes
  results.forEach(r => {
    r.rankChange = r.v70Rank - r.v72Rank; // Positive = moved up
  });

  return results;
}

function printResults(results: RankingResult[]) {
  // Sort by v7.2 rank for display
  const sorted = [...results].sort((a, b) => a.v72Rank - b.v72Rank);

  console.log("\n" + "=".repeat(120));
  console.log("🏆 RANKING COMPARISON: v7.0 → v7.2");
  console.log("=".repeat(120));
  console.log("\n📊 TOP 20 TOOLS\n");

  console.log("Rank | Tool Name                    | v7.0→v7.2 | Score Δ  | Agentic | SWE-bench | Category");
  console.log("-".repeat(120));

  sorted.slice(0, 20).forEach(r => {
    const rankChangeStr = r.rankChange > 0
      ? `↑${r.rankChange}`.padEnd(4)
      : r.rankChange < 0
        ? `↓${Math.abs(r.rankChange)}`.padEnd(4)
        : '→'.padEnd(4);

    const scoreChange = r.scoreDiff >= 0 ? `+${r.scoreDiff.toFixed(1)}` : r.scoreDiff.toFixed(1);

    console.log(
      `${String(r.v72Rank).padStart(4)} | ` +
      `${r.name.substring(0, 28).padEnd(28)} | ` +
      `${String(r.v70Rank).padStart(2)}→${String(r.v72Rank).padStart(2)} ${rankChangeStr} | ` +
      `${scoreChange.padStart(6)} | ` +
      `${r.agenticScore.toFixed(1).padStart(7)} | ` +
      `${r.sweBenchScore ? r.sweBenchScore.toFixed(1).padStart(9) : '    -    '} | ` +
      `${r.category}`
    );
  });

  console.log("\n" + "=".repeat(120));
  console.log("\n🔥 BIGGEST GAINERS (Moved Up)\n");

  const gainers = sorted.filter(r => r.rankChange > 0).sort((a, b) => b.rankChange - a.rankChange).slice(0, 10);

  gainers.forEach(r => {
    console.log(
      `↑ ${String(r.rankChange).padStart(2)} ranks: ${r.name.padEnd(30)} ` +
      `(#${r.v70Rank} → #${r.v72Rank}, +${r.scoreDiff.toFixed(1)} points, Agentic: ${r.agenticScore.toFixed(1)})`
    );
  });

  console.log("\n" + "=".repeat(120));
  console.log("\n📉 BIGGEST LOSERS (Moved Down)\n");

  const losers = sorted.filter(r => r.rankChange < 0).sort((a, b) => a.rankChange - b.rankChange).slice(0, 10);

  losers.forEach(r => {
    console.log(
      `↓ ${String(Math.abs(r.rankChange)).padStart(2)} ranks: ${r.name.padEnd(30)} ` +
      `(#${r.v70Rank} → #${r.v72Rank}, ${r.scoreDiff.toFixed(1)} points, Agentic: ${r.agenticScore.toFixed(1)})`
    );
  });

  console.log("\n" + "=".repeat(120));
  console.log("\n📈 STATISTICS\n");

  const avgScoreChange = results.reduce((sum, r) => sum + r.scoreDiff, 0) / results.length;
  const toolsMovedUp = results.filter(r => r.rankChange > 0).length;
  const toolsMovedDown = results.filter(r => r.rankChange < 0).length;
  const toolsStayed = results.filter(r => r.rankChange === 0).length;

  console.log(`Average score change:     ${avgScoreChange.toFixed(2)} points`);
  console.log(`Tools moved up:           ${toolsMovedUp}`);
  console.log(`Tools moved down:         ${toolsMovedDown}`);
  console.log(`Tools stayed same rank:   ${toolsStayed}`);
  console.log(`Total tools analyzed:     ${results.length}`);

  console.log("\n" + "=".repeat(120));
}

async function main() {
  console.log("🚀 Comparing Algorithm v7.0 vs v7.2 Rankings\n");
  console.log("Weight Changes:");
  console.log("  agenticCapability:     0.25 → 0.35 (+40%)");
  console.log("  innovation:            0.125 → 0.10 (-20%)");
  console.log("  technicalPerformance:  0.125 → 0.10 (-20%)");
  console.log("  businessSentiment:     0.15 → 0.125 (-17%)");
  console.log("  platformResilience:    0.05 → 0.025 (-50%)");

  try {
    const results = await calculateRankings();
    printResults(results);
  } catch (error) {
    console.error("\n❌ Error during comparison:", error);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

main();
