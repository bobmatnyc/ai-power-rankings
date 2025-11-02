#!/usr/bin/env tsx

import { closeDb, getDb } from "@/lib/db/connection";
import { rankings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const ALGORITHM_V73_WEIGHTS = {
  agenticCapability: 0.35,
  innovation: 0.10,
  technicalPerformance: 0.10,
  developerAdoption: 0.125,
  marketTraction: 0.125,
  businessSentiment: 0.125,
  developmentVelocity: 0.05,
  platformResilience: 0.025,
};

async function main() {
  const db = getDb();

  const currentRankings = await db
    .select()
    .from(rankings)
    .where(eq(rankings.isCurrent, true));

  if (currentRankings.length === 0) {
    console.log("No current rankings found!");
    return;
  }

  const data = currentRankings[0].data as any;
  const rankingsData = Array.isArray(data) ? data : data?.rankings || [];

  const targetTools = ['google-jules', 'cursor', 'github-copilot', 'windsurf', 'devin', 'refact-ai'];
  const toolData = targetTools
    .map(slug => rankingsData.find((r: any) => r.tool_slug === slug))
    .filter(Boolean);

  console.log("=".repeat(100));
  console.log("🔍 GOOGLE JULES RANKING ANALYSIS - Algorithm v7.3");
  console.log("=".repeat(100));

  // Print individual tool analysis
  toolData.forEach(tool => {
    console.log(`\n${"─".repeat(100)}`);
    console.log(`📊 ${tool.tool_name} (Rank #${tool.rank})`);
    console.log(`${"─".repeat(100)}`);
    console.log(`Overall Score: ${tool.score.toFixed(3)}\n`);

    console.log("Factor Scores (raw):");
    const factors = tool.factor_scores;
    Object.entries(ALGORITHM_V73_WEIGHTS).forEach(([key, weight]) => {
      const rawScore = factors[key] || 0;
      const weighted = rawScore * weight;
      console.log(`  ${key.padEnd(25)} ${rawScore.toFixed(2).padStart(7)} × ${weight.toFixed(3)} = ${weighted.toFixed(3).padStart(7)}`);
    });

    console.log(`\nTiebreakers:`);
    Object.entries(tool.tiebreakers).forEach(([key, value]) => {
      console.log(`  ${key.padEnd(25)} ${value}`);
    });
  });

  // Comparison matrix
  console.log(`\n\n${"=".repeat(100)}`);
  console.log("📊 FACTOR COMPARISON MATRIX");
  console.log("=".repeat(100));

  const jules = toolData.find(t => t.tool_slug === 'google-jules');
  const cursor = toolData.find(t => t.tool_slug === 'cursor');
  const copilot = toolData.find(t => t.tool_slug === 'github-copilot');
  const windsurf = toolData.find(t => t.tool_slug === 'windsurf');

  console.log("\nRaw Factor Scores:\n");
  console.log("Factor                    | Jules  | Cursor | Copilot | Windsurf | Jules vs Cursor");
  console.log("-".repeat(100));

  Object.keys(ALGORITHM_V73_WEIGHTS).forEach(factor => {
    const julesScore = jules?.factor_scores[factor] || 0;
    const cursorScore = cursor?.factor_scores[factor] || 0;
    const copilotScore = copilot?.factor_scores[factor] || 0;
    const windsurfScore = windsurf?.factor_scores[factor] || 0;
    const diff = julesScore - cursorScore;
    const symbol = diff > 0 ? '+' : '';

    console.log(
      `${factor.padEnd(25)} | ${julesScore.toFixed(1).padStart(6)} | ${cursorScore.toFixed(1).padStart(6)} | ${copilotScore.toFixed(1).padStart(7)} | ${windsurfScore.toFixed(1).padStart(8)} | ${symbol}${diff.toFixed(1)}`
    );
  });

  console.log("\n\nWeighted Contribution to Overall Score:\n");
  console.log("Factor                    | Jules  | Cursor | Copilot | Windsurf | Jules vs Cursor");
  console.log("-".repeat(100));

  let julesTotal = 0;
  let cursorTotal = 0;

  Object.entries(ALGORITHM_V73_WEIGHTS).forEach(([factor, weight]) => {
    const julesScore = (jules?.factor_scores[factor] || 0) * weight;
    const cursorScore = (cursor?.factor_scores[factor] || 0) * weight;
    const copilotScore = (copilot?.factor_scores[factor] || 0) * weight;
    const windsurfScore = (windsurf?.factor_scores[factor] || 0) * weight;
    const diff = julesScore - cursorScore;
    const symbol = diff > 0 ? '+' : '';

    julesTotal += julesScore;
    cursorTotal += cursorScore;

    console.log(
      `${factor.padEnd(25)} | ${julesScore.toFixed(3).padStart(6)} | ${cursorScore.toFixed(3).padStart(6)} | ${copilotScore.toFixed(3).padStart(7)} | ${windsurfScore.toFixed(3).padStart(8)} | ${symbol}${diff.toFixed(3)}`
    );
  });

  console.log("-".repeat(100));
  console.log(`${"TOTAL (calculated)".padEnd(25)} | ${julesTotal.toFixed(3).padStart(6)} | ${cursorTotal.toFixed(3).padStart(6)}`);
  console.log(`${"TOTAL (from DB)".padEnd(25)} | ${(jules?.score || 0).toFixed(3).padStart(6)} | ${(cursor?.score || 0).toFixed(3).padStart(6)}`);

  // Root cause analysis
  console.log(`\n\n${"=".repeat(100)}`);
  console.log("🎯 ROOT CAUSE ANALYSIS");
  console.log("=".repeat(100));

  console.log("\n❌ PROBLEM: Google Jules ranks #1 with 65.056, ahead of proven tools like Cursor\n");

  console.log("🔍 KEY FINDINGS:\n");

  // Find the biggest discrepancies
  const factorDiffs: Array<{ factor: string; diff: number; weighted: number }> = [];
  Object.entries(ALGORITHM_V73_WEIGHTS).forEach(([factor, weight]) => {
    const julesScore = jules?.factor_scores[factor] || 0;
    const cursorScore = cursor?.factor_scores[factor] || 0;
    const diff = julesScore - cursorScore;
    const weighted = diff * weight;
    factorDiffs.push({ factor, diff, weighted });
  });

  factorDiffs.sort((a, b) => Math.abs(b.weighted) - Math.abs(a.weighted));

  console.log("Top factors causing Jules to rank higher than Cursor:\n");
  factorDiffs.slice(0, 5).forEach((item, idx) => {
    if (item.weighted > 0) {
      console.log(`${idx + 1}. ${item.factor}`);
      console.log(`   Raw score advantage: +${item.diff.toFixed(1)} points`);
      console.log(`   Weighted impact: +${item.weighted.toFixed(3)} points`);
      console.log(`   Weight in algorithm: ${(ALGORITHM_V73_WEIGHTS[item.factor as keyof typeof ALGORITHM_V73_WEIGHTS] * 100).toFixed(1)}%\n`);
    }
  });

  console.log("\n🚨 ANOMALIES DETECTED:\n");

  // Check innovation score
  if (jules && jules.factor_scores.innovation > 100) {
    console.log(`1. ❌ Innovation Score = ${jules.factor_scores.innovation} (EXCEEDS MAXIMUM OF 100)`);
    console.log(`   This should be capped at 100. Score is out of valid range.`);
    console.log(`   Impact: +${((jules.factor_scores.innovation - 100) * 0.10).toFixed(3)} inflated points\n`);
  }

  // Check development velocity
  if (jules && jules.factor_scores.developmentVelocity === 100) {
    console.log(`2. ⚠️  Development Velocity = 100 (MAXIMUM)`);
    console.log(`   Cursor: ${cursor?.factor_scores.developmentVelocity || 0}`);
    console.log(`   This suggests Jules data is incomplete or inflated.`);
    console.log(`   Impact: +${((100 - (cursor?.factor_scores.developmentVelocity || 0)) * 0.05).toFixed(3)} points over Cursor\n`);
  }

  // Check tiebreaker differences
  console.log(`3. 📊 Tiebreaker Analysis:`);
  console.log(`   Jules feature count: ${jules?.tiebreakers.featureCount || 0}`);
  console.log(`   Cursor feature count: ${cursor?.tiebreakers.featureCount || 0}`);
  console.log(`   Jules has ${(jules?.tiebreakers.featureCount || 0) - (cursor?.tiebreakers.featureCount || 0)} more features counted\n`);

  console.log("\n💡 RECOMMENDATIONS:\n");
  console.log("1. Cap innovation score at 100 (currently allowing 110+)");
  console.log("2. Review development velocity calculation for Jules");
  console.log("3. Verify feature count accuracy for Jules vs Cursor");
  console.log("4. Consider reducing innovation weight from 10% to 5-8%");
  console.log("5. Add data quality checks to prevent score inflation");
  console.log("\n");

  await closeDb();
}

main().catch(console.error);
