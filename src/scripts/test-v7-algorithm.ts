#!/usr/bin/env tsx

import { readFileSync } from "fs";
import { RankingEngineV7 } from "../lib/ranking-algorithm-v7";

// Read tools data
const toolsData = JSON.parse(readFileSync("data/json/tools/tools.json", "utf-8"));
const newsData = JSON.parse(readFileSync("data/json/news/news.json", "utf-8"));

// Initialize ranking engine
const engine = new RankingEngineV7();

// Test a few key tools
const testTools = [
  "cursor",
  "claude-code",
  "github-copilot",
  "kiro",
  "aider",
  "amazon-q-developer",
  "cline",
  "bolt-new",
  "v0-dev",
];

console.log("Testing Algorithm v7.0 - Smart Defaults & Proxy Metrics");
console.log("=".repeat(80));
console.log();

// Get algorithm info
const algorithmInfo = RankingEngineV7.getAlgorithmInfo();
console.log("Algorithm Version:", algorithmInfo.version);
console.log("Algorithm Name:", algorithmInfo.name);
console.log();

// Calculate scores for test tools
const results = [];
for (const toolSlug of testTools) {
  const tool = toolsData.tools.find((t: any) => t.slug === toolSlug);
  if (!tool) {
    console.log(`Tool ${toolSlug} not found`);
    continue;
  }

  // Transform to metrics format
  const metrics = {
    tool_id: tool.id,
    name: tool.name,
    category: tool.category,
    status: tool.status,
    info: tool.info,
  };

  // Calculate score
  const score = engine.calculateToolScore(metrics, new Date(), newsData.articles);
  results.push({
    name: tool.name,
    category: tool.category,
    score: score.overallScore,
    factors: score.factorScores,
    metrics: {
      swe_bench:
        tool.info?.metrics?.swe_bench?.verified || tool.info?.metrics?.swe_bench?.lite || 0,
      news_mentions: tool.info?.metrics?.news_mentions || 0,
      users: tool.info?.metrics?.users || 0,
      arr: tool.info?.metrics?.monthly_arr || 0,
      context_window: tool.info?.technical?.context_window || 0,
      pricing: tool.info?.business?.pricing_model || "unknown",
      base_price: tool.info?.business?.base_price || 0,
    },
  });
}

// Sort by score
results.sort((a, b) => b.score - a.score);

// Display results
console.log("Overall Rankings:");
console.log("-".repeat(80));
console.log("Rank | Tool Name           | Score | Category            | Key Metrics");
console.log("-".repeat(80));

results.forEach((result, index) => {
  console.log(
    `${(index + 1).toString().padStart(4)} | ${result.name.padEnd(19)} | ${result.score.toFixed(1).padStart(5)} | ${result.category.padEnd(19)} | SWE:${result.metrics.swe_bench.toString().padStart(4)}, News:${result.metrics.news_mentions.toString().padStart(2)}`
  );
});

console.log();
console.log("Detailed Factor Scores (0-100 scale):");
console.log("-".repeat(120));
console.log(
  "Tool                 | Agentic | Innov | Tech  | Adopt | Market | Sent  | Veloc | Resil |"
);
console.log("-".repeat(120));

results.forEach((result) => {
  const formatScore = (score: number) => (isNaN(score) ? "N/A" : score.toFixed(0));
  console.log(
    `${result.name.padEnd(20)} | ${formatScore(result.factors.agenticCapability).padStart(7)} | ${formatScore(result.factors.innovation).padStart(5)} | ${formatScore(result.factors.technicalPerformance).padStart(5)} | ${formatScore(result.factors.developerAdoption).padStart(5)} | ${formatScore(result.factors.marketTraction).padStart(6)} | ${formatScore(result.factors.businessSentiment).padStart(5)} | ${formatScore(result.factors.developmentVelocity).padStart(5)} | ${formatScore(result.factors.platformResilience).padStart(5)} |`
  );
});

console.log();
console.log("Score Distribution:");
console.log("-".repeat(40));
const scoreRanges = {
  "90-100": results.filter((r) => r.score >= 90).length,
  "80-89": results.filter((r) => r.score >= 80 && r.score < 90).length,
  "70-79": results.filter((r) => r.score >= 70 && r.score < 80).length,
  "60-69": results.filter((r) => r.score >= 60 && r.score < 70).length,
  "50-59": results.filter((r) => r.score >= 50 && r.score < 60).length,
  "40-49": results.filter((r) => r.score >= 40 && r.score < 50).length,
  "30-39": results.filter((r) => r.score >= 30 && r.score < 40).length,
  "0-29": results.filter((r) => r.score < 30).length,
};

Object.entries(scoreRanges).forEach(([range, count]) => {
  console.log(`${range}: ${count} tools`);
});

console.log();
console.log("Min Score:", Math.min(...results.map((r) => r.score)).toFixed(1));
console.log("Max Score:", Math.max(...results.map((r) => r.score)).toFixed(1));
console.log(
  "Avg Score:",
  (results.reduce((sum, r) => sum + r.score, 0) / results.length).toFixed(1)
);
console.log(
  "Score Spread:",
  (Math.max(...results.map((r) => r.score)) - Math.min(...results.map((r) => r.score))).toFixed(1)
);
