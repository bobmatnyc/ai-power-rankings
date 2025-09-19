#!/usr/bin/env tsx

/**
 * Specific Dry Run Scenario Test
 *
 * This script demonstrates a specific scenario to prove that preview operations
 * don't write to the database while apply operations do.
 */

import { getDb } from "@/lib/db/connection";
import { ArticleDatabaseService } from "@/lib/services/article-db-service";
import { articles, articleProcessingLogs, articleRankingsChanges, type DryRunResult, type Article } from "@/lib/db/article-schema";
import { sql } from "drizzle-orm";

async function getTableCounts() {
  const db = getDb();
  if (!db) throw new Error("Database not available");

  const [articlesCount] = await db.select({ count: sql<number>`count(*)` }).from(articles);
  const [logsCount] = await db.select({ count: sql<number>`count(*)` }).from(articleProcessingLogs);
  const [changesCount] = await db.select({ count: sql<number>`count(*)` }).from(articleRankingsChanges);

  return {
    articles: articlesCount?.count ?? 0,
    logs: logsCount?.count ?? 0,
    changes: changesCount?.count ?? 0
  };
}

async function main() {
  console.log("🧪 SPECIFIC DRY RUN SCENARIO TEST");
  console.log("=" .repeat(60));

  const articleService = new ArticleDatabaseService();

  const testContent = `
# Revolutionary AI Update: Advanced Coding Tools Transform Development

In a groundbreaking development, several AI coding tools have received major updates:

## Tool Improvements
- **Claude Code**: Enhanced multi-file editing capabilities with better context understanding
- **GitHub Copilot**: Improved code completion accuracy and faster response times
- **Cursor**: Added new AI-powered debugging features
- **Windsurf**: Released beta version with collaborative coding support
- **v0**: Enhanced component generation with better design patterns

## Impact Assessment
These updates represent significant advances in AI-assisted development, with tools showing:
- 40% improvement in code accuracy
- 60% faster development cycles
- Better integration with existing workflows

The tools are setting new standards for developer productivity and code quality.
  `.trim();

  console.log("\n📊 BEFORE ANY OPERATIONS:");
  const beforeCounts = await getTableCounts();
  console.log(`   Articles: ${beforeCounts.articles}`);
  console.log(`   Processing Logs: ${beforeCounts.logs}`);
  console.log(`   Ranking Changes: ${beforeCounts.changes}`);

  console.log("\n🔍 STEP 1: EXECUTING PREVIEW (DRY RUN)");
  console.log("-".repeat(40));

  const previewResult = await articleService.ingestArticle({
    type: "text",
    input: testContent,
    dryRun: true,
    metadata: {
      author: "Test Reporter",
      category: "AI News",
      tags: ["ai", "coding", "tools", "update"]
    }
  });

  console.log("\n📊 AFTER PREVIEW:");
  const afterPreviewCounts = await getTableCounts();
  console.log(`   Articles: ${afterPreviewCounts.articles} (${afterPreviewCounts.articles - beforeCounts.articles > 0 ? '+' : ''}${afterPreviewCounts.articles - beforeCounts.articles})`);
  console.log(`   Processing Logs: ${afterPreviewCounts.logs} (${afterPreviewCounts.logs - beforeCounts.logs > 0 ? '+' : ''}${afterPreviewCounts.logs - beforeCounts.logs})`);
  console.log(`   Ranking Changes: ${afterPreviewCounts.changes} (${afterPreviewCounts.changes - beforeCounts.changes > 0 ? '+' : ''}${afterPreviewCounts.changes - beforeCounts.changes})`);

  console.log("\n📋 PREVIEW RESULTS:");

  // Type guard to check if result is DryRunResult
  if ('predictedChanges' in previewResult && 'summary' in previewResult) {
    // It's a DryRunResult
    const dryRun = previewResult as DryRunResult;
    console.log(`   Article Title: ${dryRun.article?.title}`);
    console.log(`   Tools Affected: ${dryRun.summary?.totalToolsAffected || 0}`);
    console.log(`   New Tools: ${dryRun.summary?.totalNewTools || 0}`);
    console.log(`   Avg Score Change: ${dryRun.summary?.averageScoreChange?.toFixed(3) || '0.000'}`);

    if (dryRun.predictedChanges && Array.isArray(dryRun.predictedChanges)) {
      console.log("\n🎯 PREDICTED TOOL CHANGES:");
      dryRun.predictedChanges.forEach((change: any, index: number) => {
        console.log(`   ${index + 1}. ${change.toolName}: ${change.currentScore?.toFixed(2) || '0.00'} → ${change.predictedScore?.toFixed(2) || '0.00'} (${change.scoreChange > 0 ? '+' : ''}${change.scoreChange?.toFixed(3) || '0.000'})`);
      });
    }
  } else {
    // It's an Article (unexpected for preview)
    const article = previewResult as Article;
    console.log(`   Article Title: ${article.title}`);
    console.log(`   ERROR: Article was created instead of preview (unexpected)`);
  }

  // Verify preview didn't modify database
  const previewClean = (
    afterPreviewCounts.articles === beforeCounts.articles &&
    afterPreviewCounts.logs === beforeCounts.logs &&
    afterPreviewCounts.changes === beforeCounts.changes
  );

  console.log(`\n✅ PREVIEW DATABASE ISOLATION: ${previewClean ? 'VERIFIED' : '❌ FAILED'}`);

  console.log("\n💾 STEP 2: EXECUTING APPLY (USING CACHED DATA)");
  console.log("-".repeat(40));

  const startApplyTime = Date.now();
  const applyResult = await articleService.ingestArticle({
    type: "preprocessed",
    preprocessedData: previewResult,
    dryRun: false,
    metadata: {
      author: "Test Reporter",
      category: "AI News",
      tags: ["ai", "coding", "tools", "update"]
    }
  });
  const applyDuration = Date.now() - startApplyTime;

  console.log("\n📊 AFTER APPLY:");
  const afterApplyCounts = await getTableCounts();
  console.log(`   Articles: ${afterApplyCounts.articles} (${afterApplyCounts.articles - afterPreviewCounts.articles > 0 ? '+' : ''}${afterApplyCounts.articles - afterPreviewCounts.articles})`);
  console.log(`   Processing Logs: ${afterApplyCounts.logs} (${afterApplyCounts.logs - afterPreviewCounts.logs > 0 ? '+' : ''}${afterApplyCounts.logs - afterPreviewCounts.logs})`);
  console.log(`   Ranking Changes: ${afterApplyCounts.changes} (${afterApplyCounts.changes - afterPreviewCounts.changes > 0 ? '+' : ''}${afterApplyCounts.changes - afterPreviewCounts.changes})`);

  console.log("\n📋 APPLY RESULTS:");
  // Type guard for applyResult
  if ('id' in applyResult && 'title' in applyResult && !('predictedChanges' in applyResult)) {
    // It's an Article
    const article = applyResult as Article;
    console.log(`   Article ID: ${article.id}`);
    console.log(`   Article Title: ${article.title}`);
  } else {
    // It's a DryRunResult (unexpected for apply)
    console.log(`   ERROR: Got DryRunResult instead of Article (unexpected)`);
  }
  console.log(`   Apply Duration: ${applyDuration}ms`);
  console.log(`   Fast Apply (< 1s): ${applyDuration < 1000 ? 'YES' : 'NO'}`);

  // Verify apply modified database appropriately
  const applyWorked = (
    afterApplyCounts.articles > afterPreviewCounts.articles ||
    afterApplyCounts.logs > afterPreviewCounts.logs ||
    afterApplyCounts.changes > afterPreviewCounts.changes
  );

  console.log(`\n✅ APPLY DATABASE MODIFICATION: ${applyWorked ? 'VERIFIED' : '❌ FAILED'}`);

  console.log("\n🎯 FINAL VERIFICATION");
  console.log("-".repeat(40));
  console.log(`✅ Preview Isolation: ${previewClean ? 'PASS' : 'FAIL'}`);
  console.log(`✅ Apply Functionality: ${applyWorked ? 'PASS' : 'FAIL'}`);
  console.log(`✅ Cache Performance: ${applyDuration < 1000 ? 'PASS' : 'FAIL'} (${applyDuration}ms)`);

  const allTestsPassed = previewClean && applyWorked && applyDuration < 1000;
  console.log(`\n🏆 OVERALL RESULT: ${allTestsPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);

  console.log("\n📈 DATABASE CHANGE SUMMARY:");
  console.log(`   Articles: ${beforeCounts.articles} → ${afterApplyCounts.articles} (+${afterApplyCounts.articles - beforeCounts.articles})`);
  console.log(`   Logs: ${beforeCounts.logs} → ${afterApplyCounts.logs} (+${afterApplyCounts.logs - beforeCounts.logs})`);
  console.log(`   Changes: ${beforeCounts.changes} → ${afterApplyCounts.changes} (+${afterApplyCounts.changes - beforeCounts.changes})`);

  console.log("\n" + "=".repeat(60));
  console.log("🎉 DRY RUN ISOLATION DEMONSTRATION COMPLETE");
  console.log("=".repeat(60));

  process.exit(allTestsPassed ? 0 : 1);
}

if (require.main === module) {
  main().catch(error => {
    console.error("❌ Test failed:", error);
    process.exit(1);
  });
}