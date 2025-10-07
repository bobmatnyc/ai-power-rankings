#!/usr/bin/env node

/**
 * Script to initialize May 2025 baseline scores for all tools
 * Uses a simple baseline scoring system based on tool metadata
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

interface ToolScoreFactors {
  marketTraction: number;
  technicalCapability: number;
  developerAdoption: number;
  developmentVelocity: number;
  platformResilience: number;
  communitySentiment: number;
  overallScore: number;
}

/**
 * Calculate baseline score for a tool based on its metrics and metadata
 */
function calculateBaselineScore(toolData: any): ToolScoreFactors {
  const metrics = toolData.info?.metrics || {};
  const business = toolData.info?.business || {};

  // Initialize all factors to 50 (neutral baseline)
  const baseline: ToolScoreFactors = {
    marketTraction: 50,
    technicalCapability: 50,
    developerAdoption: 50,
    developmentVelocity: 50,
    platformResilience: 50,
    communitySentiment: 50,
    overallScore: 50,
  };

  // Market Traction (based on users, valuation, revenue)
  if (metrics.users) {
    if (metrics.users > 1000000) baseline.marketTraction = 85;
    else if (metrics.users > 100000) baseline.marketTraction = 75;
    else if (metrics.users > 10000) baseline.marketTraction = 65;
    else baseline.marketTraction = 55;
  }
  if (metrics.valuation) {
    baseline.marketTraction = Math.min(95, baseline.marketTraction + 10);
  }
  if (metrics.monthly_arr) {
    baseline.marketTraction = Math.min(95, baseline.marketTraction + 10);
  }

  // Technical Capability (based on benchmark scores)
  if (metrics.swe_bench?.verified) {
    const score = metrics.swe_bench.verified;
    if (score > 70) baseline.technicalCapability = 90;
    else if (score > 50) baseline.technicalCapability = 80;
    else if (score > 30) baseline.technicalCapability = 70;
    else if (score > 10) baseline.technicalCapability = 60;
  } else if (metrics.swe_bench?.full) {
    const score = metrics.swe_bench.full;
    if (score > 50) baseline.technicalCapability = 85;
    else if (score > 30) baseline.technicalCapability = 75;
    else if (score > 10) baseline.technicalCapability = 65;
    else baseline.technicalCapability = 55;
  }

  // Developer Adoption (based on usage metrics and pricing)
  if (business.free_tier) {
    baseline.developerAdoption = 70;
  }
  if (business.base_price === 0 || business.pricing_model === "freemium") {
    baseline.developerAdoption = Math.min(85, baseline.developerAdoption + 10);
  }
  if (metrics.github_stars) {
    if (metrics.github_stars > 50000) baseline.developerAdoption = 90;
    else if (metrics.github_stars > 10000) baseline.developerAdoption = 80;
    else if (metrics.github_stars > 1000) baseline.developerAdoption = 70;
  }

  // Development Velocity (based on recent updates and activity)
  if (metrics.swe_bench?.date) {
    const benchmarkYear = parseInt(metrics.swe_bench.date.split('-')[0]);
    if (benchmarkYear >= 2025) baseline.developmentVelocity = 80;
    else if (benchmarkYear >= 2024) baseline.developmentVelocity = 65;
    else baseline.developmentVelocity = 50;
  }

  // Platform Resilience (based on company backing and stability)
  if (toolData.info?.company) {
    baseline.platformResilience = 70;
  }
  if (metrics.valuation || business.enterprise_tier) {
    baseline.platformResilience = Math.min(85, baseline.platformResilience + 15);
  }

  // Community Sentiment (based on news mentions and activity)
  if (metrics.news_mentions) {
    if (metrics.news_mentions >= 10) baseline.communitySentiment = 85;
    else if (metrics.news_mentions >= 5) baseline.communitySentiment = 75;
    else if (metrics.news_mentions >= 2) baseline.communitySentiment = 65;
    else baseline.communitySentiment = 55;
  }

  // Calculate overall score as weighted average
  baseline.overallScore = Math.round(
    baseline.marketTraction * 0.20 +
    baseline.technicalCapability * 0.25 +
    baseline.developerAdoption * 0.20 +
    baseline.developmentVelocity * 0.15 +
    baseline.platformResilience * 0.10 +
    baseline.communitySentiment * 0.10
  );

  return baseline;
}

async function initializeMay2025Baseline() {
  try {
    console.log("🚀 Starting May 2025 baseline initialization...\n");

    const db = getDb();
    if (!db) {
      throw new Error("Failed to get database connection");
    }

    // Get all active tools
    const allTools = await db.select().from(tools).where(eq(tools.status, "active"));
    console.log(`📊 Found ${allTools.length} active tools\n`);

    let initialized = 0;
    let skipped = 0;

    for (const tool of allTools) {
      const toolData = tool.data as any;
      const toolId = toolData.id || tool.id;

      // Check if already has non-empty baseline score
      if (
        tool.baselineScore &&
        typeof tool.baselineScore === 'object' &&
        Object.keys(tool.baselineScore).length > 0 &&
        (tool.baselineScore as any).overallScore > 0
      ) {
        console.log(`⏭️  ${tool.name}: Already has baseline, skipping`);
        skipped++;
        continue;
      }

      // Calculate baseline score
      const baselineScore = calculateBaselineScore(toolData);

      // Update tool with baseline scores
      await db
        .update(tools)
        .set({
          baselineScore,
          deltaScore: {},  // Start with no deltas
          currentScore: baselineScore,  // Current = baseline initially
          scoreUpdatedAt: new Date('2025-05-31T23:59:59Z'),  // May 31, 2025
          updatedAt: new Date(),
        })
        .where(eq(tools.id, tool.id));

      console.log(`✅ ${tool.name}: Initialized with baseline score ${baselineScore.overallScore}`);
      initialized++;
    }

    console.log(`\n✨ Baseline initialization completed!`);
    console.log(`   Initialized: ${initialized} tools`);
    console.log(`   Skipped: ${skipped} tools (already had baseline)`);
    console.log(`   Total: ${allTools.length} tools\n`);

  } catch (error) {
    console.error("❌ Error initializing May 2025 baseline:", error);
    process.exit(1);
  } finally {
    await closeDb();
    console.log("👋 Database connection closed");
  }
}

// Run if called directly
if (require.main === module) {
  initializeMay2025Baseline()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { initializeMay2025Baseline };
