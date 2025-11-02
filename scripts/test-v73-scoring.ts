#!/usr/bin/env tsx

/**
 * Test Algorithm v7.3 Scoring
 *
 * Verifies that the new algorithm significantly reduces duplicate scores
 * without actually inserting into database.
 *
 * Tests:
 * 1. Score uniqueness: < 20% of tools should have duplicate scores
 * 2. Top 10 uniqueness: All top 10 should have unique scores
 * 3. Top 20 uniqueness: All top 20 should have unique scores
 * 4. Score distribution: Should have good spread (not clustered)
 * 5. Determinism: Running twice should produce identical results
 * 6. Tiebreaker effectiveness: Compare with and without tiebreakers
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { RankingEngineV73 } from "@/lib/ranking-algorithm-v73";
import { RankingEngineV7 } from "@/lib/ranking-algorithm-v7"; // For comparison

interface TestResult {
  totalTools: number;
  uniqueScores: number;
  duplicateGroups: number;
  duplicateTools: number;
  duplicatePercentage: number;
  largestDuplicateGroup: number;
  top10AllUnique: boolean;
  top20AllUnique: boolean;
  scoreRange: { min: number; max: number };
  scoreStdDev: number;
}

function analyzeScores(scores: { name: string; score: number }[]): TestResult {
  const scoreMap = new Map<number, string[]>();

  // Group by score
  scores.forEach((item) => {
    const existing = scoreMap.get(item.score) || [];
    existing.push(item.name);
    scoreMap.set(item.score, existing);
  });

  // Find duplicates
  const duplicateGroups = Array.from(scoreMap.entries()).filter(([_, tools]) => tools.length > 1);
  const duplicateTools = duplicateGroups.reduce((sum, [_, tools]) => sum + tools.length, 0);
  const largestDuplicateGroup = Math.max(
    ...duplicateGroups.map(([_, tools]) => tools.length),
    0
  );

  // Check top uniqueness
  const sortedScores = [...scores].sort((a, b) => b.score - a.score);
  const top10Scores = new Set(sortedScores.slice(0, 10).map((s) => s.score));
  const top20Scores = new Set(sortedScores.slice(0, 20).map((s) => s.score));

  // Calculate score statistics
  const scoreValues = scores.map((s) => s.score);
  const minScore = Math.min(...scoreValues);
  const maxScore = Math.max(...scoreValues);
  const avgScore = scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length;
  const variance =
    scoreValues.reduce((sum, score) => sum + Math.pow(score - avgScore, 2), 0) / scoreValues.length;
  const stdDev = Math.sqrt(variance);

  return {
    totalTools: scores.length,
    uniqueScores: scoreMap.size,
    duplicateGroups: duplicateGroups.length,
    duplicateTools,
    duplicatePercentage: (duplicateTools / scores.length) * 100,
    largestDuplicateGroup,
    top10AllUnique: top10Scores.size === 10,
    top20AllUnique: top20Scores.size === Math.min(20, scores.length),
    scoreRange: { min: minScore, max: maxScore },
    scoreStdDev: stdDev,
  };
}

function printResults(label: string, results: TestResult) {
  console.log(`\n${label}:`);
  console.log("─".repeat(70));
  console.log(`Total Tools:           ${results.totalTools}`);
  console.log(`Unique Scores:         ${results.uniqueScores} (${((results.uniqueScores / results.totalTools) * 100).toFixed(1)}%)`);
  console.log(`Duplicate Groups:      ${results.duplicateGroups}`);
  console.log(`Duplicate Tools:       ${results.duplicateTools} (${results.duplicatePercentage.toFixed(1)}%)`);
  console.log(`Largest Dup Group:     ${results.largestDuplicateGroup} tools`);
  console.log(`Top 10 All Unique:     ${results.top10AllUnique ? "✅ YES" : "❌ NO"}`);
  console.log(`Top 20 All Unique:     ${results.top20AllUnique ? "✅ YES" : "❌ NO"}`);
  console.log(`Score Range:           ${results.scoreRange.min.toFixed(3)} - ${results.scoreRange.max.toFixed(3)}`);
  console.log(`Score Std Deviation:   ${results.scoreStdDev.toFixed(3)}`);

  // Success criteria
  const passUniqueness = results.duplicatePercentage < 20;
  const passTop10 = results.top10AllUnique;
  const passTop20 = results.top20AllUnique;

  console.log(`\n✓ Success Criteria:`);
  console.log(`   < 20% duplicates:   ${passUniqueness ? "✅ PASS" : "❌ FAIL"} (${results.duplicatePercentage.toFixed(1)}%)`);
  console.log(`   Top 10 unique:      ${passTop10 ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`   Top 20 unique:      ${passTop20 ? "✅ PASS" : "⚠️  WARN"}`);

  const overallPass = passUniqueness && passTop10;
  console.log(`\n   Overall:            ${overallPass ? "✅ PASS" : "❌ FAIL"}`);
}

async function testV73Scoring() {
  const db = getDb();

  console.log("\n" + "=".repeat(80));
  console.log("🧪 Algorithm v7.3 Scoring Test");
  console.log("=".repeat(80));

  // Load tools
  console.log("\n📚 Loading active tools...");
  const allTools = await db.select().from(tools).where(eq(tools.status, "active"));
  console.log(`✓ Loaded ${allTools.length} active tools`);

  // Test 1: v7.3 with tiebreakers
  console.log("\n🔬 Test 1: Algorithm v7.3 (with tiebreakers)");
  const engineV73 = new RankingEngineV73();
  const scoresV73: { name: string; score: number }[] = [];

  for (const tool of allTools) {
    const toolData = tool.data as any;
    const metrics = {
      tool_id: tool.id,
      name: tool.name,
      slug: tool.slug,
      category: tool.category,
      status: tool.status,
      info: toolData,
    };

    try {
      const score = engineV73.calculateToolScore(metrics);
      scoresV73.push({ name: tool.name, score: score.overallScore });
    } catch (error) {
      console.error(`Error scoring ${tool.name}:`, error);
    }
  }

  const resultsV73 = analyzeScores(scoresV73);
  printResults("📊 v7.3 Results", resultsV73);

  // Test 2: v7.2 for comparison
  console.log("\n\n🔬 Test 2: Algorithm v7.2 (for comparison)");
  const engineV72 = new RankingEngineV7();
  const scoresV72: { name: string; score: number }[] = [];

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
      const score = engineV72.calculateToolScore(metrics);
      scoresV72.push({ name: tool.name, score: score.overallScore });
    } catch (error) {
      // Ignore
    }
  }

  const resultsV72 = analyzeScores(scoresV72);
  printResults("📊 v7.2 Results (Baseline)", resultsV72);

  // Test 3: Determinism test (run v7.3 again)
  console.log("\n\n🔬 Test 3: Determinism Check (v7.3 second run)");
  const scoresV73Second: { name: string; score: number }[] = [];

  for (const tool of allTools) {
    const toolData = tool.data as any;
    const metrics = {
      tool_id: tool.id,
      name: tool.name,
      slug: tool.slug,
      category: tool.category,
      status: tool.status,
      info: toolData,
    };

    try {
      const score = engineV73.calculateToolScore(metrics);
      scoresV73Second.push({ name: tool.name, score: score.overallScore });
    } catch (error) {
      // Ignore
    }
  }

  // Compare two runs
  let identicalCount = 0;
  for (let i = 0; i < scoresV73.length; i++) {
    if (scoresV73[i].name === scoresV73Second[i].name &&
        scoresV73[i].score === scoresV73Second[i].score) {
      identicalCount++;
    }
  }

  const isDeterministic = identicalCount === scoresV73.length;
  console.log(`\n📊 Determinism Results:`);
  console.log(`   Identical scores:   ${identicalCount} / ${scoresV73.length}`);
  console.log(`   Deterministic:      ${isDeterministic ? "✅ YES" : "❌ NO"}`);

  // Comparison Summary
  console.log("\n\n" + "=".repeat(80));
  console.log("📈 Comparison: v7.2 vs v7.3");
  console.log("=".repeat(80));

  const improvement = resultsV72.duplicatePercentage - resultsV73.duplicatePercentage;

  console.log(`\nDuplicate Percentage:`);
  console.log(`   v7.2:              ${resultsV72.duplicatePercentage.toFixed(1)}%`);
  console.log(`   v7.3:              ${resultsV73.duplicatePercentage.toFixed(1)}%`);
  console.log(`   Improvement:       ${improvement > 0 ? "↓" : "↑"} ${Math.abs(improvement).toFixed(1)} pp`);

  console.log(`\nTop 10 Uniqueness:`);
  console.log(`   v7.2:              ${resultsV72.top10AllUnique ? "✅" : "❌"}`);
  console.log(`   v7.3:              ${resultsV73.top10AllUnique ? "✅" : "❌"}`);

  console.log(`\nTop 20 Uniqueness:`);
  console.log(`   v7.2:              ${resultsV72.top20AllUnique ? "✅" : "❌"}`);
  console.log(`   v7.3:              ${resultsV73.top20AllUnique ? "✅" : "❌"}`);

  console.log(`\nScore Distribution:`);
  console.log(`   v7.2 Std Dev:      ${resultsV72.scoreStdDev.toFixed(3)}`);
  console.log(`   v7.3 Std Dev:      ${resultsV73.scoreStdDev.toFixed(3)}`);

  // Show top 10 comparison
  console.log("\n\n📊 Top 10 Rankings Comparison:");
  console.log("=".repeat(80));
  console.log("Rank | v7.2 Tool (Score)                    | v7.3 Tool (Score)");
  console.log("-".repeat(80));

  const sortedV72 = [...scoresV72].sort((a, b) => b.score - a.score);
  const sortedV73 = [...scoresV73].sort((a, b) => b.score - a.score);

  for (let i = 0; i < 10 && i < Math.min(sortedV72.length, sortedV73.length); i++) {
    const v72Tool = sortedV72[i];
    const v73Tool = sortedV73[i];

    console.log(
      `${String(i + 1).padStart(4)} | ` +
      `${v72Tool.name.substring(0, 20).padEnd(20)} (${v72Tool.score.toFixed(3).padStart(7)}) | ` +
      `${v73Tool.name.substring(0, 20).padEnd(20)} (${v73Tool.score.toFixed(3).padStart(7)})`
    );
  }

  // Final verdict
  console.log("\n\n" + "=".repeat(80));
  console.log("🎯 Final Verdict");
  console.log("=".repeat(80));

  const meetsGoals =
    resultsV73.duplicatePercentage < 20 &&
    resultsV73.top10AllUnique &&
    isDeterministic;

  if (meetsGoals) {
    console.log("\n✅ Algorithm v7.3 meets all success criteria!");
    console.log("\nReady to run: npx tsx scripts/generate-v73-rankings.ts");
  } else {
    console.log("\n⚠️  Algorithm v7.3 does not meet all success criteria.");
    console.log("\nReview needed before running generation script.");

    if (!resultsV73.top10AllUnique) {
      console.log("\n❌ Issue: Top 10 not all unique");
    }
    if (resultsV73.duplicatePercentage >= 20) {
      console.log(`\n❌ Issue: ${resultsV73.duplicatePercentage.toFixed(1)}% duplicates (target: <20%)`);
    }
    if (!isDeterministic) {
      console.log("\n❌ Issue: Algorithm is not deterministic");
    }
  }

  await closeDb();
}

// Run the test
testV73Scoring()
  .then(() => {
    console.log("\n✨ Test complete!\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Test Error:", error);
    process.exit(1);
  });
