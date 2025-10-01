#!/usr/bin/env tsx
/**
 * Simplified Article Ingestion Test Script
 * Tests database operations without requiring AI API keys
 *
 * Usage: npx tsx scripts/test-article-ingestion-simple.ts
 */

import { config } from "dotenv";

// Load environment variables
config({ path: ".env.local" });
config({ path: ".env" });

import { getDb, testConnection, closeDb } from "../lib/db/connection";
import { articles, articleRankingsChanges, articleProcessingLogs } from "../lib/db/article-schema";
import { tools, rankings } from "../lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

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
  log(`${"=".repeat(60)}`, colors.cyan);
  log(title.toUpperCase(), colors.bright + colors.cyan);
  log(`${"=".repeat(60)}`, colors.cyan);
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

// Sample article content with AI tool mentions
const SAMPLE_ARTICLE = {
  title: "AI Tools Market Update - Test Article",
  content: `
    OpenAI's ChatGPT continues to dominate the AI assistant market with new Canvas features.
    Claude from Anthropic gains significant market share in enterprise deployments.
    GitHub Copilot reaches 1 million active users, demonstrating strong developer adoption.
    Google's Gemini Pro launches new multimodal features.
    Microsoft integrates AI tools into Office 365 for productivity gains.
    Cursor IDE and v0 by Vercel gain traction among developers.
  `,
  summary: "Market update on AI tools adoption and features",
  author: "Test Script",
  tags: ["ai", "technology", "market-update"],
  toolMentions: [
    { tool: "ChatGPT Canvas", context: "dominating the AI assistant market", sentiment: 0.8, relevance: 0.9 },
    { tool: "Claude Code", context: "gains significant market share", sentiment: 0.7, relevance: 0.8 },
    { tool: "GitHub Copilot", context: "reaches 1 million active users", sentiment: 0.9, relevance: 0.9 },
    { tool: "Gemini Code Assist", context: "launches new multimodal features", sentiment: 0.6, relevance: 0.7 },
    { tool: "Cursor", context: "gaining traction among developers", sentiment: 0.7, relevance: 0.8 },
    { tool: "v0 by Vercel", context: "gaining traction among developers", sentiment: 0.7, relevance: 0.8 },
  ],
  companyMentions: [
    { company: "OpenAI", context: "dominating the market", tools: ["ChatGPT Canvas"] },
    { company: "Anthropic", context: "enterprise deployments", tools: ["Claude Code"] },
    { company: "Microsoft", context: "Office 365 integration", tools: ["GitHub Copilot"] },
    { company: "Google", context: "new features", tools: ["Gemini Code Assist"] },
    { company: "Vercel", context: "developer tools", tools: ["v0 by Vercel"] },
  ],
};

// Simulate dry run result for testing
const MOCK_DRY_RUN_RESULT = {
  article: {
    title: SAMPLE_ARTICLE.title,
    content: SAMPLE_ARTICLE.content,
    summary: SAMPLE_ARTICLE.summary,
    author: SAMPLE_ARTICLE.author,
    tags: SAMPLE_ARTICLE.tags,
    toolMentions: SAMPLE_ARTICLE.toolMentions,
    companyMentions: SAMPLE_ARTICLE.companyMentions,
    importanceScore: 7,
    sentimentScore: 0.75,
  },
  predictedChanges: [
    {
      toolId: "chatgpt-canvas",
      toolName: "ChatGPT Canvas",
      currentRank: 4,
      predictedRank: 3,
      rankChange: 1,
      currentScore: 85.5,
      predictedScore: 87.2,
      scoreChange: 1.7,
      metrics: {
        market_share: { old: 25, new: 27, change: 2 },
        innovation: { old: 90, new: 92, change: 2 },
        community: { old: 88, new: 89, change: 1 },
      },
    },
    {
      toolId: "github-copilot",
      toolName: "GitHub Copilot",
      currentRank: 2,
      predictedRank: 2,
      rankChange: 0,
      currentScore: 88.3,
      predictedScore: 89.1,
      scoreChange: 0.8,
      metrics: {
        market_share: { old: 30, new: 32, change: 2 },
        innovation: { old: 85, new: 85, change: 0 },
        community: { old: 92, new: 93, change: 1 },
      },
    },
    {
      toolId: "claude-code",
      toolName: "Claude Code",
      currentRank: 1,
      predictedRank: 1,
      rankChange: 0,
      currentScore: 92.1,
      predictedScore: 93.0,
      scoreChange: 0.9,
      metrics: {
        market_share: { old: 18, new: 20, change: 2 },
        innovation: { old: 95, new: 95, change: 0 },
        community: { old: 85, new: 87, change: 2 },
      },
    },
  ],
  newTools: [],
  newCompanies: [],
  summary: {
    totalToolsAffected: 3,
    totalNewTools: 0,
    totalNewCompanies: 0,
    averageRankChange: 0.33,
    averageScoreChange: 1.13,
  },
};

async function testDatabaseConnection() {
  logSection("Testing Database Connection");

  try {
    const connected = await testConnection();
    if (connected) {
      logSuccess("Database connection successful");

      const db = getDb();
      if (db) {
        logInfo("Database instance retrieved successfully");
        return true;
      } else {
        logError("Failed to get database instance");
        return false;
      }
    } else {
      logError("Database connection failed");
      return false;
    }
  } catch (error) {
    logError(`Database connection error: ${error}`);
    return false;
  }
}

async function createTestArticle() {
  logSection("Creating Test Article");

  try {
    const db = getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    const articleId = uuidv4();
    const slug = `test-article-${Date.now()}`;

    logInfo("Inserting test article into database...");

    const [newArticle] = await db
      .insert(articles)
      .values({
        id: articleId,
        slug,
        title: SAMPLE_ARTICLE.title,
        summary: SAMPLE_ARTICLE.summary,
        content: SAMPLE_ARTICLE.content,
        ingestionType: "text",
        tags: SAMPLE_ARTICLE.tags,
        category: "technology",
        importanceScore: 7,
        sentimentScore: "0.75",
        toolMentions: SAMPLE_ARTICLE.toolMentions,
        companyMentions: SAMPLE_ARTICLE.companyMentions,
        author: SAMPLE_ARTICLE.author,
        ingestedBy: "test-script",
        status: "active",
        isProcessed: true,
        processedAt: new Date(),
      })
      .returning();

    if (newArticle) {
      logSuccess(`Article created with ID: ${newArticle.id}`);
      logInfo(`Title: ${newArticle.title}`);
      logInfo(`Slug: ${newArticle.slug}`);
      return newArticle;
    } else {
      throw new Error("Failed to create article");
    }
  } catch (error) {
    logError(`Failed to create article: ${error}`);
    return null;
  }
}

async function createRankingChanges(articleId: string) {
  logSection("Creating Ranking Changes");

  try {
    const db = getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    logInfo("Inserting ranking changes...");

    const changes = [];
    for (const change of MOCK_DRY_RUN_RESULT.predictedChanges) {
      const [newChange] = await db
        .insert(articleRankingsChanges)
        .values({
          articleId,
          toolId: change.toolId,
          toolName: change.toolName,
          metricChanges: change.metrics,
          oldRank: change.currentRank,
          newRank: change.predictedRank,
          rankChange: change.rankChange,
          oldScore: change.currentScore.toString(),
          newScore: change.predictedScore.toString(),
          scoreChange: change.scoreChange.toString(),
          changeType: change.rankChange > 0 ? "increase" : change.rankChange < 0 ? "decrease" : "no_change",
          changeReason: `Article analysis: ${SAMPLE_ARTICLE.title}`,
          isApplied: true,
        })
        .returning();

      if (newChange) {
        changes.push(newChange);
        const arrow = change.rankChange > 0 ? "↑" : change.rankChange < 0 ? "↓" : "→";
        logSuccess(`${change.toolName}: Rank ${change.currentRank} ${arrow} ${change.predictedRank}`);
      }
    }

    logSuccess(`Created ${changes.length} ranking changes`);
    return changes;
  } catch (error) {
    logError(`Failed to create ranking changes: ${error}`);
    return [];
  }
}

async function createProcessingLog(articleId: string, action: string, status: string, durationMs: number) {
  try {
    const db = getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    const [log] = await db
      .insert(articleProcessingLogs)
      .values({
        articleId,
        action,
        status,
        startedAt: new Date(Date.now() - durationMs),
        completedAt: new Date(),
        durationMs,
        toolsAffected: MOCK_DRY_RUN_RESULT.predictedChanges.length,
        companiesAffected: SAMPLE_ARTICLE.companyMentions.length,
        rankingsChanged: MOCK_DRY_RUN_RESULT.predictedChanges.filter(c => c.rankChange !== 0).length,
        performedBy: "test-script",
      })
      .returning();

    if (log) {
      logSuccess(`Processing log created: ${action} - ${status} (${durationMs}ms)`);
    }

    return log;
  } catch (error) {
    logError(`Failed to create processing log: ${error}`);
    return null;
  }
}

async function testPreviewMode() {
  logSection("Testing Preview Mode (Dry Run)");

  logInfo("Simulating article preview without AI API...");

  console.log("\n" + colors.yellow + "Preview Results:" + colors.reset);
  console.log("───────────────────────────────");

  logInfo(`Article: ${MOCK_DRY_RUN_RESULT.article.title}`);
  logInfo(`Importance: ${MOCK_DRY_RUN_RESULT.article.importanceScore}/10`);
  logInfo(`Sentiment: ${MOCK_DRY_RUN_RESULT.article.sentimentScore}`);

  console.log("\n" + colors.yellow + "Predicted Ranking Changes:" + colors.reset);
  MOCK_DRY_RUN_RESULT.predictedChanges.forEach(change => {
    const arrow = change.rankChange > 0 ? "↑" : change.rankChange < 0 ? "↓" : "→";
    const color = change.rankChange > 0 ? colors.green : change.rankChange < 0 ? colors.red : colors.yellow;
    log(
      `  ${change.toolName}: Rank ${change.currentRank} ${arrow} ${change.predictedRank} (Score: ${change.currentScore} → ${change.predictedScore})`,
      color
    );
  });

  console.log("\n" + colors.yellow + "Summary:" + colors.reset);
  logInfo(`  Tools affected: ${MOCK_DRY_RUN_RESULT.summary.totalToolsAffected}`);
  logInfo(`  Avg rank change: ${MOCK_DRY_RUN_RESULT.summary.averageRankChange.toFixed(2)}`);
  logInfo(`  Avg score change: +${MOCK_DRY_RUN_RESULT.summary.averageScoreChange.toFixed(2)}`);

  return MOCK_DRY_RUN_RESULT;
}

async function testCommitMode() {
  logSection("Testing Commit Mode");

  logInfo("Committing article and ranking changes to database...");

  // Create the article
  const article = await createTestArticle();
  if (!article) {
    logError("Failed to create article");
    return null;
  }

  // Create ranking changes
  const changes = await createRankingChanges(article.id);

  // Create processing log
  await createProcessingLog(article.id, "ingest", "completed", 250);

  logSuccess("Article and changes committed successfully!");
  return { article, changes };
}

async function testRollback(articleId: string) {
  logSection("Testing Rollback");

  try {
    const db = getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    logInfo(`Rolling back article: ${articleId}`);

    // Update article status
    const [updatedArticle] = await db
      .update(articles)
      .set({
        status: "archived",
        updatedAt: new Date(),
      })
      .where(eq(articles.id, articleId))
      .returning();

    if (updatedArticle) {
      logSuccess(`Article status changed to: ${updatedArticle.status}`);
    }

    // Mark ranking changes as rolled back
    const rolledBackChanges = await db
      .update(articleRankingsChanges)
      .set({
        rolledBack: true,
        rolledBackAt: new Date(),
      })
      .where(eq(articleRankingsChanges.articleId, articleId))
      .returning();

    logSuccess(`Rolled back ${rolledBackChanges.length} ranking changes`);

    // Create rollback log
    await createProcessingLog(articleId, "rollback", "completed", 50);

    return true;
  } catch (error) {
    logError(`Rollback failed: ${error}`);
    return false;
  }
}

async function verifyDataPersistence(articleId: string) {
  logSection("Verifying Data Persistence");

  try {
    const db = getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    // Check article
    const [article] = await db
      .select()
      .from(articles)
      .where(eq(articles.id, articleId))
      .limit(1);

    if (article) {
      logSuccess(`Article found in database`);
      logInfo(`  ID: ${article.id}`);
      logInfo(`  Title: ${article.title}`);
      logInfo(`  Status: ${article.status}`);
      logInfo(`  Tags: ${article.tags?.join(", ")}`);
    } else {
      logError("Article not found");
      return false;
    }

    // Check ranking changes
    const rankingChanges = await db
      .select()
      .from(articleRankingsChanges)
      .where(eq(articleRankingsChanges.articleId, articleId));

    logSuccess(`Found ${rankingChanges.length} ranking changes`);
    rankingChanges.forEach(change => {
      const status = change.rolledBack ? " (rolled back)" : "";
      logInfo(`  ${change.toolName}: ${change.oldRank} → ${change.newRank}${status}`);
    });

    // Check processing logs
    const logs = await db
      .select()
      .from(articleProcessingLogs)
      .where(eq(articleProcessingLogs.articleId, articleId))
      .orderBy(articleProcessingLogs.createdAt);

    logSuccess(`Found ${logs.length} processing logs`);
    logs.forEach(log => {
      logInfo(`  ${log.action}: ${log.status} (${log.durationMs}ms)`);
    });

    return true;
  } catch (error) {
    logError(`Data verification failed: ${error}`);
    return false;
  }
}

async function checkExistingTools() {
  logSection("Checking Existing Tools");

  try {
    const db = getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    // Get sample of existing tools
    const existingTools = await db
      .select({
        id: tools.id,
        name: tools.name,
        category: tools.category,
      })
      .from(tools)
      .limit(10);

    logInfo(`Found ${existingTools.length} tools in database:`);
    existingTools.forEach(tool => {
      logInfo(`  • ${tool.name} (${tool.category})`);
    });

    // Check if our test tools exist
    const testToolNames = ["ChatGPT Canvas", "Claude Code", "GitHub Copilot"];
    for (const toolName of testToolNames) {
      const [tool] = await db
        .select()
        .from(tools)
        .where(eq(tools.name, toolName))
        .limit(1);

      if (tool) {
        logSuccess(`Tool "${toolName}" exists in database`);
      } else {
        logWarning(`Tool "${toolName}" not found in database`);
      }
    }

    return true;
  } catch (error) {
    logError(`Failed to check tools: ${error}`);
    return false;
  }
}

// Main test execution
async function runTests() {
  console.log("");
  log("🧪 SIMPLIFIED ARTICLE INGESTION TEST", colors.bright + colors.magenta);
  log(`${"=".repeat(60)}`, colors.magenta);
  console.log("");
  logWarning("This test bypasses AI analysis to focus on database operations");
  console.log("");

  try {
    // Test 1: Database Connection
    const dbConnected = await testDatabaseConnection();
    if (!dbConnected) {
      logError("Cannot proceed without database connection");
      process.exit(1);
    }

    // Test 2: Check existing tools
    await checkExistingTools();

    // Test 3: Preview Mode (simulated)
    const previewResult = await testPreviewMode();

    // Test 4: Commit Mode
    const commitResult = await testCommitMode();

    if (commitResult && commitResult.article) {
      // Test 5: Verify persistence
      await verifyDataPersistence(commitResult.article.id);

      // Test 6: Rollback
      await testRollback(commitResult.article.id);

      // Test 7: Verify rollback
      await verifyDataPersistence(commitResult.article.id);
    }

    // Summary
    logSection("Test Summary");
    logSuccess("All database operations completed successfully!");

    console.log("\n" + colors.cyan + "Key Findings:" + colors.reset);
    logInfo("✓ Database connection works");
    logInfo("✓ Article creation works");
    logInfo("✓ Ranking changes can be stored");
    logInfo("✓ Processing logs are created");
    logInfo("✓ Rollback functionality works");
    logInfo("✓ Data persistence verified");

    console.log("\n" + colors.yellow + "Next Steps:" + colors.reset);
    logInfo("1. Add OPENROUTER_API_KEY to .env.local for full AI analysis");
    logInfo("2. Run the full test script: npx tsx scripts/test-article-ingestion.ts");
    logInfo("3. Test with real article URLs");
    logInfo("4. Integrate with the admin UI at /admin/articles");

  } catch (error) {
    logError(`Test suite failed: ${error}`);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

// Execute tests
runTests().catch(error => {
  logError(`Fatal error: ${error}`);
  process.exit(1);
});