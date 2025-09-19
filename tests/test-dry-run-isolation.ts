#!/usr/bin/env tsx

/**
 * Comprehensive Dry Run Database Isolation Test
 *
 * This script tests that the fixed dry run implementation truly prevents all
 * database modifications during preview operations.
 *
 * Tests include:
 * - Preview generates changes without DB writes
 * - No processing logs created during preview
 * - No article updates during preview
 * - Database state identical before/after preview
 * - Apply after preview updates database correctly
 * - Cache works between preview and apply
 */

import { getDb } from "@/lib/db/connection";
import { ArticleDatabaseService } from "@/lib/services/article-db-service";
import { articles, articleProcessingLogs, articleRankingsChanges } from "@/lib/db/article-schema";
import { eq, sql } from "drizzle-orm";

interface TestResult {
  testName: string;
  passed: boolean;
  details: string;
  proof?: any;
}

interface DatabaseSnapshot {
  articlesCount: number;
  processingLogsCount: number;
  rankingChangesCount: number;
  latestArticleIds: string[];
  latestProcessingLogIds: string[];
  latestRankingChangeIds: string[];
}

class DryRunIsolationTester {
  private db: ReturnType<typeof getDb>;
  private articleService: ArticleDatabaseService;
  private results: TestResult[] = [];

  constructor() {
    this.db = getDb();
    if (!this.db) {
      throw new Error("Database connection not available");
    }
    this.articleService = new ArticleDatabaseService();
  }

  /**
   * Take a snapshot of database state
   */
  async takeSnapshot(): Promise<DatabaseSnapshot> {
    const articlesResult = await this.db.select({ count: sql<number>`count(*)` }).from(articles);
    const logsResult = await this.db.select({ count: sql<number>`count(*)` }).from(articleProcessingLogs);
    const changesResult = await this.db.select({ count: sql<number>`count(*)` }).from(articleRankingsChanges);

    const latestArticles = await this.db
      .select({ id: articles.id })
      .from(articles)
      .orderBy(sql`${articles.createdAt} DESC`)
      .limit(5);

    const latestLogs = await this.db
      .select({ id: articleProcessingLogs.id })
      .from(articleProcessingLogs)
      .orderBy(sql`${articleProcessingLogs.createdAt} DESC`)
      .limit(5);

    const latestChanges = await this.db
      .select({ id: articleRankingsChanges.id })
      .from(articleRankingsChanges)
      .orderBy(sql`${articleRankingsChanges.createdAt} DESC`)
      .limit(5);

    return {
      articlesCount: articlesResult[0].count,
      processingLogsCount: logsResult[0].count,
      rankingChangesCount: changesResult[0].count,
      latestArticleIds: latestArticles.map(a => a.id),
      latestProcessingLogIds: latestLogs.map(l => l.id),
      latestRankingChangeIds: latestChanges.map(c => c.id),
    };
  }

  /**
   * Compare two database snapshots
   */
  compareSnapshots(before: DatabaseSnapshot, after: DatabaseSnapshot): {
    identical: boolean;
    differences: string[];
  } {
    const differences: string[] = [];

    if (before.articlesCount !== after.articlesCount) {
      differences.push(`Articles count changed: ${before.articlesCount} → ${after.articlesCount}`);
    }

    if (before.processingLogsCount !== after.processingLogsCount) {
      differences.push(`Processing logs count changed: ${before.processingLogsCount} → ${after.processingLogsCount}`);
    }

    if (before.rankingChangesCount !== after.rankingChangesCount) {
      differences.push(`Ranking changes count changed: ${before.rankingChangesCount} → ${after.rankingChangesCount}`);
    }

    // Check for new IDs (which would indicate new records)
    const newArticleIds = after.latestArticleIds.filter(id => !before.latestArticleIds.includes(id));
    const newLogIds = after.latestProcessingLogIds.filter(id => !before.latestProcessingLogIds.includes(id));
    const newChangeIds = after.latestRankingChangeIds.filter(id => !before.latestRankingChangeIds.includes(id));

    if (newArticleIds.length > 0) {
      differences.push(`New article IDs found: ${newArticleIds.join(', ')}`);
    }
    if (newLogIds.length > 0) {
      differences.push(`New processing log IDs found: ${newLogIds.join(', ')}`);
    }
    if (newChangeIds.length > 0) {
      differences.push(`New ranking change IDs found: ${newChangeIds.join(', ')}`);
    }

    return {
      identical: differences.length === 0,
      differences
    };
  }

  /**
   * Test 1: Article ingestion preview doesn't create database records
   */
  async testArticleIngestionPreview(): Promise<TestResult> {
    console.log("\n🧪 Testing article ingestion preview (dry run)...");

    const beforeSnapshot = await this.takeSnapshot();

    const testContent = `
# AI Breakthrough: New Code Assistant Revolutionizes Development

Claude Code and GitHub Copilot are leading the charge in AI-powered development tools.
This article discusses the latest improvements in code generation and developer productivity.

The tools mentioned include:
- Claude Code: Advanced reasoning capabilities
- GitHub Copilot: Seamless IDE integration
- Cursor: AI-first code editor
- v0: Visual component generation

These tools are transforming how developers work, with significant improvements in productivity and code quality.
    `.trim();

    try {
      // Execute dry run
      const result = await this.articleService.ingestArticle({
        type: "text",
        input: testContent,
        dryRun: true,
        metadata: {
          author: "Test Author",
          category: "AI News",
          tags: ["ai", "development", "tools"]
        }
      });

      const afterSnapshot = await this.takeSnapshot();
      const comparison = this.compareSnapshots(beforeSnapshot, afterSnapshot);

      if (comparison.identical) {
        return {
          testName: "Article Ingestion Preview Database Isolation",
          passed: true,
          details: "✅ Preview mode created no database records",
          proof: {
            previewResult: {
              hasArticle: !!result.article,
              hasChanges: !!result.predictedChanges,
              articleTitle: result.article?.title,
              toolsAffected: result.summary?.totalToolsAffected || 0
            },
            databaseComparison: comparison
          }
        };
      } else {
        return {
          testName: "Article Ingestion Preview Database Isolation",
          passed: false,
          details: `❌ Preview mode modified database: ${comparison.differences.join(', ')}`,
          proof: {
            previewResult: result,
            databaseComparison: comparison
          }
        };
      }
    } catch (error) {
      return {
        testName: "Article Ingestion Preview Database Isolation",
        passed: false,
        details: `❌ Preview failed with error: ${error.message}`,
        proof: { error: error.message }
      };
    }
  }

  /**
   * Test 2: Article recalculation preview doesn't create database records
   */
  async testRecalculationPreview(): Promise<TestResult> {
    console.log("\n🧪 Testing recalculation preview (dry run)...");

    // First, find an existing article to test with
    const existingArticles = await this.db
      .select({ id: articles.id, title: articles.title })
      .from(articles)
      .where(eq(articles.status, "active"))
      .limit(1);

    if (existingArticles.length === 0) {
      return {
        testName: "Recalculation Preview Database Isolation",
        passed: false,
        details: "❌ No existing articles found to test recalculation preview",
        proof: { error: "No test data available" }
      };
    }

    const testArticleId = existingArticles[0].id;
    const beforeSnapshot = await this.takeSnapshot();

    try {
      // Execute dry run recalculation
      const result = await this.articleService.recalculateArticleRankingsWithProgress(
        testArticleId,
        (progress, step) => {
          console.log(`  Progress: ${progress}% - ${step}`);
        },
        { dryRun: true }
      );

      const afterSnapshot = await this.takeSnapshot();
      const comparison = this.compareSnapshots(beforeSnapshot, afterSnapshot);

      if (comparison.identical) {
        return {
          testName: "Recalculation Preview Database Isolation",
          passed: true,
          details: "✅ Recalculation preview created no database records",
          proof: {
            previewResult: {
              hasChanges: result.changes.length > 0,
              toolsAffected: result.summary.totalToolsAffected,
              averageScoreChange: result.summary.averageScoreChange,
              testedArticleId: testArticleId
            },
            databaseComparison: comparison
          }
        };
      } else {
        return {
          testName: "Recalculation Preview Database Isolation",
          passed: false,
          details: `❌ Recalculation preview modified database: ${comparison.differences.join(', ')}`,
          proof: {
            previewResult: result,
            databaseComparison: comparison
          }
        };
      }
    } catch (error) {
      return {
        testName: "Recalculation Preview Database Isolation",
        passed: false,
        details: `❌ Recalculation preview failed: ${error.message}`,
        proof: { error: error.message, testArticleId }
      };
    }
  }

  /**
   * Test 3: Processing logs are NOT created during preview
   */
  async testNoProcessingLogsDuringPreview(): Promise<TestResult> {
    console.log("\n🧪 Testing no processing logs created during preview...");

    const beforeLogCount = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(articleProcessingLogs);

    const testContent = `
# Quick Test Article for Processing Log Check

This is a minimal test article to verify that no processing logs are created during preview mode.
Tools mentioned: Claude Code, ChatGPT.
    `.trim();

    try {
      // Execute dry run
      await this.articleService.ingestArticle({
        type: "text",
        input: testContent,
        dryRun: true,
        metadata: { author: "Log Test" }
      });

      const afterLogCount = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(articleProcessingLogs);

      const logCountDifference = afterLogCount[0].count - beforeLogCount[0].count;

      if (logCountDifference === 0) {
        return {
          testName: "No Processing Logs During Preview",
          passed: true,
          details: "✅ No processing logs created during preview",
          proof: {
            beforeCount: beforeLogCount[0].count,
            afterCount: afterLogCount[0].count,
            difference: logCountDifference
          }
        };
      } else {
        return {
          testName: "No Processing Logs During Preview",
          passed: false,
          details: `❌ Processing logs were created during preview: ${logCountDifference} new logs`,
          proof: {
            beforeCount: beforeLogCount[0].count,
            afterCount: afterLogCount[0].count,
            difference: logCountDifference
          }
        };
      }
    } catch (error) {
      return {
        testName: "No Processing Logs During Preview",
        passed: false,
        details: `❌ Test failed with error: ${error.message}`,
        proof: { error: error.message }
      };
    }
  }

  /**
   * Test 4: Preview → Apply flow with cache validation
   */
  async testPreviewApplyFlow(): Promise<TestResult> {
    console.log("\n🧪 Testing preview → apply flow with cache validation...");

    const testContent = `
# Cache Test Article: AI Tools Performance Study

This comprehensive study analyzes the performance of leading AI development tools:

- Claude Code: Shows exceptional reasoning and code generation capabilities
- GitHub Copilot: Demonstrates strong context awareness and suggestions
- Cursor: Provides seamless AI-first editing experience
- Bolt.new: Offers rapid prototyping capabilities

The study reveals significant productivity improvements across all tested tools.
    `.trim();

    try {
      // Step 1: Execute preview (dry run)
      console.log("  📝 Executing preview...");
      const beforeSnapshot = await this.takeSnapshot();

      const previewResult = await this.articleService.ingestArticle({
        type: "text",
        input: testContent,
        dryRun: true,
        metadata: {
          author: "Cache Test Author",
          category: "Performance Study",
          tags: ["ai", "performance", "study"]
        }
      });

      const afterPreviewSnapshot = await this.takeSnapshot();
      const previewComparison = this.compareSnapshots(beforeSnapshot, afterPreviewSnapshot);

      // Step 2: Execute apply (using preprocessed data)
      console.log("  💾 Executing apply with cached data...");
      const startApplyTime = Date.now();

      const applyResult = await this.articleService.ingestArticle({
        type: "preprocessed",
        preprocessedData: previewResult,
        dryRun: false,
        metadata: {
          author: "Cache Test Author",
          category: "Performance Study",
          tags: ["ai", "performance", "study"]
        }
      });

      const applyDuration = Date.now() - startApplyTime;
      const afterApplySnapshot = await this.takeSnapshot();
      const applyComparison = this.compareSnapshots(afterPreviewSnapshot, afterApplySnapshot);

      // Verify results
      const previewClean = previewComparison.identical;
      const applyWorked = !applyComparison.identical && applyComparison.differences.some(d => d.includes("Articles count changed"));
      const fastApply = applyDuration < 5000; // Should be fast due to caching

      if (previewClean && applyWorked && fastApply) {
        return {
          testName: "Preview → Apply Flow with Cache",
          passed: true,
          details: `✅ Cache flow works correctly (apply took ${applyDuration}ms)`,
          proof: {
            previewIsolated: previewClean,
            applyWorked: applyWorked,
            applyDuration: applyDuration,
            previewResult: {
              hasArticle: !!previewResult.article,
              toolsAffected: previewResult.summary?.totalToolsAffected || 0
            },
            applyResult: {
              articleId: applyResult.id,
              title: applyResult.title
            },
            databaseChanges: {
              preview: previewComparison,
              apply: applyComparison
            }
          }
        };
      } else {
        return {
          testName: "Preview → Apply Flow with Cache",
          passed: false,
          details: `❌ Cache flow issues: preview clean=${previewClean}, apply worked=${applyWorked}, fast=${fastApply} (${applyDuration}ms)`,
          proof: {
            previewIsolated: previewClean,
            applyWorked: applyWorked,
            applyDuration: applyDuration,
            databaseChanges: {
              preview: previewComparison,
              apply: applyComparison
            }
          }
        };
      }
    } catch (error) {
      return {
        testName: "Preview → Apply Flow with Cache",
        passed: false,
        details: `❌ Cache flow failed: ${error.message}`,
        proof: { error: error.message }
      };
    }
  }

  /**
   * Test 5: Error scenarios don't leak database writes
   */
  async testErrorScenarios(): Promise<TestResult> {
    console.log("\n🧪 Testing error scenarios don't leak database writes...");

    const beforeSnapshot = await this.takeSnapshot();

    // Test with invalid content that should cause AI analysis to fail
    const invalidContent = ""; // Empty content should cause an error

    try {
      await this.articleService.ingestArticle({
        type: "text",
        input: invalidContent,
        dryRun: true,
        metadata: { author: "Error Test" }
      });

      // If we get here, the test didn't fail as expected
      const afterSnapshot = await this.takeSnapshot();
      const comparison = this.compareSnapshots(beforeSnapshot, afterSnapshot);

      return {
        testName: "Error Scenarios Database Isolation",
        passed: comparison.identical,
        details: comparison.identical
          ? "✅ No database writes during error scenario"
          : `❌ Database modified during error: ${comparison.differences.join(', ')}`,
        proof: {
          errorExpected: true,
          errorOccurred: false,
          databaseComparison: comparison
        }
      };
    } catch (error) {
      // Expected error occurred - check database wasn't modified
      const afterSnapshot = await this.takeSnapshot();
      const comparison = this.compareSnapshots(beforeSnapshot, afterSnapshot);

      return {
        testName: "Error Scenarios Database Isolation",
        passed: comparison.identical,
        details: comparison.identical
          ? "✅ Error occurred without database modifications"
          : `❌ Error caused database modifications: ${comparison.differences.join(', ')}`,
        proof: {
          errorExpected: true,
          errorOccurred: true,
          errorMessage: error.message,
          databaseComparison: comparison
        }
      };
    }
  }

  /**
   * Run all tests
   */
  async runAllTests(): Promise<TestResult[]> {
    console.log("🚀 Starting comprehensive dry run isolation tests...\n");

    const tests = [
      () => this.testArticleIngestionPreview(),
      () => this.testRecalculationPreview(),
      () => this.testNoProcessingLogsDuringPreview(),
      () => this.testPreviewApplyFlow(),
      () => this.testErrorScenarios()
    ];

    for (const test of tests) {
      try {
        const result = await test();
        this.results.push(result);
      } catch (error) {
        this.results.push({
          testName: "Unknown Test",
          passed: false,
          details: `❌ Test execution failed: ${error.message}`,
          proof: { error: error.message }
        });
      }
    }

    return this.results;
  }

  /**
   * Generate test report
   */
  generateReport(): void {
    console.log("\n" + "=".repeat(80));
    console.log("📊 DRY RUN ISOLATION TEST REPORT");
    console.log("=".repeat(80));

    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    const successRate = total > 0 ? (passed / total * 100).toFixed(1) : "0.0";

    console.log(`\n📈 Overall Result: ${passed}/${total} tests passed (${successRate}%)`);

    if (passed === total) {
      console.log("🎉 ALL TESTS PASSED - Dry run isolation is working correctly!");
    } else {
      console.log("⚠️  SOME TESTS FAILED - Dry run isolation has issues that need attention");
    }

    console.log("\n📋 Detailed Results:");
    console.log("-".repeat(80));

    this.results.forEach((result, index) => {
      const status = result.passed ? "✅ PASS" : "❌ FAIL";
      console.log(`\n${index + 1}. ${result.testName}`);
      console.log(`   Status: ${status}`);
      console.log(`   Details: ${result.details}`);

      if (result.proof && Object.keys(result.proof).length > 0) {
        console.log(`   Proof: ${JSON.stringify(result.proof, null, 2)}`);
      }
    });

    console.log("\n" + "=".repeat(80));
    console.log("📝 Test completed at:", new Date().toISOString());
    console.log("=".repeat(80));
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    const tester = new DryRunIsolationTester();
    await tester.runAllTests();
    tester.generateReport();

    const passedCount = tester.results.filter(r => r.passed).length;
    const totalCount = tester.results.length;

    // Exit with appropriate code
    process.exit(passedCount === totalCount ? 0 : 1);
  } catch (error) {
    console.error("❌ Test execution failed:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { DryRunIsolationTester };