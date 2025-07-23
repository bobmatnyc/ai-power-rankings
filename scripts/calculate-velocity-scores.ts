#!/usr/bin/env ts-node

import * as fs from "node:fs";
import * as path from "node:path";

interface NewsArticle {
  id: string;
  slug: string;
  title: string;
  content: string;
  summary: string;
  source?: string;
  source_url?: string;
  tags: string[];
  tool_mentions: string[];
  created_at: string;
  updated_at: string;
  date: string;
}

interface Tool {
  id: string;
  slug: string;
  name: string;
  category: string;
  status: string;
}

interface VelocityScore {
  toolId: string;
  toolName: string;
  score: number;
  newsCount30Days: number;
  newsCount90Days: number;
  lastNewsDate: string | null;
  releaseNews: number;
  fundingNews: number;
  featureNews: number;
  momentum: "high" | "medium" | "low" | "stagnant";
  recentHighlights: string[];
}

// Load tools
const toolsPath = path.join(__dirname, "../data/json/tools/tools.json");
const toolsData = JSON.parse(fs.readFileSync(toolsPath, "utf-8"));
const tools: Tool[] = toolsData.tools;

// Create tool map for quick lookup
const toolMap = new Map<string, Tool>();
tools.forEach((tool) => {
  toolMap.set(tool.id, tool);
});

// Load all news articles from recent months
const newsDir = path.join(__dirname, "../data/json/news/articles");
const recentMonths = ["2025-07", "2025-06", "2025-05", "2025-04", "2025-03", "2025-02"];
const allArticles: NewsArticle[] = [];

console.log("Loading news articles...");
recentMonths.forEach((month) => {
  const monthPath = path.join(newsDir, `${month}.json`);
  if (fs.existsSync(monthPath)) {
    try {
      const monthData = JSON.parse(fs.readFileSync(monthPath, "utf-8"));
      allArticles.push(...monthData);
      console.log(`Loaded ${monthData.length} articles from ${month}`);
    } catch (error) {
      console.error(`Error loading ${month}:`, error);
    }
  }
});

console.log(`\nTotal articles loaded: ${allArticles.length}`);

// Calculate days between dates
function daysBetween(date1: Date, date2: Date): number {
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Extract news type from content/tags
function analyzeNewsType(article: NewsArticle) {
  const content = `${article.content} ${article.summary} ${article.title}`.toLowerCase();
  const tags = article.tags.map((t) => t.toLowerCase());

  const result = {
    isRelease: false,
    isFunding: false,
    isFeature: false,
    isBenchmark: false,
    isPartnership: false,
  };

  // Release indicators
  if (
    content.includes("launch") ||
    content.includes("release") ||
    content.includes("unveil") ||
    content.includes("announce") ||
    content.includes("introduce") ||
    tags.includes("product")
  ) {
    result.isRelease = true;
  }

  // Funding indicators
  if (
    content.includes("funding") ||
    content.includes("investment") ||
    content.includes("valuation") ||
    content.includes("series") ||
    content.includes("raise") ||
    content.includes("$") ||
    content.includes("revenue") ||
    content.includes("arr")
  ) {
    result.isFunding = true;
  }

  // Feature indicators
  if (
    content.includes("feature") ||
    content.includes("update") ||
    content.includes("improvement") ||
    content.includes("capability") ||
    content.includes("integration") ||
    tags.includes("features")
  ) {
    result.isFeature = true;
  }

  // Benchmark indicators
  if (
    content.includes("benchmark") ||
    content.includes("performance") ||
    content.includes("test") ||
    tags.includes("benchmarks")
  ) {
    result.isBenchmark = true;
  }

  // Partnership indicators
  if (
    content.includes("partnership") ||
    content.includes("collaborate") ||
    content.includes("integrate")
  ) {
    result.isPartnership = true;
  }

  return result;
}

// Calculate velocity scores
const velocityScores: VelocityScore[] = [];
const now = new Date();

tools.forEach((tool) => {
  // Find all articles mentioning this tool
  const toolArticles = allArticles.filter((article) => article.tool_mentions?.includes(tool.id));

  // Sort by date
  toolArticles.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Count articles in different time windows
  const articles30Days = toolArticles.filter((article) => {
    const articleDate = new Date(article.date);
    return daysBetween(articleDate, now) <= 30;
  });

  const articles90Days = toolArticles.filter((article) => {
    const articleDate = new Date(article.date);
    return daysBetween(articleDate, now) <= 90;
  });

  // Analyze news types
  let releaseCount = 0;
  let fundingCount = 0;
  let featureCount = 0;
  const recentHighlights: string[] = [];

  articles30Days.forEach((article) => {
    const newsType = analyzeNewsType(article);
    if (newsType.isRelease) releaseCount++;
    if (newsType.isFunding) fundingCount++;
    if (newsType.isFeature) featureCount++;

    // Add highlight if significant
    if (newsType.isRelease || newsType.isFunding) {
      const highlight =
        article.title.length > 80 ? `${article.title.substring(0, 77)}...` : article.title;
      recentHighlights.push(highlight);
    }
  });

  // Calculate velocity score (0-100)
  let score = 0;

  // Base score from news volume (max 40 points)
  const volumeScore = Math.min(40, articles30Days.length * 4);
  score += volumeScore;

  // Release bonus (max 20 points)
  score += Math.min(20, releaseCount * 10);

  // Funding bonus (max 15 points)
  score += Math.min(15, fundingCount * 15);

  // Feature updates bonus (max 15 points)
  score += Math.min(15, featureCount * 5);

  // Recency bonus (max 10 points)
  if (articles30Days.length > 0 && articles30Days[0]) {
    const daysSinceLastNews = daysBetween(new Date(articles30Days[0].date), now);
    if (daysSinceLastNews <= 7) score += 10;
    else if (daysSinceLastNews <= 14) score += 5;
    else if (daysSinceLastNews <= 21) score += 2;
  }

  // Determine momentum
  let momentum: "high" | "medium" | "low" | "stagnant" = "stagnant";
  if (score >= 70) momentum = "high";
  else if (score >= 40) momentum = "medium";
  else if (score >= 20) momentum = "low";

  // Special case: no news in 30 days but had news in 90 days
  if (articles30Days.length === 0 && articles90Days.length > 0) {
    score = Math.max(10, score); // Minimum score of 10 for tools with some activity
  }

  // Special case: no news at all
  if (toolArticles.length === 0) {
    score = 5; // Minimum baseline score
  }

  velocityScores.push({
    toolId: tool.id,
    toolName: tool.name,
    score: Math.round(score),
    newsCount30Days: articles30Days.length,
    newsCount90Days: articles90Days.length,
    lastNewsDate: toolArticles.length > 0 && toolArticles[0] ? toolArticles[0].date : null,
    releaseNews: releaseCount,
    fundingNews: fundingCount,
    featureNews: featureCount,
    momentum,
    recentHighlights: recentHighlights.slice(0, 3), // Top 3 highlights
  });
});

// Sort by score
velocityScores.sort((a, b) => b.score - a.score);

// Output results
console.log("\n=== VELOCITY SCORES ANALYSIS ===\n");

console.log("Top 10 High-Velocity Tools:");
velocityScores.slice(0, 10).forEach((vs, index) => {
  console.log(`${index + 1}. ${vs.toolName} (ID: ${vs.toolId})`);
  console.log(`   Score: ${vs.score} | Momentum: ${vs.momentum}`);
  console.log(`   News: ${vs.newsCount30Days} (30d) / ${vs.newsCount90Days} (90d)`);
  console.log(
    `   Activity: ${vs.releaseNews} releases, ${vs.fundingNews} funding, ${vs.featureNews} features`
  );
  if (vs.recentHighlights.length > 0) {
    console.log(`   Recent: "${vs.recentHighlights[0]}"`);
  }
  console.log();
});

console.log("\nBottom 10 Low-Velocity Tools:");
const bottomTools = velocityScores.slice(-10).reverse();
bottomTools.forEach((vs, index) => {
  console.log(`${index + 1}. ${vs.toolName} (ID: ${vs.toolId})`);
  console.log(`   Score: ${vs.score} | Momentum: ${vs.momentum}`);
  console.log(`   News: ${vs.newsCount30Days} (30d) / ${vs.newsCount90Days} (90d)`);
  if (vs.lastNewsDate) {
    const daysSince = daysBetween(new Date(vs.lastNewsDate), now);
    console.log(`   Last news: ${daysSince} days ago`);
  } else {
    console.log("   Last news: Never");
  }
  console.log();
});

// Save results
const outputPath = path.join(__dirname, "../data/velocity-scores.json");
fs.writeFileSync(
  outputPath,
  JSON.stringify(
    {
      generated: new Date().toISOString(),
      scores: velocityScores,
    },
    null,
    2
  )
);

console.log(`\nVelocity scores saved to: ${outputPath}`);

// Generate summary statistics
const highVelocity = velocityScores.filter((vs) => vs.momentum === "high").length;
const mediumVelocity = velocityScores.filter((vs) => vs.momentum === "medium").length;
const lowVelocity = velocityScores.filter((vs) => vs.momentum === "low").length;
const stagnant = velocityScores.filter((vs) => vs.momentum === "stagnant").length;

console.log("\n=== SUMMARY STATISTICS ===");
console.log(`Total tools analyzed: ${velocityScores.length}`);
console.log(
  `High velocity: ${highVelocity} tools (${((highVelocity / velocityScores.length) * 100).toFixed(1)}%)`
);
console.log(
  `Medium velocity: ${mediumVelocity} tools (${((mediumVelocity / velocityScores.length) * 100).toFixed(1)}%)`
);
console.log(
  `Low velocity: ${lowVelocity} tools (${((lowVelocity / velocityScores.length) * 100).toFixed(1)}%)`
);
console.log(
  `Stagnant: ${stagnant} tools (${((stagnant / velocityScores.length) * 100).toFixed(1)}%)`
);

// Average scores
const avgScore = velocityScores.reduce((sum, vs) => sum + vs.score, 0) / velocityScores.length;
console.log(`\nAverage velocity score: ${avgScore.toFixed(1)}`);

// Tools with no news
const noNews = velocityScores.filter((vs) => vs.newsCount90Days === 0).length;
console.log(`Tools with no news in 90 days: ${noNews}`);
