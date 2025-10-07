#!/usr/bin/env node

/**
 * Script to create the May 2025 baseline snapshot
 * Creates a version record in ranking_versions table with complete baseline state
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools, rankingVersions } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

interface ToolSnapshot {
  id: string;
  slug: string;
  name: string;
  category: string;
  baselineScore: any;
  deltaScore: any;
  currentScore: any;
  scoreUpdatedAt: Date | null;
}

async function createBaselineSnapshot() {
  try {
    console.log("🚀 Creating May 2025 baseline snapshot...\n");

    const db = getDb();
    if (!db) {
      throw new Error("Failed to get database connection");
    }

    // Check if baseline snapshot already exists
    const existing = await db
      .select()
      .from(rankingVersions)
      .where(eq(rankingVersions.version, "baseline-may-2025"))
      .limit(1);

    if (existing.length > 0) {
      console.log("⚠️  Baseline snapshot already exists!");
      console.log(`   Version ID: ${existing[0].id}`);
      console.log(`   Created: ${existing[0].createdAt}`);
      console.log(`   Tools: ${existing[0].toolsAffected}\n`);

      const shouldRecreate = process.argv.includes('--force');
      if (!shouldRecreate) {
        console.log("   Use --force flag to recreate the snapshot");
        return existing[0];
      }

      console.log("   Recreating snapshot with --force flag...\n");
      await db.delete(rankingVersions).where(eq(rankingVersions.id, existing[0].id));
    }

    // Get all tools with their baseline scores
    const allTools = await db
      .select({
        id: tools.id,
        slug: tools.slug,
        name: tools.name,
        category: tools.category,
        baselineScore: tools.baselineScore,
        deltaScore: tools.deltaScore,
        currentScore: tools.currentScore,
        scoreUpdatedAt: tools.scoreUpdatedAt,
      })
      .from(tools)
      .where(eq(tools.status, "active"));

    console.log(`📊 Found ${allTools.length} active tools\n`);

    // Verify all tools have baseline scores
    const toolsWithoutBaseline = allTools.filter(
      (tool) =>
        !tool.baselineScore ||
        Object.keys(tool.baselineScore as object).length === 0 ||
        (tool.baselineScore as any).overallScore === undefined
    );

    if (toolsWithoutBaseline.length > 0) {
      console.error(`❌ Error: ${toolsWithoutBaseline.length} tools are missing baseline scores:`);
      toolsWithoutBaseline.forEach((tool) => {
        console.error(`   - ${tool.name} (${tool.slug})`);
      });
      throw new Error("Cannot create snapshot - some tools are missing baseline scores");
    }

    console.log("✅ All tools have baseline scores\n");

    // Reset delta scores to empty and ensure current = baseline
    console.log("🔄 Resetting delta scores and syncing current scores...");
    for (const tool of allTools) {
      await db
        .update(tools)
        .set({
          deltaScore: {},
          currentScore: tool.baselineScore,
          scoreUpdatedAt: new Date('2025-05-31T23:59:59Z'),
          updatedAt: new Date(),
        })
        .where(eq(tools.id, tool.id));
    }
    console.log("✅ Delta scores reset and current scores synced\n");

    // Refresh tools data after reset
    const refreshedTools = await db
      .select({
        id: tools.id,
        slug: tools.slug,
        name: tools.name,
        category: tools.category,
        baselineScore: tools.baselineScore,
        deltaScore: tools.deltaScore,
        currentScore: tools.currentScore,
        scoreUpdatedAt: tools.scoreUpdatedAt,
      })
      .from(tools)
      .where(eq(tools.status, "active"));

    // Create snapshot data structure
    const snapshotData = {
      version: "baseline-may-2025",
      created_at: "2025-05-31T23:59:59Z",
      description: "May 2025 baseline snapshot - initial tool scores before delta tracking",
      tools: refreshedTools.map((tool) => ({
        id: tool.id,
        slug: tool.slug,
        name: tool.name,
        category: tool.category,
        scores: {
          baseline: tool.baselineScore,
          delta: tool.deltaScore,
          current: tool.currentScore,
        },
        score_updated_at: tool.scoreUpdatedAt,
      })),
      statistics: {
        total_tools: refreshedTools.length,
        average_baseline_score:
          refreshedTools.reduce((sum, t) => sum + ((t.baselineScore as any)?.overallScore || 0), 0) /
          refreshedTools.length,
        score_distribution: calculateScoreDistribution(refreshedTools),
      },
    };

    // Create ranking version record
    const [versionRecord] = await db
      .insert(rankingVersions)
      .values({
        version: "baseline-may-2025",
        rankingsSnapshot: snapshotData,
        changesSummary: "May 2025 baseline snapshot - initial baseline scores for all 54 tools",
        newsItemsCount: 0,
        toolsAffected: refreshedTools.length,
        previousVersionId: null, // This is the first version
        createdBy: "system",
        createdAt: new Date('2025-05-31T23:59:59Z'),
        isRollback: false,
      })
      .returning();

    console.log("✅ Baseline snapshot created successfully!\n");
    console.log(`📋 Snapshot Details:`);
    console.log(`   Version ID: ${versionRecord.id}`);
    console.log(`   Version: ${versionRecord.version}`);
    console.log(`   Created: ${versionRecord.createdAt}`);
    console.log(`   Tools: ${versionRecord.toolsAffected}`);
    console.log(`   Average Score: ${snapshotData.statistics.average_baseline_score.toFixed(2)}\n`);

    console.log(`📊 Score Distribution:`);
    Object.entries(snapshotData.statistics.score_distribution).forEach(([range, count]) => {
      console.log(`   ${range}: ${count} tools`);
    });

    return versionRecord;
  } catch (error) {
    console.error("\n❌ Error creating baseline snapshot:", error);
    process.exit(1);
  } finally {
    await closeDb();
    console.log("\n👋 Database connection closed");
  }
}

function calculateScoreDistribution(tools: any[]): Record<string, number> {
  const distribution = {
    "0-25": 0,
    "26-50": 0,
    "51-65": 0,
    "66-75": 0,
    "76-85": 0,
    "86-95": 0,
    "96-100": 0,
  };

  tools.forEach((tool) => {
    const score = (tool.baselineScore as any)?.overallScore || 0;
    if (score <= 25) distribution["0-25"]++;
    else if (score <= 50) distribution["26-50"]++;
    else if (score <= 65) distribution["51-65"]++;
    else if (score <= 75) distribution["66-75"]++;
    else if (score <= 85) distribution["76-85"]++;
    else if (score <= 95) distribution["86-95"]++;
    else distribution["96-100"]++;
  });

  return distribution;
}

// Run if called directly
if (require.main === module) {
  createBaselineSnapshot()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { createBaselineSnapshot };
