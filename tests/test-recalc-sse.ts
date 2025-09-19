#!/usr/bin/env tsx

/**
 * Test script to demonstrate SSE (Server-Sent Events) progress tracking
 * This simulates how the browser receives progress updates from the API
 */

import { ArticleDatabaseService } from "../src/lib/services/article-db-service";
import { getDb } from "../src/lib/db/connection";

async function testSSERecalculation() {
  console.log("🌐 Testing SSE Recalculation Progress (API Simulation)");
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

    // Get a sample article
    console.log("\n📋 Finding an article for SSE test...");
    const articles = await articlesRepo.getArticles({ limit: 1 });

    if (articles.length === 0) {
      console.log("❌ No articles found. Please add an article first.");
      process.exit(1);
    }

    const testArticle = articles[0];
    console.log(`✅ Found article: "${testArticle.title}"`);
    console.log(`   ID: ${testArticle.id}`);

    // Simulate SSE endpoint behavior
    console.log("\n📡 Simulating SSE endpoint (what the browser would receive):\n");
    console.log("data: " + JSON.stringify({ type: 'progress', progress: 0, step: 'Starting...' }));
    console.log("");

    // Mock progress callback that simulates SSE messages
    const sseMessages: Array<{ type: string; [key: string]: any }> = [];

    const result = await articleService.recalculateArticleRankingsWithProgress(
      testArticle.id,
      (progress: number, step: string) => {
        const message = { type: 'progress', progress, step };
        sseMessages.push(message);
        console.log("data: " + JSON.stringify(message));
        console.log("");
      }
    );

    // Send completion message
    const completeMessage = {
      type: 'complete',
      changes: result.changes,
      summary: result.summary
    };
    console.log("data: " + JSON.stringify(completeMessage));
    console.log("");

    // Show summary of SSE messages
    console.log("\n📊 SSE Message Summary:");
    console.log("=" .repeat(50));
    console.log(`Total progress messages sent: ${sseMessages.length}`);
    console.log(`Final result: ${result.changes.length} tools affected`);

    // Simulate browser-side processing
    console.log("\n🖥️ Browser-side Processing (simulated):");
    console.log("=" .repeat(50));

    sseMessages.forEach((msg, index) => {
      if (index === 0 || index === sseMessages.length - 1 || index % 2 === 0) {
        const filled = Math.floor(msg.progress / 5);
        const empty = 20 - filled;
        const progressBar = "█".repeat(filled) + "░".repeat(empty);
        console.log(`[${progressBar}] ${msg.progress}% - ${msg.step}`);
      }
    });

    console.log("\n✅ SSE recalculation test completed successfully!");
    console.log("\n💡 In the actual UI:");
    console.log("   - Progress bar fills smoothly from 0% to 100%");
    console.log("   - Step descriptions update in real-time");
    console.log("   - Results modal shows after completion");
    console.log("   - Multiple articles can be recalculated independently");

  } catch (error) {
    console.error("\n❌ Error during SSE test:", error);
    process.exit(1);
  }
}

// Run the test
testSSERecalculation().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});