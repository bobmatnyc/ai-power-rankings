#!/usr/bin/env node

/**
 * Script to initialize baseline scores from existing tool data
 * This is a one-time migration to populate baseline scores
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { toolScoringService } from "@/lib/services/tool-scoring.service";
import { loggers } from "@/lib/logger";

async function initializeBaselineScores() {
  try {
    console.log("🚀 Starting baseline score initialization...");

    // Initialize database connection
    const db = getDb();
    if (!db) {
      throw new Error("Failed to get database connection");
    }
    console.log("✅ Database connected");

    // Initialize baseline scores from current data
    console.log("📊 Initializing baseline scores from current tool data...");
    await toolScoringService.initializeBaselinesFromCurrent();

    // Get summary of initialized scores
    const toolsWithScores = await toolScoringService.getToolsWithScores();

    console.log(`✅ Successfully initialized baseline scores for ${toolsWithScores.length} tools`);

    // Show sample of initialized data
    console.log("\n📋 Sample of initialized tools:");
    toolsWithScores.slice(0, 5).forEach((tool, index) => {
      console.log(`${index + 1}. Tool ID: ${tool.toolId}`);
      console.log(`   Baseline Score: ${JSON.stringify(tool.baselineScore)}`);
      console.log(`   Delta Score: ${JSON.stringify(tool.deltaScore)}`);
      console.log(`   Current Score: ${JSON.stringify(tool.currentScore)}`);
      console.log("");
    });

    console.log("✨ Baseline score initialization completed successfully!");
  } catch (error) {
    console.error("❌ Error initializing baseline scores:", error);
    loggers.db.error("Failed to initialize baseline scores", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  } finally {
    // Close database connection
    await closeDb();
    console.log("👋 Database connection closed");
  }
}

// Run if called directly
if (require.main === module) {
  initializeBaselineScores()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { initializeBaselineScores };