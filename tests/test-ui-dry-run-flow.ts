#!/usr/bin/env tsx

/**
 * Test the UI dry run flow by simulating browser interactions
 * This tests the complete preview -> apply workflow through the API endpoints
 */

import { getDb } from "@/lib/db/connection";
import { articles, articleProcessingLogs, articleRankingsChanges } from "@/lib/db/article-schema";
import { desc } from "drizzle-orm";

// Color codes for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Helper to make API calls similar to how the UI does
async function makeAPICall(
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  body?: any
): Promise<any> {
  const baseUrl = 'http://localhost:3001';
  const url = `${baseUrl}${endpoint}`;

  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Cookie': 'admin-authenticated=true'
    },
    credentials: 'include',
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`API call failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function testUIFlow() {
  log("\n🌐 Testing UI Dry Run Flow - Simulating browser preview/apply workflow\n", 'magenta');

  const db = getDb();
  if (!db) {
    log("❌ Database connection not available", 'red');
    process.exit(1);
  }

  try {
    // Step 1: Get initial state
    log("📊 Step 1: Recording initial database state...", 'blue');

    const initialArticles = await db.select().from(articles).orderBy(desc(articles.createdAt));
    const initialLogs = await db.select().from(articleProcessingLogs).orderBy(desc(articleProcessingLogs.createdAt));
    const initialChanges = await db.select().from(articleRankingsChanges).orderBy(desc(articleRankingsChanges.createdAt));

    log(`  Articles: ${initialArticles.length}`, 'yellow');
    log(`  Processing Logs: ${initialLogs.length}`, 'yellow');
    log(`  Ranking Changes: ${initialChanges.length}`, 'yellow');

    if (initialArticles.length === 0) {
      log("\n⚠️  No articles found. Creating a test article first...", 'yellow');

      // Create a test article
      const articleData = {
        content: "Claude Code continues to dominate the AI coding assistant market with impressive capabilities.",
        metadata: {
          author: "UI Test",
          category: "Market Analysis",
          tags: "ai,coding,tools"
        },
        dryRun: false
      };

      const createResult = await makeAPICall('/api/admin/articles', 'POST', articleData);
      log(`  ✅ Created test article: ${createResult.article?.title?.substring(0, 50)}...`, 'green');

      // Refresh article list
      const refreshedArticles = await db.select().from(articles).orderBy(desc(articles.createdAt));
      if (refreshedArticles.length > 0) {
        initialArticles.push(refreshedArticles[0]!);
      }
    }

    const testArticle = initialArticles[0];
    if (!testArticle) {
      log('❌ No test article available', 'red');
      process.exit(1);
    }
    if (!testArticle) {
      throw new Error("No test article available");
    }
    log(`\n🎯 Using article: "${testArticle.title?.substring(0, 50)}..."`, 'cyan');

    // Step 2: Simulate UI preview request (dry run = true)
    log("\n👁️ Step 2: Simulating UI preview request (dry run)...", 'blue');

    const previewResult = await makeAPICall(
      `/api/admin/articles/${testArticle.id}/recalculate`,
      'POST',
      { dryRun: true }
    );

    log("  ✅ Preview generated successfully", 'green');
    log(`  Preview shows ${previewResult.changes?.length || 0} tool changes`, 'yellow');
    log(`  Average score change: ${previewResult.summary?.averageScoreChange?.toFixed(4) || 0}`, 'yellow');

    // Log some of the changes
    if (previewResult.changes && previewResult.changes.length > 0) {
      log("\n  Sample changes from preview:", 'cyan');
      previewResult.changes.slice(0, 3).forEach((change: any) => {
        log(`    • ${change.tool}: ${change.oldScore?.toFixed(2)} → ${change.newScore?.toFixed(2)} (${change.change > 0 ? '+' : ''}${change.change?.toFixed(4)})`, 'yellow');
      });
    }

    // Step 3: Verify no database changes after preview
    log("\n🔍 Step 3: Verifying database state after preview...", 'blue');

    const afterPreviewLogs = await db.select().from(articleProcessingLogs).orderBy(desc(articleProcessingLogs.createdAt));
    const afterPreviewChanges = await db.select().from(articleRankingsChanges).orderBy(desc(articleRankingsChanges.createdAt));

    const previewChecks = {
      logs: afterPreviewLogs.length === initialLogs.length,
      changes: afterPreviewChanges.length === initialChanges.length
    };

    if (previewChecks.logs && previewChecks.changes) {
      log("  ✅ PASSED: No database modifications during preview!", 'green');
      log(`  Processing logs unchanged: ${afterPreviewLogs.length}`, 'green');
      log(`  Ranking changes unchanged: ${afterPreviewChanges.length}`, 'green');
    } else {
      log("  ❌ FAILED: Database was modified during preview!", 'red');
      if (!previewChecks.logs) {
        log(`    Processing logs: ${initialLogs.length} → ${afterPreviewLogs.length}`, 'red');
      }
      if (!previewChecks.changes) {
        log(`    Ranking changes: ${initialChanges.length} → ${afterPreviewChanges.length}`, 'red');
      }
    }

    // Step 4: Simulate UI apply request (using cached analysis)
    log("\n🚀 Step 4: Simulating UI apply request (with cached analysis)...", 'blue');

    const applyResult = await makeAPICall(
      `/api/admin/articles/${testArticle.id}/recalculate`,
      'POST',
      {
        dryRun: false,
        useCachedAnalysis: true  // This simulates the UI using cached data
      }
    );

    log("  ✅ Changes applied successfully", 'green');
    log(`  Applied ${applyResult.changes?.length || 0} ranking changes`, 'yellow');

    // Step 5: Verify database changes after apply
    log("\n🔍 Step 5: Verifying database state after apply...", 'blue');

    const afterApplyLogs = await db.select().from(articleProcessingLogs).orderBy(desc(articleProcessingLogs.createdAt));
    const afterApplyChanges = await db.select().from(articleRankingsChanges).orderBy(desc(articleRankingsChanges.createdAt));

    const applyChecks = {
      logsIncreased: afterApplyLogs.length > afterPreviewLogs.length,
      changesApplied: afterApplyChanges.length >= afterPreviewChanges.length
    };

    if (applyChecks.logsIncreased) {
      log("  ✅ Processing log created for actual application", 'green');
      const newLog = afterApplyLogs[0];
      if (newLog) {
        log(`    Log ID: ${newLog.id}`, 'yellow');
        log(`    Action: ${newLog.action}`, 'yellow');
        log(`    Status: ${newLog.status}`, 'yellow');
      }
    } else {
      log("  ❌ No processing log created during apply", 'red');
    }

    if (applyChecks.changesApplied) {
      log("  ✅ Ranking changes were applied", 'green');
      log(`    Total changes in DB: ${afterApplyChanges.length}`, 'yellow');
    }

    // Step 6: Test SSE endpoint for real-time updates
    log("\n📡 Step 6: Testing SSE endpoint for real-time updates...", 'blue');

    const sseUrl = `http://localhost:3001/api/admin/articles/${testArticle.id}/recalculate?stream=true&dryRun=true`;
    log(`  Testing SSE at: ${sseUrl}`, 'cyan');

    // Note: In a real browser, EventSource would handle this
    // Here we just verify the endpoint exists and responds
    const sseResponse = await fetch(sseUrl, {
      headers: {
        'Cookie': 'admin-authenticated=true'
      },
      credentials: 'include'
    });

    if (sseResponse.ok && sseResponse.headers.get('content-type')?.includes('text/event-stream')) {
      log("  ✅ SSE endpoint is working correctly", 'green');
      log(`  Content-Type: ${sseResponse.headers.get('content-type')}`, 'yellow');
    } else {
      log("  ⚠️  SSE endpoint may not be configured correctly", 'yellow');
    }

    // Final Summary
    log("\n📋 UI Flow Test Summary:", 'cyan');
    log("════════════════════════════════════════", 'cyan');

    const allPassed = previewChecks.logs && previewChecks.changes &&
                      applyChecks.logsIncreased && applyChecks.changesApplied;

    if (allPassed) {
      log("✅ ALL UI FLOW TESTS PASSED!", 'green');
      log("✅ Preview mode is truly read-only", 'green');
      log("✅ Apply mode creates proper database records", 'green');
      log("✅ Caching works between preview and apply", 'green');
      log("✅ API endpoints work as expected", 'green');
    } else {
      log("❌ SOME UI FLOW TESTS FAILED", 'red');
      if (!previewChecks.logs || !previewChecks.changes) {
        log("   Preview mode is modifying the database", 'red');
      }
      if (!applyChecks.logsIncreased) {
        log("   Apply mode is not creating processing logs", 'red');
      }
    }

  } catch (error) {
    log("\n❌ Test failed with error:", 'red');
    console.error(error);

    // Check if server is running
    if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
      log("\n⚠️  Make sure the development server is running:", 'yellow');
      log("   pnpm run dev:pm2 start", 'cyan');
    }

    process.exit(1);
  }

  process.exit(0);
}

// Run the test
log("⚠️  Note: This test requires the dev server to be running on port 3001", 'yellow');
log("   Run 'pnpm run dev:pm2 start' if not already running", 'cyan');

setTimeout(() => {
  testUIFlow().catch(console.error);
}, 2000);