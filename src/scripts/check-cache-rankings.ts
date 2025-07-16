#!/usr/bin/env tsx

import fs from "node:fs";
import path from "node:path";

interface RankingItem {
  rank: number;
  tool: {
    id: string;
    name: string;
    category: string;
    status: string;
    website_url?: string;
  };
  total_score: number;
  scores: {
    overall: number;
    base_score: number;
    news_impact: number;
    agentic_capability: number;
    innovation: number;
  };
}

interface RankingsCache {
  rankings: RankingItem[];
  algorithm: {
    version: string;
    date: string;
  };
}

const cacheFile = path.join(process.cwd(), "src/data/cache/rankings.json");

if (fs.existsSync(cacheFile)) {
  const data: RankingsCache = JSON.parse(fs.readFileSync(cacheFile, "utf-8"));

  console.log("=== Rankings Cache Analysis ===");
  console.log(`Total tools: ${data.rankings.length}`);
  console.log(`Algorithm: ${data.algorithm.version}`);
  console.log(`Generated: ${data.algorithm.date}`);

  // Check scores
  const scores = data.rankings.map((r) => r.total_score);
  const uniqueScores = [...new Set(scores)];
  console.log(`\nUnique scores: ${uniqueScores.length}`);

  // Show score distribution
  console.log("\nScore distribution:");
  uniqueScores
    .sort((a, b) => b - a)
    .forEach((score) => {
      const count = scores.filter((s: number) => s === score).length;
      console.log(`  ${score.toFixed(2)}: ${count} tool(s)`);
    });

  // Show top 10
  console.log("\nTop 10 Rankings:");
  data.rankings.slice(0, 10).forEach((r) => {
    console.log(`\n#${r.rank} ${r.tool.name}`);
    console.log(`  Total Score: ${r.total_score.toFixed(2)}`);
    console.log("  Scores:");
    console.log(`    - Overall: ${r.scores.overall.toFixed(2)}`);
    console.log(`    - Base: ${r.scores.base_score}`);
    console.log(`    - News Impact: ${r.scores.news_impact.toFixed(2)}`);
    console.log(`    - Agentic: ${r.scores.agentic_capability}`);
    console.log(`    - Innovation: ${r.scores.innovation.toFixed(2)}`);
  });
} else {
  console.error("Rankings cache file not found!");
}
