#!/usr/bin/env ts-node

import * as fs from "node:fs";
import * as path from "node:path";

// Load velocity scores
const velocityPath = path.join(__dirname, "../data/velocity-scores.json");
const velocityData = JSON.parse(fs.readFileSync(velocityPath, "utf-8"));

// Create velocity lookup map
const velocityMap = new Map<string, number>();
const momentumMap = new Map<string, string>();

velocityData.scores.forEach((score: { toolId: string; score: number; momentum: string }) => {
  velocityMap.set(score.toolId, score.score);
  momentumMap.set(score.toolId, score.momentum);
});

// Example: Calculate ranking score with dynamic velocity
function calculateRankingScore(toolId: string, baseScore: number): number {
  // Get dynamic velocity score (default to 20 if not found)
  const velocity = velocityMap.get(toolId) || 20;

  // Get momentum category
  const momentum = momentumMap.get(toolId) || "stagnant";

  // Momentum multiplier
  const momentumMultiplier =
    {
      high: 1.2,
      medium: 1.0,
      low: 0.8,
      stagnant: 0.6,
    }[momentum] || 0.6;

  // Calculate adjusted score
  const velocityWeight = 0.3; // 30% weight for velocity
  const adjustedScore = baseScore * (1 - velocityWeight) + velocity * velocityWeight;

  // Apply momentum multiplier
  const finalScore = adjustedScore * momentumMultiplier;

  return Math.round(finalScore);
}

// Test with some example tools
console.log("=== VELOCITY INTEGRATION TEST ===\n");

const testCases = [
  { id: "2", name: "GitHub Copilot", baseScore: 85 },
  { id: "1", name: "Cursor", baseScore: 88 },
  { id: "14", name: "Windsurf", baseScore: 80 },
  { id: "31", name: "Kiro", baseScore: 75 },
  { id: "19", name: "Claude Artifacts", baseScore: 70 },
  { id: "23", name: "Zed", baseScore: 65 },
];

console.log("Tool Rankings with Dynamic Velocity:\n");
console.log("Tool Name          | Base | Velocity | Momentum | Final Score");
console.log("-------------------|------|----------|----------|------------");

const results = testCases.map((test) => {
  const velocity = velocityMap.get(test.id) || 20;
  const momentum = momentumMap.get(test.id) || "stagnant";
  const finalScore = calculateRankingScore(test.id, test.baseScore);

  return {
    ...test,
    velocity,
    momentum,
    finalScore,
  };
});

// Sort by final score
results.sort((a, b) => b.finalScore - a.finalScore);

results.forEach((result) => {
  console.log(
    `${result.name.padEnd(18)} | ${result.baseScore.toString().padEnd(4)} | ` +
      `${result.velocity.toString().padEnd(8)} | ${result.momentum.padEnd(8)} | ${result.finalScore}`
  );
});

console.log("\n=== COMPARISON: Static vs Dynamic Velocity ===\n");

console.log("Tool Name          | Static V=60 | Dynamic V   | Difference");
console.log("-------------------|-------------|-------------|------------");

testCases.forEach((test) => {
  // Calculate with static velocity of 60
  const staticScore = Math.round(test.baseScore * 0.7 + 60 * 0.3);

  // Calculate with dynamic velocity
  const dynamicScore = calculateRankingScore(test.id, test.baseScore);

  const difference = dynamicScore - staticScore;
  const sign = difference >= 0 ? "+" : "";

  console.log(
    `${test.name.padEnd(18)} | ${staticScore.toString().padEnd(11)} | ` +
      `${dynamicScore.toString().padEnd(11)} | ${sign}${difference}`
  );
});

console.log("\n=== KEY INSIGHTS ===\n");

// Find biggest movers
const movers = testCases
  .map((test) => {
    const staticScore = Math.round(test.baseScore * 0.7 + 60 * 0.3);
    const dynamicScore = calculateRankingScore(test.id, test.baseScore);
    return {
      name: test.name,
      change: dynamicScore - staticScore,
      velocity: velocityMap.get(test.id) || 20,
      momentum: momentumMap.get(test.id) || "stagnant",
    };
  })
  .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

console.log("Biggest Changes:");
movers.slice(0, 3).forEach((mover) => {
  const direction = mover.change > 0 ? "UP" : "DOWN";
  console.log(
    `- ${mover.name}: ${direction} ${Math.abs(mover.change)} points (velocity: ${mover.velocity}, momentum: ${mover.momentum})`
  );
});

// Summary statistics
const highMomentumTools = Array.from(momentumMap.values()).filter((m) => m === "high").length;
const avgVelocity =
  Array.from(velocityMap.values()).reduce((sum, v) => sum + v, 0) / velocityMap.size;

console.log("\nVelocity Distribution:");
console.log(`- High momentum tools: ${highMomentumTools}`);
console.log(`- Average velocity score: ${avgVelocity.toFixed(1)}`);
console.log(
  `- Tools above average: ${Array.from(velocityMap.values()).filter((v) => v > avgVelocity).length}`
);
console.log(
  `- Tools below average: ${Array.from(velocityMap.values()).filter((v) => v < avgVelocity).length}`
);
