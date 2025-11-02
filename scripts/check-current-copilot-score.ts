#!/usr/bin/env tsx

/**
 * Check GitHub Copilot's Current Innovation Score in Rankings
 *
 * Queries the current rankings to see what score is actually stored
 * versus what the algorithm calculates.
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { rankings, tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function checkCurrentScore() {
  const db = getDb();
  console.log("\n🔍 Checking GitHub Copilot's Current Innovation Score\n");
  console.log("=".repeat(80));

  // Get current ranking
  console.log("\n📊 Loading current rankings...");
  const currentRankings = await db
    .select()
    .from(rankings)
    .where(eq(rankings.isCurrent, true))
    .limit(1);

  if (currentRankings.length === 0) {
    console.log("❌ No current rankings found!");
    await closeDb();
    return;
  }

  const ranking = currentRankings[0];
  const rankingData = ranking.data as any;

  console.log(`✓ Found ranking for period: ${ranking.period}`);
  console.log(`Algorithm Version: ${ranking.algorithmVersion}`);
  console.log(`Created: ${ranking.createdAt}`);

  // Find GitHub Copilot in the rankings
  const rankingsArray = Array.isArray(rankingData) ? rankingData : rankingData?.rankings || [];
  const copilotRanking = rankingsArray.find((r: any) =>
    r.tool_slug === 'github-copilot' || r.slug === 'github-copilot'
  );

  if (!copilotRanking) {
    console.log("❌ GitHub Copilot not found in current rankings!");
    await closeDb();
    return;
  }

  console.log("\n📋 GitHub Copilot Ranking Data:");
  console.log(`Rank: ${copilotRanking.rank || copilotRanking.position || 'N/A'}`);
  console.log(`Overall Score: ${copilotRanking.overall_score || copilotRanking.score || 'N/A'}`);

  console.log("\n📊 Factor Scores:");
  const factorScores = copilotRanking.factor_scores || copilotRanking.factorScores || {};

  const factors = [
    'agenticCapability',
    'innovation',
    'technicalPerformance',
    'developerAdoption',
    'marketTraction',
    'businessSentiment',
    'developmentVelocity',
    'platformResilience',
  ];

  factors.forEach(factor => {
    const score = factorScores[factor];
    if (score !== undefined) {
      console.log(`  ${factor}: ${score.toFixed(1)}`);
    }
  });

  console.log("\n🎯 Innovation Score Details:");
  console.log(`Innovation Factor Score: ${factorScores.innovation?.toFixed(1) || 'N/A'}`);
  console.log(`Weight in Algorithm: 10%`);
  console.log(`Contribution to Overall: ${((factorScores.innovation || 0) * 0.10).toFixed(2)}`);

  // Compare with top 5
  console.log("\n📈 Innovation Scores - Top 10:");
  const toolsWithInnovation = rankingsArray
    .map((r: any) => ({
      name: r.tool_name || r.name,
      slug: r.tool_slug || r.slug,
      rank: r.rank || r.position,
      innovation: (r.factor_scores || r.factorScores || {}).innovation || 0,
      overall: r.overall_score || r.score || 0,
    }))
    .sort((a: any, b: any) => a.rank - b.rank)
    .slice(0, 10);

  console.log("\nRank | Tool                | Innovation | Overall");
  console.log("-".repeat(60));
  toolsWithInnovation.forEach((t: any) => {
    console.log(
      `${t.rank.toString().padStart(4)} | ` +
      `${t.name.padEnd(19)} | ` +
      `${t.innovation.toFixed(1).padStart(10)} | ` +
      `${t.overall.toFixed(2).padStart(7)}`
    );
  });

  // Stats
  console.log("\n📊 Innovation Score Statistics:");
  const allInnovationScores = rankingsArray.map((r: any) =>
    (r.factor_scores || r.factorScores || {}).innovation || 0
  );

  const sorted = [...allInnovationScores].sort((a, b) => b - a);
  const avg = allInnovationScores.reduce((sum: number, s: number) => sum + s, 0) / allInnovationScores.length;
  const median = sorted[Math.floor(sorted.length / 2)];

  console.log(`Average: ${avg.toFixed(1)}`);
  console.log(`Median: ${median.toFixed(1)}`);
  console.log(`Max: ${sorted[0].toFixed(1)}`);
  console.log(`Min: ${sorted[sorted.length - 1].toFixed(1)}`);

  console.log("\n✅ Check Complete\n");
  await closeDb();
}

checkCurrentScore().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
