/**
 * Debug script to check score calculation
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { NewsRepository } from "../lib/json-db/news-repository";
import { ToolsRepository } from "../lib/json-db/tools-repository";
import { RankingEngineV7 } from "../lib/ranking-algorithm-v7-fixed";
import type { NewsArticle } from "../lib/ranking-news-impact";

async function debugScoreCalculation() {
  console.log("🔍 Debugging score calculation...\n");

  // Load velocity scores
  const velocityScoresPath = path.join(process.cwd(), "data/velocity-scores.json");
  const velocityData = JSON.parse(fs.readFileSync(velocityScoresPath, "utf-8"));

  // Create velocity map for engine
  const velocityMap = new Map<string, number>();
  for (const item of velocityData.scores) {
    velocityMap.set(item.toolId, item.score);
  }

  // Initialize repositories
  const toolsRepo = new ToolsRepository();
  const newsRepo = new NewsRepository();

  // Initialize ranking engine with velocity scores
  const engine = new RankingEngineV7(velocityMap);

  // Load one tool for testing
  const tools = await toolsRepo.getAll();
  const testTool = tools.find((t) => t.name === "Claude Code")!;

  // Load all news articles
  const allNews = await newsRepo.getAll();

  // Set current date
  const currentDate = new Date("2025-07-23");

  console.log(`Testing with tool: ${testTool.name}`);
  console.log(`Tool ID: ${testTool.id}`);

  // Convert tool to metrics format
  const metrics = {
    tool_id: testTool.id,
    name: testTool.name,
    category: testTool.category,
    status: testTool.status,
    info: testTool.info,
  };

  // Get velocity score
  const velocityScore = velocityMap.get(testTool.id) || 5;
  console.log(`Velocity Score: ${velocityScore}`);

  // Calculate score
  const score = engine.calculateToolScore(metrics, currentDate, allNews as NewsArticle[]);

  console.log("\nFactor Scores:");
  console.log(JSON.stringify(score.factorScores, null, 2));

  console.log("\nWeights:");
  console.log(JSON.stringify(engine.weights, null, 2));

  console.log(`\nOverall Score: ${score.overallScore}`);

  // Manual calculation
  let manualScore = 0;
  for (const [factor, weight] of Object.entries(engine.weights)) {
    const factorScore = score.factorScores[factor as keyof typeof score.factorScores] || 0;
    console.log(`${factor}: ${factorScore} * ${weight} = ${factorScore * weight}`);
    manualScore += factorScore * weight;
  }
  console.log(`\nManual Overall Score: ${manualScore}`);
}

// Execute
debugScoreCalculation().catch(console.error);
