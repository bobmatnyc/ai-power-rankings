#!/usr/bin/env tsx
/**
 * Analyze Current Baseline State Script
 * Prepares for creating May 2025 baseline snapshot
 *
 * This script:
 * 1. Queries current tool scores (baseline, delta, current)
 * 2. Analyzes article history and ingestion dates
 * 3. Identifies articles from May 2025 vs June+ 2025
 * 4. Checks baseline snapshot infrastructure
 * 5. Provides recommendations for baseline creation
 *
 * Usage: npx tsx scripts/analyze-baseline-state.ts
 */

import { config } from "dotenv";

// Load environment variables
config({ path: ".env.local" });
config({ path: ".env" });

import { getDb, testConnection, closeDb } from "../lib/db/connection";
import { sql } from "drizzle-orm";
import { tools } from "../lib/db/schema";
import { articles, rankingVersions } from "../lib/db/article-schema";
import { desc, eq } from "drizzle-orm";

// Color codes for console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log("");
  log(`${"=".repeat(80)}`, colors.cyan);
  log(`  ${title.toUpperCase()}`, colors.bright + colors.cyan);
  log(`${"=".repeat(80)}`, colors.cyan);
  console.log("");
}

function logSuccess(message: string) {
  log(`✅ ${message}`, colors.green);
}

function logError(message: string) {
  log(`❌ ${message}`, colors.red);
}

function logInfo(message: string) {
  log(`ℹ️  ${message}`, colors.blue);
}

function logWarning(message: string) {
  log(`⚠️  ${message}`, colors.yellow);
}

interface ToolScoreAnalysis {
  totalTools: number;
  toolsWithBaseline: number;
  toolsWithDelta: number;
  toolsWithCurrentScore: number;
  scoreRanges: {
    baseline: { min: number; max: number; avg: number };
    delta: { min: number; max: number; avg: number };
    current: { min: number; max: number; avg: number };
  };
  sampleTools: Array<{
    id: string;
    name: string;
    baseline: any;
    delta: any;
    current: any;
    scoreUpdatedAt: Date | null;
  }>;
}

interface ArticleAnalysis {
  totalArticles: number;
  may2025OrEarlier: number;
  june2025OrLater: number;
  articlesWithoutDate: number;
  dateRange: {
    earliest: Date | null;
    latest: Date | null;
  };
  articlesByMonth: { [key: string]: number };
  sampleArticles: Array<{
    id: string;
    title: string;
    publishedDate: Date | null;
    ingestedAt: Date;
    toolMentionsCount: number;
  }>;
}

async function analyzeToolScores(): Promise<ToolScoreAnalysis> {
  logSection("Tool Scores Analysis");

  const db = getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // Get all tools with their scores
  const allTools = await db
    .select({
      id: tools.id,
      slug: tools.slug,
      name: tools.name,
      data: tools.data,
      baselineScore: tools.baselineScore,
      deltaScore: tools.deltaScore,
      currentScore: tools.currentScore,
      scoreUpdatedAt: tools.scoreUpdatedAt,
    })
    .from(tools)
    .where(eq(tools.status, "active"));

  logInfo(`Total active tools: ${allTools.length}`);

  // Analyze score presence
  let toolsWithBaseline = 0;
  let toolsWithDelta = 0;
  let toolsWithCurrentScore = 0;

  const baselineScores: number[] = [];
  const deltaScores: number[] = [];
  const currentScores: number[] = [];

  allTools.forEach(tool => {
    const baseline = tool.baselineScore as any;
    const delta = tool.deltaScore as any;
    const current = tool.currentScore as any;

    if (baseline && Object.keys(baseline).length > 0) {
      toolsWithBaseline++;
      if (baseline.overallScore !== undefined) {
        baselineScores.push(baseline.overallScore);
      }
    }

    if (delta && Object.keys(delta).length > 0) {
      toolsWithDelta++;
      if (delta.overallScore !== undefined) {
        deltaScores.push(delta.overallScore);
      }
    }

    if (current && Object.keys(current).length > 0) {
      toolsWithCurrentScore++;
      if (current.overallScore !== undefined) {
        currentScores.push(current.overallScore);
      }
    }
  });

  logInfo(`Tools with baseline score: ${toolsWithBaseline}`);
  logInfo(`Tools with delta score: ${toolsWithDelta}`);
  logInfo(`Tools with current score: ${toolsWithCurrentScore}`);

  // Calculate score ranges
  const calcRange = (scores: number[]) => {
    if (scores.length === 0) return { min: 0, max: 0, avg: 0 };
    return {
      min: Math.min(...scores),
      max: Math.max(...scores),
      avg: scores.reduce((a, b) => a + b, 0) / scores.length,
    };
  };

  const scoreRanges = {
    baseline: calcRange(baselineScores),
    delta: calcRange(deltaScores),
    current: calcRange(currentScores),
  };

  logInfo(`Baseline scores: min=${scoreRanges.baseline.min.toFixed(2)}, max=${scoreRanges.baseline.max.toFixed(2)}, avg=${scoreRanges.baseline.avg.toFixed(2)}`);
  logInfo(`Delta scores: min=${scoreRanges.delta.min.toFixed(2)}, max=${scoreRanges.delta.max.toFixed(2)}, avg=${scoreRanges.delta.avg.toFixed(2)}`);
  logInfo(`Current scores: min=${scoreRanges.current.min.toFixed(2)}, max=${scoreRanges.current.max.toFixed(2)}, avg=${scoreRanges.current.avg.toFixed(2)}`);

  // Get sample tools
  const sampleTools = allTools.slice(0, 5).map(tool => ({
    id: tool.id,
    name: tool.name,
    baseline: tool.baselineScore,
    delta: tool.deltaScore,
    current: tool.currentScore,
    scoreUpdatedAt: tool.scoreUpdatedAt,
  }));

  console.log("\nSample tools:");
  sampleTools.forEach((tool, idx) => {
    console.log(`${idx + 1}. ${tool.name}`);
    console.log(`   Baseline: ${JSON.stringify(tool.baseline)}`);
    console.log(`   Delta: ${JSON.stringify(tool.delta)}`);
    console.log(`   Current: ${JSON.stringify(tool.current)}`);
    console.log(`   Updated: ${tool.scoreUpdatedAt ? tool.scoreUpdatedAt.toISOString() : 'Never'}`);
  });

  return {
    totalTools: allTools.length,
    toolsWithBaseline,
    toolsWithDelta,
    toolsWithCurrentScore,
    scoreRanges,
    sampleTools,
  };
}

async function analyzeArticleHistory(): Promise<ArticleAnalysis> {
  logSection("Article History Analysis");

  const db = getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // Get all articles
  const allArticles = await db
    .select({
      id: articles.id,
      title: articles.title,
      publishedDate: articles.publishedDate,
      ingestedAt: articles.ingestedAt,
      toolMentions: articles.toolMentions,
      status: articles.status,
    })
    .from(articles)
    .where(eq(articles.status, "active"))
    .orderBy(desc(articles.publishedDate));

  logInfo(`Total active articles: ${allArticles.length}`);

  // Analyze dates
  const may2025Cutoff = new Date('2025-06-01T00:00:00Z');
  let may2025OrEarlier = 0;
  let june2025OrLater = 0;
  let articlesWithoutDate = 0;

  const articlesByMonth: { [key: string]: number } = {};
  let earliest: Date | null = null;
  let latest: Date | null = null;

  allArticles.forEach(article => {
    const pubDate = article.publishedDate;

    if (!pubDate) {
      articlesWithoutDate++;
      return;
    }

    // Track earliest and latest
    if (!earliest || pubDate < earliest) earliest = pubDate;
    if (!latest || pubDate > latest) latest = pubDate;

    // Count by cutoff
    if (pubDate < may2025Cutoff) {
      may2025OrEarlier++;
    } else {
      june2025OrLater++;
    }

    // Group by month
    const monthKey = `${pubDate.getFullYear()}-${String(pubDate.getMonth() + 1).padStart(2, '0')}`;
    articlesByMonth[monthKey] = (articlesByMonth[monthKey] || 0) + 1;
  });

  logInfo(`Articles May 2025 or earlier: ${may2025OrEarlier}`);
  logInfo(`Articles June 2025 or later: ${june2025OrLater}`);
  logInfo(`Articles without published date: ${articlesWithoutDate}`);

  if (earliest && latest) {
    logInfo(`Date range: ${earliest.toISOString().split('T')[0]} to ${latest.toISOString().split('T')[0]}`);
  }

  console.log("\nArticles by month:");
  Object.entries(articlesByMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([month, count]) => {
      console.log(`  ${month}: ${count} articles`);
    });

  // Get sample articles from different time periods
  const sampleArticles = allArticles.slice(0, 10).map(article => ({
    id: article.id,
    title: article.title.substring(0, 60),
    publishedDate: article.publishedDate,
    ingestedAt: article.ingestedAt,
    toolMentionsCount: Array.isArray(article.toolMentions) ? article.toolMentions.length : 0,
  }));

  console.log("\nSample articles:");
  sampleArticles.forEach((article, idx) => {
    const dateStr = article.publishedDate
      ? article.publishedDate.toISOString().split('T')[0]
      : 'No date';
    console.log(`${idx + 1}. ${article.title}`);
    console.log(`   Published: ${dateStr} | Tools: ${article.toolMentionsCount}`);
  });

  return {
    totalArticles: allArticles.length,
    may2025OrEarlier,
    june2025OrLater,
    articlesWithoutDate,
    dateRange: {
      earliest,
      latest,
    },
    articlesByMonth,
    sampleArticles,
  };
}

async function checkBaselineInfrastructure() {
  logSection("Baseline Infrastructure Check");

  const db = getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // Check if ranking_versions table exists
  try {
    const result = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'ranking_versions'
      ) as exists
    `);

    const exists = (result.rows[0] as any)?.exists || false;

    if (exists) {
      logSuccess("ranking_versions table exists");

      // Check for existing versions
      const versions = await db
        .select()
        .from(rankingVersions)
        .orderBy(desc(rankingVersions.createdAt))
        .limit(10);

      logInfo(`Found ${versions.length} existing ranking versions`);

      if (versions.length > 0) {
        console.log("\nExisting versions:");
        versions.forEach((v, idx) => {
          console.log(`${idx + 1}. Version: ${v.version}`);
          console.log(`   Created: ${v.createdAt.toISOString()}`);
          console.log(`   Summary: ${v.changesSummary || 'N/A'}`);
        });
      }

      // Check for May 2025 baseline specifically
      const may2025Versions = versions.filter(v =>
        v.version.includes('may') ||
        v.version.includes('May') ||
        v.version.includes('2025-05') ||
        v.version.includes('baseline')
      );

      if (may2025Versions.length > 0) {
        logSuccess(`Found ${may2025Versions.length} potential May 2025 baseline versions`);
      } else {
        logWarning("No May 2025 baseline version found");
      }
    } else {
      logError("ranking_versions table does not exist");
      logInfo("Table needs to be created via migration");
    }
  } catch (error) {
    logError(`Failed to check ranking_versions: ${error}`);
  }

  // Check if tools table has scoring columns
  try {
    const result = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'tools'
      AND column_name IN ('baseline_score', 'delta_score', 'current_score', 'score_updated_at')
      ORDER BY column_name
    `);

    const columns = result.rows.map((r: any) => r.column_name);

    if (columns.length === 4) {
      logSuccess("All scoring columns exist in tools table");
    } else {
      logWarning(`Missing scoring columns: ${4 - columns.length}`);
      logInfo(`Found: ${columns.join(', ')}`);
    }
  } catch (error) {
    logError(`Failed to check tools columns: ${error}`);
  }
}

function generateRecommendations(
  toolScores: ToolScoreAnalysis,
  articleHistory: ArticleAnalysis
) {
  logSection("Recommendations for May 2025 Baseline");

  console.log("Based on the analysis, here are the recommended steps:\n");

  // 1. Baseline snapshot requirement
  log("1. CREATE MAY 2025 BASELINE SNAPSHOT", colors.bright + colors.cyan);

  if (toolScores.toolsWithBaseline === 0) {
    logWarning("No tools have baseline scores initialized");
    logInfo("→ Run: npx tsx scripts/initialize-baseline-scores.ts");
  } else if (toolScores.toolsWithBaseline < toolScores.totalTools) {
    logWarning(`Only ${toolScores.toolsWithBaseline}/${toolScores.totalTools} tools have baseline scores`);
    logInfo("→ Run: npx tsx scripts/initialize-baseline-scores.ts");
  } else {
    logSuccess("All tools have baseline scores");
  }

  console.log("");
  logInfo("→ Create a named snapshot: 'baseline-may-2025'");
  logInfo("→ Store current baseline scores as the May 2025 reference point");
  console.log("");

  // 2. Article separation
  log("2. SEPARATE BASELINE vs DELTA ARTICLES", colors.bright + colors.cyan);
  logInfo(`Articles May 2025 or earlier: ${articleHistory.may2025OrEarlier}`);
  logInfo(`Articles June 2025 or later: ${articleHistory.june2025OrLater}`);
  console.log("");

  if (articleHistory.may2025OrEarlier > 0) {
    logWarning("Articles from May 2025 or earlier exist");
    logInfo("→ These should be incorporated into the baseline (not delta)");
  }

  if (articleHistory.june2025OrLater > 0) {
    logInfo("→ Articles from June 2025+ remain as delta modifications");
  }

  console.log("");

  // 3. Data quality issues
  log("3. DATA QUALITY CHECKS", colors.bright + colors.cyan);

  if (articleHistory.articlesWithoutDate > 0) {
    logWarning(`${articleHistory.articlesWithoutDate} articles missing published dates`);
    logInfo("→ Review and assign dates or use ingestion date as fallback");
  }

  if (toolScores.toolsWithDelta > 0) {
    logInfo(`${toolScores.toolsWithDelta} tools have delta scores applied`);
    logInfo("→ Review if these deltas should be incorporated into May baseline");
  }

  console.log("");

  // 4. Implementation approach
  log("4. IMPLEMENTATION APPROACH", colors.bright + colors.cyan);
  console.log("");
  log("Option A: Reset and Rebuild (Recommended)", colors.yellow);
  logInfo("1. Create 'baseline-may-2025' snapshot of current baseline scores");
  logInfo("2. Identify articles published before June 2025");
  logInfo("3. Recalculate baseline by applying those article impacts");
  logInfo("4. Reset delta scores to empty {}");
  logInfo("5. Re-apply articles from June 2025+ as delta modifications");
  console.log("");

  log("Option B: Incremental Adjustment", colors.yellow);
  logInfo("1. Create 'baseline-may-2025' snapshot using current baseline + delta");
  logInfo("2. Mark current state as the May 2025 baseline");
  logInfo("3. Reset delta scores to empty {}");
  logInfo("4. Future articles add delta modifications");
  console.log("");

  // 5. Next steps
  log("5. IMMEDIATE NEXT STEPS", colors.bright + colors.cyan);
  console.log("");
  logInfo("Step 1: Verify ranking_versions table exists");
  logInfo("Step 2: Create script to snapshot current state as 'baseline-may-2025'");
  logInfo("Step 3: Decide on Option A vs Option B approach");
  logInfo("Step 4: Implement snapshot creation with version tracking");
  logInfo("Step 5: Document baseline methodology for future reference");
  console.log("");

  // 6. Data summary
  log("6. SUMMARY STATISTICS", colors.bright + colors.cyan);
  console.log("");
  logInfo(`Total Tools: ${toolScores.totalTools}`);
  logInfo(`Total Articles: ${articleHistory.totalArticles}`);
  logInfo(`Date Range: ${articleHistory.dateRange.earliest?.toISOString().split('T')[0] || 'N/A'} to ${articleHistory.dateRange.latest?.toISOString().split('T')[0] || 'N/A'}`);
  logInfo(`Baseline Score Range: ${toolScores.scoreRanges.baseline.min.toFixed(2)} - ${toolScores.scoreRanges.baseline.max.toFixed(2)}`);
  console.log("");
}

async function main() {
  console.log("");
  log("🔍 BASELINE STATE ANALYSIS FOR MAY 2025 SNAPSHOT", colors.bright + colors.magenta);
  log(`${"=".repeat(80)}`, colors.magenta);
  console.log("");

  try {
    // Test connection first
    logSection("Database Connection");
    const connected = await testConnection();

    if (!connected) {
      logError("Cannot connect to database");
      logInfo("Please check your DATABASE_URL in .env.local");
      process.exit(1);
    }

    logSuccess("Database connected");

    // Analyze tool scores
    const toolScores = await analyzeToolScores();

    // Analyze article history
    const articleHistory = await analyzeArticleHistory();

    // Check baseline infrastructure
    await checkBaselineInfrastructure();

    // Generate recommendations
    generateRecommendations(toolScores, articleHistory);

    logSection("Analysis Complete");
    logSuccess("Review the recommendations above to proceed with baseline creation");

  } catch (error) {
    logError(`Analysis failed: ${error}`);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

// Execute
main().catch(error => {
  logError(`Fatal error: ${error}`);
  process.exit(1);
});
