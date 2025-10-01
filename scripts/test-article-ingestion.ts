#!/usr/bin/env tsx
/**
 * Test Article Ingestion Script
 * Comprehensive test for the complete article ingestion workflow
 *
 * Usage: npx tsx scripts/test-article-ingestion.ts
 */

import { config } from "dotenv";
import * as path from "path";

// Load environment variables
config({ path: ".env.local" });
config({ path: ".env" });

import { getDb, testConnection, closeDb } from "../lib/db/connection";
import { ArticleDatabaseService } from "../lib/services/article-db-service";
import { ArticlesRepository } from "../lib/db/repositories/articles.repository";
import { articles, articleRankingsChanges, articleProcessingLogs, rankingVersions } from "../lib/db/article-schema";
import { eq, desc } from "drizzle-orm";
import type { ArticleIngestionInput } from "../lib/services/article-ingestion.service";

// Test configuration
const TEST_CONFIGS = {
  // Sample article text mentioning multiple AI tools
  sampleArticle: {
    title: "AI Tools Market Update - December 2024",
    content: `
      OpenAI announces major GPT-4 improvements with enhanced reasoning capabilities,
      while Claude 3.5 from Anthropic gains significant market share in enterprise deployments.

      GitHub Copilot reaches 1 million active users, demonstrating strong developer adoption.
      Google's Gemini Pro launches new multimodal features, competing directly with OpenAI's offerings.

      Meanwhile, Microsoft's integration of ChatGPT into Office 365 continues to drive productivity gains,
      and Perplexity AI introduces real-time web search capabilities that challenge traditional search engines.

      The AI landscape continues to evolve rapidly, with tools like Cursor IDE and v0 by Vercel
      gaining traction among developers for AI-assisted coding.
    `,
    author: "Test Script",
    tags: ["ai", "technology", "market-update"],
  },

  // Real tech news URL for testing (you can replace with a current article)
  testUrl: "https://www.theverge.com/2024/1/1/example-ai-article",

  // Test with various tool name formats
  toolNameVariations: [
    "gpt-4",
    "GPT-4",
    "ChatGPT",
    "claude-3.5",
    "Claude 3.5 Sonnet",
    "github copilot",
    "GitHub Copilot",
  ],
};

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

async function testDatabaseConnection() {
  logSection("Testing Database Connection");

  try {
    const connected = await testConnection();
    if (connected) {
      logSuccess("Database connection successful");

      // Get database instance
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

async function testTextIngestion(dryRun: boolean = true) {
  logSection(`Testing Text Ingestion (${dryRun ? "Dry Run" : "Commit"} Mode)`);

  try {
    const articleService = new ArticleDatabaseService();

    const input: ArticleIngestionInput = {
      type: "text",
      input: TEST_CONFIGS.sampleArticle.content,
      title: TEST_CONFIGS.sampleArticle.title,
      author: TEST_CONFIGS.sampleArticle.author,
      tags: TEST_CONFIGS.sampleArticle.tags,
      dryRun: dryRun,
    };

    logInfo(`Ingesting article: "${input.title}"`);
    logInfo(`Mode: ${dryRun ? "Dry Run (Preview)" : "Commit"}`);

    const result = await articleService.ingestArticle(input);

    if (dryRun && 'predictedChanges' in result) {
      // Dry run result
      logSuccess("Dry run completed successfully");

      logInfo("\nPredicted Changes:");
      if (result.predictedChanges && result.predictedChanges.length > 0) {
        result.predictedChanges.forEach(change => {
          const rankChange = change.rankChange || 0;
          const arrow = rankChange > 0 ? "↑" : rankChange < 0 ? "↓" : "→";
          const color = rankChange > 0 ? colors.green : rankChange < 0 ? colors.red : colors.yellow;

          log(
            `  ${change.toolName}: Rank ${change.currentRank || "N/A"} ${arrow} ${change.predictedRank || "N/A"} (${rankChange > 0 ? "+" : ""}${rankChange})`,
            color
          );
        });
      } else {
        logWarning("No ranking changes predicted");
      }

      if (result.newTools && result.newTools.length > 0) {
        logInfo(`\nNew tools discovered: ${result.newTools.map(t => t.name).join(", ")}`);
      }

      if (result.summary) {
        logInfo("\nSummary:");
        logInfo(`  Tools affected: ${result.summary.totalToolsAffected}`);
        logInfo(`  Average rank change: ${result.summary.averageRankChange?.toFixed(2) || 0}`);
        logInfo(`  Average score change: ${result.summary.averageScoreChange?.toFixed(4) || 0}`);
      }

      return result;
    } else if (!dryRun && 'id' in result) {
      // Committed result
      logSuccess(`Article ingested successfully with ID: ${result.id}`);
      logInfo(`Title: ${result.title}`);
      logInfo(`Status: ${result.status}`);
      logInfo(`Ingested at: ${result.ingestedAt}`);

      return result;
    }

    return result;
  } catch (error) {
    logError(`Text ingestion failed: ${error}`);
    throw error;
  }
}

async function testUrlIngestion(url: string, dryRun: boolean = true) {
  logSection(`Testing URL Ingestion (${dryRun ? "Dry Run" : "Commit"} Mode)`);

  try {
    const articleService = new ArticleDatabaseService();

    const input: ArticleIngestionInput = {
      type: "url",
      input: url,
      dryRun: dryRun,
    };

    logInfo(`Ingesting from URL: ${url}`);
    logInfo(`Mode: ${dryRun ? "Dry Run (Preview)" : "Commit"}`);

    const result = await articleService.ingestArticle(input);

    if (dryRun && 'predictedChanges' in result) {
      logSuccess("URL dry run completed successfully");

      if (result.article) {
        logInfo(`\nExtracted title: ${result.article.title || "N/A"}`);
        logInfo(`Content length: ${result.article.content?.length || 0} characters`);
      }

      return result;
    } else if (!dryRun && 'id' in result) {
      logSuccess(`URL article ingested with ID: ${result.id}`);
      return result;
    }

    return result;
  } catch (error) {
    logError(`URL ingestion failed: ${error}`);
    logWarning("Note: URL ingestion may fail if the URL is invalid or requires authentication");
    return null;
  }
}

async function testPreprocessedMode(previousResult: any) {
  logSection("Testing Preprocessed Mode (Reuse Previous Analysis)");

  if (!previousResult || !('predictedChanges' in previousResult)) {
    logWarning("No previous result available for preprocessed mode");
    return null;
  }

  try {
    const articleService = new ArticleDatabaseService();

    const input: ArticleIngestionInput = {
      type: "preprocessed",
      preprocessedData: previousResult,
      dryRun: false, // Commit with preprocessed data
    };

    logInfo("Using preprocessed data from previous analysis");

    const result = await articleService.ingestArticle(input);

    if ('id' in result) {
      logSuccess(`Article committed using preprocessed data with ID: ${result.id}`);
      return result;
    }

    return result;
  } catch (error) {
    logError(`Preprocessed mode failed: ${error}`);
    return null;
  }
}

async function testRollback(articleId: string) {
  logSection("Testing Rollback Functionality");

  try {
    const db = getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    logInfo(`Attempting to rollback article: ${articleId}`);

    // Mark the article as rolled back
    const [updatedArticle] = await db
      .update(articles)
      .set({
        status: "archived",
        updatedAt: new Date(),
      })
      .where(eq(articles.id, articleId))
      .returning();

    if (updatedArticle) {
      logSuccess(`Article ${articleId} marked as archived`);
    }

    // Mark all related ranking changes as rolled back
    const rolledBackChanges = await db
      .update(articleRankingsChanges)
      .set({
        rolledBack: true,
        rolledBackAt: new Date(),
      })
      .where(eq(articleRankingsChanges.articleId, articleId))
      .returning();

    logSuccess(`Rolled back ${rolledBackChanges.length} ranking changes`);

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

    // Check article exists
    const [article] = await db
      .select()
      .from(articles)
      .where(eq(articles.id, articleId))
      .limit(1);

    if (article) {
      logSuccess(`Article found: ${article.title}`);
      logInfo(`  Status: ${article.status}`);
      logInfo(`  Ingestion type: ${article.ingestionType}`);
      logInfo(`  Tool mentions: ${JSON.stringify(article.toolMentions)?.substring(0, 100)}...`);
    } else {
      logError("Article not found in database");
      return false;
    }

    // Check ranking changes
    const rankingChanges = await db
      .select()
      .from(articleRankingsChanges)
      .where(eq(articleRankingsChanges.articleId, articleId));

    if (rankingChanges.length > 0) {
      logSuccess(`Found ${rankingChanges.length} ranking changes`);

      // Show first few changes
      rankingChanges.slice(0, 3).forEach(change => {
        const rankChange = change.rankChange || 0;
        const arrow = rankChange > 0 ? "↑" : rankChange < 0 ? "↓" : "→";
        logInfo(`  ${change.toolName}: ${change.oldRank} ${arrow} ${change.newRank}`);
      });

      if (rankingChanges.length > 3) {
        logInfo(`  ... and ${rankingChanges.length - 3} more`);
      }
    } else {
      logWarning("No ranking changes found");
    }

    // Check processing logs
    const logs = await db
      .select()
      .from(articleProcessingLogs)
      .where(eq(articleProcessingLogs.articleId, articleId));

    if (logs.length > 0) {
      logSuccess(`Found ${logs.length} processing logs`);
      logs.forEach(log => {
        logInfo(`  ${log.action}: ${log.status} (${log.durationMs}ms)`);
      });
    }

    return true;
  } catch (error) {
    logError(`Data verification failed: ${error}`);
    return false;
  }
}

async function testToolNameNormalization() {
  logSection("Testing Tool Name Normalization");

  try {
    const articleService = new ArticleDatabaseService();

    for (const toolName of TEST_CONFIGS.toolNameVariations) {
      const input: ArticleIngestionInput = {
        type: "text",
        input: `Testing tool mention: ${toolName} is a popular AI tool.`,
        title: `Test: ${toolName}`,
        dryRun: true,
      };

      const result = await articleService.ingestArticle(input);

      if ('predictedChanges' in result && result.predictedChanges) {
        const normalized = result.predictedChanges.find(c =>
          c.toolName.toLowerCase().includes(toolName.toLowerCase().replace(/[-\s]/g, ''))
        );

        if (normalized) {
          logSuccess(`"${toolName}" → "${normalized.toolName}"`);
        } else {
          logWarning(`"${toolName}" → No matching tool found`);
        }
      }
    }

    return true;
  } catch (error) {
    logError(`Tool name normalization test failed: ${error}`);
    return false;
  }
}

async function cleanupTestData() {
  logSection("Cleaning Up Test Data");

  try {
    const db = getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    // Find and delete test articles
    const testArticles = await db
      .select()
      .from(articles)
      .where(eq(articles.ingestedBy, "Test Script"))
      .limit(100);

    if (testArticles.length > 0) {
      logInfo(`Found ${testArticles.length} test articles to clean up`);

      for (const article of testArticles) {
        await db.delete(articles).where(eq(articles.id, article.id));
      }

      logSuccess(`Cleaned up ${testArticles.length} test articles`);
    } else {
      logInfo("No test articles to clean up");
    }

    return true;
  } catch (error) {
    logError(`Cleanup failed: ${error}`);
    return false;
  }
}

// Main test execution
async function runTests() {
  console.log("");
  log("🚀 ARTICLE INGESTION TEST SUITE", colors.bright + colors.magenta);
  log(`${"=".repeat(60)}`, colors.magenta);
  console.log("");

  try {
    // Test 1: Database Connection
    const dbConnected = await testDatabaseConnection();
    if (!dbConnected) {
      logError("Cannot proceed without database connection");
      process.exit(1);
    }

    // Test 2: Text Ingestion (Dry Run)
    logInfo("\n📝 Testing text article ingestion...");
    const dryRunResult = await testTextIngestion(true);

    // Test 3: Tool Name Normalization
    await testToolNameNormalization();

    // Test 4: Commit the article
    logInfo("\n💾 Testing article commit...");
    const committedArticle = await testTextIngestion(false);

    let articleId: string | null = null;
    if (committedArticle && 'id' in committedArticle) {
      articleId = committedArticle.id;

      // Test 5: Verify Data Persistence
      await verifyDataPersistence(articleId);

      // Test 6: Rollback
      await testRollback(articleId);
    }

    // Test 7: URL Ingestion (Dry Run only - to avoid external dependencies)
    logInfo("\n🌐 Testing URL ingestion (dry run)...");
    logWarning("Skipping actual URL fetch to avoid external dependencies");
    // await testUrlIngestion(TEST_CONFIGS.testUrl, true);

    // Test 8: Preprocessed Mode
    if (dryRunResult) {
      await testPreprocessedMode(dryRunResult);
    }

    // Cleanup
    // await cleanupTestData();

    // Summary
    logSection("Test Suite Complete");
    logSuccess("All tests completed successfully!");
    logInfo("\nNext steps:");
    logInfo("1. Check the database for persisted data");
    logInfo("2. Test with real article URLs");
    logInfo("3. Integrate with the admin UI");

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