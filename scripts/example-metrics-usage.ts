/**
 * Example: How to Use GitHub Metrics in Rankings
 * Demonstrates integration with the ranking algorithm
 */

import dotenv from "dotenv";
import { getDb } from "../lib/db/connection";
import { tools } from "../lib/db/schema";
import { sql } from "drizzle-orm";

dotenv.config({ path: ".env.local" });

interface GitHubMetrics {
  stars: number;
  forks: number;
  commit_count_30d: number;
  contributors_count: number;
  open_issues: number;
  language: string | null;
  last_updated: string;
}

/**
 * Example scoring function using GitHub metrics
 */
function calculateGitHubScore(metrics: GitHubMetrics): number {
  // Weighted scoring based on different factors
  const weights = {
    popularity: 0.40, // Stars and forks indicate community adoption
    activity: 0.30, // Recent commits show active development
    health: 0.20, // Issue management and contributor diversity
    maturity: 0.10, // Language and repository age
  };

  // Popularity score (0-100)
  // Logarithmic scale: 10 stars = 50, 100 stars = 75, 1000 stars = 87.5, 10000 stars = 93.75
  const popularityScore =
    Math.min(100, (Math.log10(metrics.stars + 1) / Math.log10(100000)) * 100) * 0.7 +
    Math.min(100, (Math.log10(metrics.forks + 1) / Math.log10(10000)) * 100) * 0.3;

  // Activity score (0-100)
  // More recent commits = better score
  // 10+ commits/month = 100, 5 commits = 75, 1 commit = 50, 0 commits = 0
  const activityScore = Math.min(100, (metrics.commit_count_30d / 10) * 100);

  // Health score (0-100)
  // Fewer open issues relative to activity is better
  const issueRatio =
    metrics.commit_count_30d > 0 ? metrics.open_issues / metrics.commit_count_30d : 10;
  const healthScore = Math.max(0, 100 - issueRatio * 5); // Penalty for high issue-to-commit ratio

  // Maturity score (0-100)
  // Based on primary language and contributor count
  const languageScore =
    {
      Python: 90,
      TypeScript: 95,
      JavaScript: 85,
      Rust: 100,
      Go: 95,
    }[metrics.language || ""] || 70;

  const maturityScore = languageScore * 0.7 + Math.min(100, metrics.contributors_count * 10) * 0.3;

  // Weighted final score
  const finalScore =
    popularityScore * weights.popularity +
    activityScore * weights.activity +
    healthScore * weights.health +
    maturityScore * weights.maturity;

  return Math.round(finalScore * 100) / 100; // Round to 2 decimal places
}

/**
 * Example: Boost ranking based on GitHub metrics
 */
function calculateMetricsBoost(metrics: GitHubMetrics): number {
  // Simple boost calculation: 0-20% boost based on metrics
  const githubScore = calculateGitHubScore(metrics);

  // Convert 0-100 score to 0-20% boost
  return (githubScore / 100) * 0.2;
}

async function main() {
  console.log("📊 Example: Using GitHub Metrics in Rankings\n");

  const db = getDb();
  if (!db) {
    console.error("❌ Database connection not available");
    process.exit(1);
  }

  // Fetch tools with GitHub metrics
  const toolsWithMetrics = await db
    .select()
    .from(tools)
    .where(sql`data->'metrics'->'github' IS NOT NULL`);

  if (toolsWithMetrics.length === 0) {
    console.log("❌ No tools with GitHub metrics found");
    console.log("   Run: npx tsx scripts/collect-github-metrics.ts --test");
    return;
  }

  console.log("=".repeat(80));
  console.log("📈 GitHub Metrics Scoring Analysis");
  console.log("=".repeat(80));
  console.log("");

  const scoredTools: Array<{
    name: string;
    metrics: GitHubMetrics;
    score: number;
    boost: number;
    breakdown: {
      popularity: number;
      activity: number;
      health: number;
      maturity: number;
    };
  }> = [];

  for (const tool of toolsWithMetrics) {
    const toolData = tool.data as any;
    const githubMetrics = toolData?.metrics?.github as GitHubMetrics;

    if (!githubMetrics) continue;

    const score = calculateGitHubScore(githubMetrics);
    const boost = calculateMetricsBoost(githubMetrics);

    // Calculate individual components for breakdown
    const popularityScore =
      Math.min(100, (Math.log10(githubMetrics.stars + 1) / Math.log10(100000)) * 100) * 0.7 +
      Math.min(100, (Math.log10(githubMetrics.forks + 1) / Math.log10(10000)) * 100) * 0.3;

    const activityScore = Math.min(100, (githubMetrics.commit_count_30d / 10) * 100);

    const issueRatio =
      githubMetrics.commit_count_30d > 0
        ? githubMetrics.open_issues / githubMetrics.commit_count_30d
        : 10;
    const healthScore = Math.max(0, 100 - issueRatio * 5);

    const languageScore =
      {
        Python: 90,
        TypeScript: 95,
        JavaScript: 85,
        Rust: 100,
        Go: 95,
      }[githubMetrics.language || ""] || 70;

    const maturityScore =
      languageScore * 0.7 + Math.min(100, githubMetrics.contributors_count * 10) * 0.3;

    scoredTools.push({
      name: tool.name,
      metrics: githubMetrics,
      score,
      boost,
      breakdown: {
        popularity: Math.round(popularityScore * 100) / 100,
        activity: Math.round(activityScore * 100) / 100,
        health: Math.round(healthScore * 100) / 100,
        maturity: Math.round(maturityScore * 100) / 100,
      },
    });
  }

  // Sort by score
  scoredTools.sort((a, b) => b.score - a.score);

  // Display results
  scoredTools.forEach((tool, idx) => {
    console.log(`${idx + 1}. ${tool.name}`);
    console.log("─".repeat(80));
    console.log(`   Overall Score: ${tool.score.toFixed(2)}/100`);
    console.log(`   Ranking Boost: +${(tool.boost * 100).toFixed(1)}%`);
    console.log("");
    console.log(`   📊 Score Breakdown (Weighted):`);
    console.log(`      Popularity (40%): ${tool.breakdown.popularity.toFixed(1)}/100`);
    console.log(
      `        ⭐ ${tool.metrics.stars.toLocaleString()} stars, 🍴 ${tool.metrics.forks.toLocaleString()} forks`
    );
    console.log(`      Activity (30%):   ${tool.breakdown.activity.toFixed(1)}/100`);
    console.log(`        📝 ${tool.metrics.commit_count_30d} commits in last 30 days`);
    console.log(`      Health (20%):     ${tool.breakdown.health.toFixed(1)}/100`);
    console.log(`        🐛 ${tool.metrics.open_issues.toLocaleString()} open issues`);
    console.log(`      Maturity (10%):   ${tool.breakdown.maturity.toFixed(1)}/100`);
    console.log(
      `        💻 ${tool.metrics.language || "Unknown"}, 👥 ${tool.metrics.contributors_count} contributors`
    );
    console.log("");
  });

  console.log("=".repeat(80));
  console.log("💡 Integration Example:");
  console.log("─".repeat(80));
  console.log("In your ranking algorithm, you can use the boost like this:");
  console.log("");
  console.log("```typescript");
  console.log("const baseScore = calculateBaseScore(tool);");
  console.log("const githubBoost = tool.metrics?.github");
  console.log("  ? calculateMetricsBoost(tool.metrics.github)");
  console.log("  : 0;");
  console.log("");
  console.log("const finalScore = baseScore * (1 + githubBoost);");
  console.log("// Example: baseScore of 80 with 15% boost = 92");
  console.log("```");
  console.log("");
  console.log("=".repeat(80));
  console.log("✅ Analysis complete!");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
