#!/usr/bin/env tsx

import { getDb, closeDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";
import { RankingEngineV74 } from "@/lib/ranking-algorithm-v74";

async function detailedAnalysis() {
  const db = getDb();

  const toolNames = ["jules", "github-copilot", "cursor", "claude-code"];
  const result = await db.select().from(tools).where(inArray(tools.slug, toolNames));

  console.log("\n" + "=".repeat(120));
  console.log("DETAILED FACTOR SCORE ANALYSIS");
  console.log("=".repeat(120));

  const engine = new RankingEngineV74();

  for (const tool of result) {
    const toolData = tool.data as any;
    const metrics = {
      tool_id: tool.id,
      name: tool.name,
      slug: tool.slug,
      category: tool.category,
      status: tool.status,
      info: toolData,
      metrics: toolData.metrics || {},
    };

    const scoreResult = engine.calculateToolScore(metrics);

    console.log(`\n${"=".repeat(120)}`);
    console.log(`${tool.name.toUpperCase()} - Overall Score: ${scoreResult.overallScore.toFixed(3)}`);
    console.log(`${"=".repeat(120)}`);
    console.log(`Category: ${tool.category || "N/A"}`);
    console.log(`Data Completeness: ${scoreResult.dataCompleteness}%`);
    console.log(`Confidence Multiplier: ${scoreResult.confidenceMultiplier.toFixed(2)}`);
    console.log(`\nFactor Scores (0-100):`);
    console.log("-".repeat(120));

    const factorScores = scoreResult.factorScores;
    const weights = {
      agenticCapability: 0.08,
      innovation: 0.08,
      technicalPerformance: 0.10,
      developerAdoption: 0.22,
      marketTraction: 0.18,
      businessSentiment: 0.12,
      developmentVelocity: 0.12,
      platformResilience: 0.10,
    };

    // Calculate weighted contribution
    Object.entries(weights).forEach(([factor, weight]) => {
      const score = factorScores[factor as keyof typeof factorScores] || 0;
      const contribution = score * weight;
      const percentage = (weight * 100).toFixed(0);

      console.log(
        `  ${factor.padEnd(25)} | ` +
        `Score: ${String(score.toFixed(1)).padStart(5)} | ` +
        `Weight: ${percentage.padStart(2)}% | ` +
        `Contribution: ${contribution.toFixed(2).padStart(5)} (${((contribution / scoreResult.overallScore) * 100).toFixed(1)}% of final)`
      );
    });

    console.log("-".repeat(120));
    console.log(`Raw Score (before confidence): ${(scoreResult.overallScore / scoreResult.confidenceMultiplier).toFixed(3)}`);
    console.log(`Final Score (after confidence): ${scoreResult.overallScore.toFixed(3)}`);
  }

  console.log("\n" + "=".repeat(120));
  console.log("ANALYSIS SUMMARY");
  console.log("=".repeat(120));

  const jules = result.find(t => t.slug === "jules");
  if (jules) {
    const julesData = jules.data as any;
    const julesMetrics = {
      tool_id: jules.id,
      name: jules.name,
      slug: jules.slug,
      category: jules.category,
      status: jules.status,
      info: julesData,
      metrics: julesData.metrics || {},
    };

    const julesScore = engine.calculateToolScore(julesMetrics);

    console.log("\nWhy Jules still ranks high:");
    console.log("-".repeat(120));
    console.log(`  1. Agentic Capability: ${julesScore.factorScores.agenticCapability.toFixed(1)} (8% weight)`);
    console.log(`     - Has SWE-bench verified: ${julesData.info?.metrics?.swe_bench?.verified || "N/A"}`);
    console.log(`     - Multi-file support: ${julesData.info?.technical?.multi_file_support || false}`);
    console.log(`  2. Innovation: ${julesScore.factorScores.innovation.toFixed(1)} (8% weight)`);
    console.log(`     - Large context window: ${julesData.info?.technical?.context_window?.toLocaleString() || "N/A"} tokens`);
    console.log(`  3. Developer Adoption: ${julesScore.factorScores.developerAdoption.toFixed(1)} (22% weight) ← Should be LOW`);
    console.log(`     - VS Code installs: ${julesData.metrics?.vscode?.installs || 0}`);
    console.log(`     - npm downloads: ${julesData.metrics?.npm?.downloads_last_month || 0}`);
    console.log(`  4. Market Traction: ${julesScore.factorScores.marketTraction.toFixed(1)} (18% weight) ← Should be LOW`);
    console.log(`     - Revenue: ${julesData.info?.metrics?.monthly_arr || 0}`);
    console.log(`     - Pricing: ${julesData.info?.business?.pricing_model || "N/A"}`);
  }

  await closeDb();
}

detailedAnalysis();
