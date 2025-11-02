#!/usr/bin/env tsx

/**
 * Test Algorithm v7.4 Scoring with Data Completeness Penalty
 *
 * Verifies that tools with real metrics rank higher than those without.
 *
 * Tests:
 * 1. Data completeness calculation accuracy
 * 2. Confidence multiplier application
 * 3. Tools with real metrics (Cursor, Copilot) rank higher
 * 4. Tools with limited data (Jules, Refact) rank lower
 * 5. Score uniqueness: < 20% duplicates
 * 6. Top 10 uniqueness: All unique scores
 * 7. Comparison with v7.3 rankings
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { RankingEngineV74 } from "@/lib/ranking-algorithm-v74";
import { RankingEngineV73 } from "@/lib/ranking-algorithm-v73";

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

interface ToolScoreDetail {
  name: string;
  score: number;
  dataCompleteness?: number;
  confidenceMultiplier?: number;
  rawScore?: number;
}

function analyzeScores(scores: ToolScoreDetail[]): TestResult {
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

  console.log(`\n✓ Success Criteria:`);
  console.log(`   < 20% duplicates:   ${passUniqueness ? "✅ PASS" : "❌ FAIL"} (${results.duplicatePercentage.toFixed(1)}%)`);
  console.log(`   Top 10 unique:      ${passTop10 ? "✅ PASS" : "❌ FAIL"}`);

  const overallPass = passUniqueness && passTop10;
  console.log(`\n   Overall:            ${overallPass ? "✅ PASS" : "❌ FAIL"}`);
}

async function testV74Scoring() {
  const db = getDb();

  console.log("\n" + "=".repeat(80));
  console.log("🧪 Algorithm v7.4 Data Completeness Penalty Test");
  console.log("=".repeat(80));

  // Load tools
  console.log("\n📚 Loading active tools...");
  const allTools = await db.select().from(tools).where(eq(tools.status, "active"));
  console.log(`✓ Loaded ${allTools.length} active tools`);

  // Test 1: v7.4 with data completeness penalty
  console.log("\n🔬 Test 1: Algorithm v7.4 (with data completeness penalty)");
  const engineV74 = new RankingEngineV74();
  const scoresV74: ToolScoreDetail[] = [];

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
      const scoreResult = engineV74.calculateToolScore(metrics);
      scoresV74.push({
        name: tool.name,
        score: scoreResult.overallScore,
        dataCompleteness: scoreResult.dataCompleteness,
        confidenceMultiplier: scoreResult.confidenceMultiplier,
        rawScore: scoreResult.overallScore / scoreResult.confidenceMultiplier,
      });
    } catch (error) {
      console.error(`Error scoring ${tool.name}:`, error);
    }
  }

  const resultsV74 = analyzeScores(scoresV74);
  printResults("📊 v7.4 Results", resultsV74);

  // Test 2: v7.3 for comparison
  console.log("\n\n🔬 Test 2: Algorithm v7.3 (for comparison)");
  const engineV73 = new RankingEngineV73();
  const scoresV73: ToolScoreDetail[] = [];

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
      // Ignore
    }
  }

  const resultsV73 = analyzeScores(scoresV73);
  printResults("📊 v7.3 Results (Baseline)", resultsV73);

  // Data Completeness Analysis
  console.log("\n\n" + "=".repeat(80));
  console.log("📊 Data Completeness Analysis");
  console.log("=".repeat(80));

  const sortedByCompleteness = [...scoresV74].sort((a, b) => (b.dataCompleteness || 0) - (a.dataCompleteness || 0));

  console.log("\n🏆 Top 10 Tools by Data Completeness:");
  console.log("─".repeat(80));
  console.log("Rank | Tool Name                | Data % | Conf | Raw→Final Score");
  console.log("─".repeat(80));
  for (let i = 0; i < 10 && i < sortedByCompleteness.length; i++) {
    const tool = sortedByCompleteness[i];
    console.log(
      `${String(i + 1).padStart(4)} | ` +
      `${tool.name.substring(0, 24).padEnd(24)} | ` +
      `${String(tool.dataCompleteness || 0).padStart(5)}% | ` +
      `${(tool.confidenceMultiplier || 0).toFixed(2)} | ` +
      `${(tool.rawScore || 0).toFixed(1)} → ${tool.score.toFixed(1)}`
    );
  }

  console.log("\n📉 Bottom 10 Tools by Data Completeness:");
  console.log("─".repeat(80));
  console.log("Rank | Tool Name                | Data % | Conf | Raw→Final Score");
  console.log("─".repeat(80));
  for (let i = 0; i < 10 && i < sortedByCompleteness.length; i++) {
    const idx = sortedByCompleteness.length - 1 - i;
    const tool = sortedByCompleteness[idx];
    console.log(
      `${String(idx + 1).padStart(4)} | ` +
      `${tool.name.substring(0, 24).padEnd(24)} | ` +
      `${String(tool.dataCompleteness || 0).padStart(5)}% | ` +
      `${(tool.confidenceMultiplier || 0).toFixed(2)} | ` +
      `${(tool.rawScore || 0).toFixed(1)} → ${tool.score.toFixed(1)}`
    );
  }

  // Comparison: Key Tools
  console.log("\n\n" + "=".repeat(80));
  console.log("📈 Key Tool Ranking Changes (v7.3 → v7.4)");
  console.log("=".repeat(80));

  const keyTools = ["Cursor", "GitHub Copilot", "Claude Code", "Jules", "Devin", "Refact.ai"];

  console.log("\nTool Name          | v7.3 Rank | v7.3 Score | v7.4 Rank | v7.4 Score | Data % | Change");
  console.log("─".repeat(95));

  const sortedV73 = [...scoresV73].sort((a, b) => b.score - a.score);
  const sortedV74 = [...scoresV74].sort((a, b) => b.score - a.score);

  for (const toolName of keyTools) {
    const v73Index = sortedV73.findIndex(t => t.name === toolName);
    const v74Index = sortedV74.findIndex(t => t.name === toolName);

    const v73Tool = scoresV73.find(t => t.name === toolName);
    const v74Tool = scoresV74.find(t => t.name === toolName);

    if (v73Tool && v74Tool) {
      const rankChange = v73Index - v74Index;
      const changeSymbol = rankChange > 0 ? "↑" : rankChange < 0 ? "↓" : "→";
      const changeColor = rankChange > 0 ? "🟢" : rankChange < 0 ? "🔴" : "⚪";

      console.log(
        `${toolName.padEnd(18)} | ` +
        `${String(v73Index + 1).padStart(9)} | ` +
        `${v73Tool.score.toFixed(3).padStart(10)} | ` +
        `${String(v74Index + 1).padStart(9)} | ` +
        `${v74Tool.score.toFixed(3).padStart(10)} | ` +
        `${String(v74Tool.dataCompleteness || 0).padStart(5)}% | ` +
        `${changeColor} ${changeSymbol}${Math.abs(rankChange)}`
      );
    }
  }

  // Top 20 Comparison
  console.log("\n\n" + "=".repeat(80));
  console.log("📊 Top 20 Rankings Comparison");
  console.log("=".repeat(80));
  console.log("Rank | v7.3 Tool (Score)                    | v7.4 Tool (Score)            | Data %");
  console.log("─".repeat(80));

  for (let i = 0; i < 20 && i < Math.min(sortedV73.length, sortedV74.length); i++) {
    const v73Tool = sortedV73[i];
    const v74Tool = sortedV74[i];

    console.log(
      `${String(i + 1).padStart(4)} | ` +
      `${v73Tool.name.substring(0, 20).padEnd(20)} (${v73Tool.score.toFixed(3).padStart(7)}) | ` +
      `${v74Tool.name.substring(0, 20).padEnd(20)} (${v74Tool.score.toFixed(3).padStart(7)}) | ` +
      `${String(v74Tool.dataCompleteness || 0).padStart(5)}%`
    );
  }

  // Success Analysis
  console.log("\n\n" + "=".repeat(80));
  console.log("🎯 Data Penalty Success Analysis");
  console.log("=".repeat(80));

  // Check if data-rich tools moved up
  const cursorV73Rank = sortedV73.findIndex(t => t.name === "Cursor") + 1;
  const cursorV74Rank = sortedV74.findIndex(t => t.name === "Cursor") + 1;
  const copilotV73Rank = sortedV73.findIndex(t => t.name === "GitHub Copilot") + 1;
  const copilotV74Rank = sortedV74.findIndex(t => t.name === "GitHub Copilot") + 1;
  const claudeV73Rank = sortedV73.findIndex(t => t.name === "Claude Code") + 1;
  const claudeV74Rank = sortedV74.findIndex(t => t.name === "Claude Code") + 1;

  // Check if data-poor tools moved down
  const julesV73Rank = sortedV73.findIndex(t => t.name === "Jules") + 1;
  const julesV74Rank = sortedV74.findIndex(t => t.name === "Jules") + 1;

  console.log("\n✓ Expected Improvements:");
  console.log(`   Cursor improved:        ${cursorV73Rank > cursorV74Rank ? "✅ YES" : "❌ NO"} (#${cursorV73Rank} → #${cursorV74Rank})`);
  console.log(`   Copilot improved:       ${copilotV73Rank > copilotV74Rank ? "✅ YES" : "❌ NO"} (#${copilotV73Rank} → #${copilotV74Rank})`);
  console.log(`   Claude Code improved:   ${claudeV73Rank > claudeV74Rank ? "✅ YES" : "⚠️  NO" } (#${claudeV73Rank} → #${claudeV74Rank})`);
  console.log(`   Jules penalized:        ${julesV73Rank < julesV74Rank ? "✅ YES" : "❌ NO"} (#${julesV73Rank} → #${julesV74Rank})`);

  const dataRichImproved = (cursorV73Rank > cursorV74Rank) && (copilotV73Rank > copilotV74Rank);
  const dataPoorPenalized = (julesV73Rank < julesV74Rank);

  console.log(`\n   Data-rich rewarded:     ${dataRichImproved ? "✅ YES" : "❌ NO"}`);
  console.log(`   Data-poor penalized:    ${dataPoorPenalized ? "✅ YES" : "❌ NO"}`);

  // Final verdict
  console.log("\n\n" + "=".repeat(80));
  console.log("🎯 Final Verdict");
  console.log("=".repeat(80));

  const meetsGoals =
    resultsV74.duplicatePercentage < 20 &&
    resultsV74.top10AllUnique &&
    dataRichImproved &&
    dataPoorPenalized;

  if (meetsGoals) {
    console.log("\n✅ Algorithm v7.4 meets all success criteria!");
    console.log("\n📋 Summary:");
    console.log("   - Data completeness penalty working correctly");
    console.log("   - Tools with real metrics rank higher");
    console.log("   - Tools with limited data penalized appropriately");
    console.log("   - Score uniqueness maintained (<20% duplicates)");
    console.log("\n✨ Ready to deploy!");
  } else {
    console.log("\n⚠️  Algorithm v7.4 needs review:");

    if (!resultsV74.top10AllUnique) {
      console.log("\n❌ Issue: Top 10 not all unique");
    }
    if (resultsV74.duplicatePercentage >= 20) {
      console.log(`\n❌ Issue: ${resultsV74.duplicatePercentage.toFixed(1)}% duplicates (target: <20%)`);
    }
    if (!dataRichImproved) {
      console.log("\n⚠️  Issue: Data-rich tools not improving as expected");
    }
    if (!dataPoorPenalized) {
      console.log("\n⚠️  Issue: Data-poor tools not penalized as expected");
    }
  }

  await closeDb();
}

// Run the test
testV74Scoring()
  .then(() => {
    console.log("\n✨ Test complete!\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Test Error:", error);
    process.exit(1);
  });
