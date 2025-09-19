#!/usr/bin/env tsx

/**
 * Test script to demonstrate recalculation progress tracking
 * This simulates what happens when the "Recalc" button is clicked in the UI
 */

import { ArticleDatabaseService } from "../src/lib/services/article-db-service";
import { getDb } from "../src/lib/db/connection";

async function testRecalculationProgress() {
  console.log("🧪 Testing Recalculation Progress Tracking");
  console.log("=" .repeat(50));

  try {
    // Initialize database
    const db = getDb();
    if (!db) {
      console.error("❌ Database connection not available");
      process.exit(1);
    }

    const articleService = new ArticleDatabaseService();
    const articlesRepo = articleService.getArticlesRepo();

    // Get a sample article to test with
    console.log("\n📋 Finding an article to test recalculation...");
    const articles = await articlesRepo.getArticles({ limit: 1 });

    if (articles.length === 0) {
      console.log("❌ No articles found in database. Please add an article first.");
      process.exit(1);
    }

    const testArticle = articles[0];
    console.log(`✅ Found article: "${testArticle.title}"`);
    console.log(`   ID: ${testArticle.id}`);

    // Test recalculation with progress tracking
    console.log("\n🔄 Starting recalculation with progress tracking...\n");

    const result = await articleService.recalculateArticleRankingsWithProgress(
      testArticle.id,
      (progress: number, step: string) => {
        // Display progress bar
        const filled = Math.floor(progress / 5);
        const empty = 20 - filled;
        const progressBar = "█".repeat(filled) + "░".repeat(empty);

        // Clear previous line and write new progress
        process.stdout.write(`\r[${progressBar}] ${progress}% - ${step}`);

        if (progress === 100) {
          console.log("\n"); // New line after completion
        }
      }
    );

    // Display results
    console.log("📊 Recalculation Results:");
    console.log("=" .repeat(50));

    console.log(`\n📈 Summary:`);
    console.log(`   Tools Affected: ${result.summary.totalToolsAffected}`);
    console.log(`   Average Score Change: ${result.summary.averageScoreChange.toFixed(2)}`);

    if (result.changes.length > 0) {
      console.log(`\n🔧 Tool Changes:`);
      result.changes.forEach((change, index) => {
        const arrow = change.change > 0 ? "↑" : change.change < 0 ? "↓" : "→";
        const color = change.change > 0 ? "\x1b[32m" : change.change < 0 ? "\x1b[31m" : "\x1b[33m";
        const reset = "\x1b[0m";

        console.log(
          `   ${index + 1}. ${change.tool}: ${change.oldScore.toFixed(1)} → ${change.newScore.toFixed(1)} ` +
          `${color}(${arrow} ${change.change > 0 ? "+" : ""}${change.change.toFixed(2)})${reset}`
        );

        if (change.oldRank !== undefined && change.newRank !== undefined) {
          const rankChange = (change.oldRank || 0) - (change.newRank || 0);
          if (rankChange !== 0) {
            console.log(`      Rank: #${change.oldRank} → #${change.newRank}`);
          }
        }
      });
    } else {
      console.log("\n✨ No ranking changes detected after recalculation.");
    }

    console.log("\n✅ Recalculation test completed successfully!");

  } catch (error) {
    console.error("\n❌ Error during recalculation test:", error);
    process.exit(1);
  }
}

// Run the test
testRecalculationProgress().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});