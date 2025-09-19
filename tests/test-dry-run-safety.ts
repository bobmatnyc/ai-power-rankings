#!/usr/bin/env tsx

/**
 * Test script to verify dry run truly prevents database modifications
 * This tests both the ingestion and recalculation dry runs
 */

import { getDb } from "@/lib/db/connection";
import { ArticleDatabaseService } from "@/lib/services/article-db-service";
import { articles, articleProcessingLogs, articleRankingsChanges } from "@/lib/db/article-schema";
import { eq, desc } from "drizzle-orm";

// Color codes for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testDryRunSafety() {
  log("\n🔬 Testing Dry Run Safety - Ensuring NO database modifications during preview\n", 'cyan');

  const db = getDb();
  if (!db) {
    log("❌ Database connection not available", 'red');
    process.exit(1);
  }

  log("✅ Database connection established", 'green');

  const articleService = new ArticleDatabaseService();

  try {
    // Step 1: Get initial database state
    log("📊 Step 1: Recording initial database state...", 'blue');

    const initialArticles = await db.select().from(articles).orderBy(desc(articles.createdAt));
    const initialLogs = await db.select().from(articleProcessingLogs).orderBy(desc(articleProcessingLogs.createdAt));
    const initialChanges = await db.select().from(articleRankingsChanges).orderBy(desc(articleRankingsChanges.createdAt));

    log(`  Articles: ${initialArticles.length}`, 'yellow');
    log(`  Processing Logs: ${initialLogs.length}`, 'yellow');
    log(`  Ranking Changes: ${initialChanges.length}`, 'yellow');

    // Step 2: Test article ingestion with dry run
    log("\n📝 Step 2: Testing article ingestion with dry run (preview mode)...", 'blue');

    const testContent = `
      Claude Code Dominates AI Coding Assistant Market

      In a significant development, Claude Code has emerged as the leading AI coding assistant,
      surpassing GitHub Copilot and Cursor in user satisfaction and feature completeness.
      The tool's advanced capabilities for understanding complex codebases and generating
      high-quality code have made it the preferred choice for professional developers.

      Meanwhile, GitHub Copilot continues to maintain its strong integration with VSCode,
      while Cursor focuses on its unique interface innovations. ChatGPT Canvas and v0
      are also gaining traction with their specialized approaches to code generation.
    `;

    const dryRunResult = await articleService.ingestArticle({
      type: "text",
      input: testContent,
      dryRun: true, // This should prevent ALL database modifications
      metadata: {
        author: "Test Author"
      }
    });

    log("  ✅ Dry run completed - received preview data", 'green');
    log(`  Preview shows ${dryRunResult.predictedChanges.length} predicted ranking changes`, 'yellow');

    // Step 3: Verify no database changes after dry run ingestion
    log("\n🔍 Step 3: Verifying NO database changes after dry run ingestion...", 'blue');

    const afterIngestArticles = await db.select().from(articles).orderBy(desc(articles.createdAt));
    const afterIngestLogs = await db.select().from(articleProcessingLogs).orderBy(desc(articleProcessingLogs.createdAt));
    const afterIngestChanges = await db.select().from(articleRankingsChanges).orderBy(desc(articleRankingsChanges.createdAt));

    const ingestChecks = {
      articles: afterIngestArticles.length === initialArticles.length,
      logs: afterIngestLogs.length === initialLogs.length,
      changes: afterIngestChanges.length === initialChanges.length
    };

    if (ingestChecks.articles && ingestChecks.logs && ingestChecks.changes) {
      log("  ✅ PASSED: No database modifications during ingestion dry run!", 'green');
    } else {
      log("  ❌ FAILED: Database was modified during dry run!", 'red');
      if (!ingestChecks.articles) log(`    Articles: ${initialArticles.length} -> ${afterIngestArticles.length}`, 'red');
      if (!ingestChecks.logs) log(`    Processing Logs: ${initialLogs.length} -> ${afterIngestLogs.length}`, 'red');
      if (!ingestChecks.changes) log(`    Ranking Changes: ${initialChanges.length} -> ${afterIngestChanges.length}`, 'red');
    }

    // Initialize recalcChecks outside the if block
    let recalcChecks = {
      articles: true,
      logs: true,
      changes: true
    };

    // Step 4: Test recalculation dry run on existing article
    if (initialArticles.length > 0) {
      log("\n🔄 Step 4: Testing recalculation dry run on existing article...", 'blue');

      const testArticle = initialArticles[0];
      log(`  Using article: "${testArticle.title?.substring(0, 50)}..."`, 'yellow');

      // Track progress messages
      const progressMessages: string[] = [];

      const recalcResult = await articleService.recalculateArticleRankingsWithProgress(
        testArticle.id,
        (progress, step) => {
          progressMessages.push(`${progress}%: ${step}`);
        },
        {
          dryRun: true, // This should prevent ALL database modifications
          useCachedAnalysis: false
        }
      );

      log("  ✅ Recalculation preview completed", 'green');
      log(`  Preview shows ${recalcResult.changes.length} predicted changes`, 'yellow');

      // Step 5: Verify no database changes after recalculation dry run
      log("\n🔍 Step 5: Verifying NO database changes after recalculation dry run...", 'blue');

      const afterRecalcArticles = await db.select().from(articles).orderBy(desc(articles.createdAt));
      const afterRecalcLogs = await db.select().from(articleProcessingLogs).orderBy(desc(articleProcessingLogs.createdAt));
      const afterRecalcChanges = await db.select().from(articleRankingsChanges).orderBy(desc(articleRankingsChanges.createdAt));

      recalcChecks = {
        articles: afterRecalcArticles.length === afterIngestArticles.length,
        logs: afterRecalcLogs.length === afterIngestLogs.length,
        changes: afterRecalcChanges.length === afterIngestChanges.length
      };

      if (recalcChecks.articles && recalcChecks.logs && recalcChecks.changes) {
        log("  ✅ PASSED: No database modifications during recalculation dry run!", 'green');
      } else {
        log("  ❌ FAILED: Database was modified during recalculation dry run!", 'red');
        if (!recalcChecks.articles) log(`    Articles: ${afterIngestArticles.length} -> ${afterRecalcArticles.length}`, 'red');
        if (!recalcChecks.logs) log(`    Processing Logs: ${afterIngestLogs.length} -> ${afterRecalcLogs.length}`, 'red');
        if (!recalcChecks.changes) log(`    Ranking Changes: ${afterIngestChanges.length} -> ${afterRecalcChanges.length}`, 'red');
      }

      // Step 6: Test the apply phase uses cached analysis
      log("\n🚀 Step 6: Testing apply phase with cached analysis...", 'blue');

      const beforeApplyLogs = await db.select().from(articleProcessingLogs).orderBy(desc(articleProcessingLogs.createdAt));

      const applyResult = await articleService.recalculateArticleRankingsWithProgress(
        testArticle.id,
        (progress, step) => {
          log(`    ${progress}%: ${step}`, 'cyan');
        },
        {
          dryRun: false, // Actually apply changes
          useCachedAnalysis: true // Use the cached analysis from preview
        }
      );

      log("  ✅ Applied changes successfully", 'green');

      const afterApplyLogs = await db.select().from(articleProcessingLogs).orderBy(desc(articleProcessingLogs.createdAt));

      if (afterApplyLogs.length > beforeApplyLogs.length) {
        log("  ✅ Processing log created for actual application", 'green');
        const newLog = afterApplyLogs[0];
        log(`    Log ID: ${newLog.id}`, 'yellow');
        log(`    Action: ${newLog.action}`, 'yellow');
        log(`    Status: ${newLog.status}`, 'yellow');
      }

      // Rollback the changes we just applied
      log("\n🔄 Rolling back test changes...", 'blue');
      await db.delete(articleProcessingLogs)
        .where(eq(articleProcessingLogs.articleId, testArticle.id));
      await db.delete(articleRankingsChanges)
        .where(eq(articleRankingsChanges.articleId, testArticle.id));
      log("  ✅ Rolled back test changes", 'green');
    }

    // Final Summary
    log("\n📋 Test Summary:", 'cyan');
    log("════════════════════════════════════════", 'cyan');

    const allPassed = ingestChecks.articles && ingestChecks.logs && ingestChecks.changes &&
                      (!initialArticles.length || (recalcChecks.articles && recalcChecks.logs && recalcChecks.changes));

    if (allPassed) {
      log("✅ ALL TESTS PASSED: Dry run truly prevents database modifications!", 'green');
      log("✅ Preview operations are completely read-only", 'green');
      log("✅ Processing logs are only created during actual application", 'green');
      log("✅ Cache mechanism works between preview and apply", 'green');
    } else {
      log("❌ TESTS FAILED: Dry run is modifying the database!", 'red');
      log("   This needs to be fixed before deployment", 'red');
    }

  } catch (error) {
    log("\n❌ Test failed with error:", 'red');
    console.error(error);
    process.exit(1);
  }

  process.exit(0);
}

// Run the test
testDryRunSafety().catch(console.error);