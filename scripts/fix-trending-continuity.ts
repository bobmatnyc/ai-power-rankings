#!/usr/bin/env node

/**
 * Fix Trending Chart Continuity
 *
 * Problem: Chart lines don't connect between August and September because
 * the 5 September tools (Cursor, Windsurf, etc.) don't exist in historical periods.
 *
 * Solution: Add these tools to May-August periods with position: null to indicate
 * they weren't ranked, allowing the chart to show them "entering" top 10 in September.
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { rankings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { invalidateTrendingCache } from "@/lib/cache/trending-cache";

interface RankingEntry {
  tool_id: string;
  tool_slug: string;
  position: number | null;
  score: number;
  tier: string;
  name?: string;
  description?: string;
  logo_url?: string;
}

interface RankingData {
  period: string;
  rankings: RankingEntry[];
  metadata?: {
    total_tools?: number;
    last_updated?: string;
  };
}

async function fixTrendingContinuity() {
  try {
    console.log("🔧 Starting trending chart continuity fix...\n");

    const db = getDb();
    if (!db) {
      throw new Error("Failed to get database connection");
    }
    console.log("✅ Database connected\n");

    // Step 1: Get September 2025 ranking and extract top 5 tools
    console.log("📊 Step 1: Fetching September 2025 ranking...");
    const septRankings = await db
      .select()
      .from(rankings)
      .where(eq(rankings.period, "2025-09"));

    if (septRankings.length === 0) {
      throw new Error("September 2025 ranking not found");
    }

    const septData = septRankings[0].data as RankingData;
    const septTop5 = septData.rankings
      .filter((r) => r.position !== null && r.position <= 5)
      .sort((a, b) => (a.position || 0) - (b.position || 0));

    console.log("✅ Found September 2025 top 5 tools:");
    septTop5.forEach((tool, idx) => {
      console.log(`   ${idx + 1}. ${tool.tool_slug} (ID: ${tool.tool_id}, Position: ${tool.position})`);
    });
    console.log("");

    // Step 2: Process each historical period
    const historicalPeriods = ["2025-05", "2025-06", "2025-07", "2025-08"];

    for (const period of historicalPeriods) {
      console.log(`📝 Step 2.${historicalPeriods.indexOf(period) + 1}: Processing ${period}...`);

      // Get existing ranking for this period
      const existingRankings = await db
        .select()
        .from(rankings)
        .where(eq(rankings.period, period));

      if (existingRankings.length === 0) {
        console.log(`   ⚠️  No ranking found for ${period}, skipping...`);
        continue;
      }

      const existingData = existingRankings[0].data as RankingData;
      const existingToolIds = new Set(existingData.rankings.map((r) => r.tool_id));

      // Find which September tools are missing
      const missingTools = septTop5.filter((tool) => !existingToolIds.has(tool.tool_id));

      if (missingTools.length === 0) {
        console.log(`   ✅ All September tools already exist in ${period}`);
        continue;
      }

      console.log(`   📌 Adding ${missingTools.length} tools with null positions:`);
      missingTools.forEach((tool) => {
        console.log(`      - ${tool.tool_slug} (${tool.tool_id})`);
      });

      // Create entries for missing tools with null positions
      const newEntries: RankingEntry[] = missingTools.map((tool) => ({
        tool_id: tool.tool_id,
        tool_slug: tool.tool_slug,
        position: null, // Not ranked in this period
        score: 0,
        tier: "D",
        name: tool.name,
        description: tool.description,
        logo_url: tool.logo_url,
      }));

      // Update the ranking data
      const updatedData: RankingData = {
        ...existingData,
        rankings: [...existingData.rankings, ...newEntries],
        metadata: {
          ...existingData.metadata,
          last_updated: new Date().toISOString(),
          total_tools: existingData.rankings.length + newEntries.length,
        },
      };

      // Save updated ranking
      await db
        .update(rankings)
        .set({
          data: updatedData,
          updated_at: new Date(),
        })
        .where(eq(rankings.period, period));

      console.log(`   ✅ Updated ${period} with ${newEntries.length} new entries\n`);
    }

    // Step 3: Clear trending cache
    console.log("🗑️  Step 3: Clearing trending cache...");
    const invalidated = invalidateTrendingCache();
    console.log(`✅ Cleared ${invalidated} cache entries\n`);

    // Step 4: Verification
    console.log("🔍 Step 4: Verification...");
    console.log("Checking tool presence across all periods:\n");

    const allPeriods = [...historicalPeriods, "2025-09"];
    for (const tool of septTop5) {
      console.log(`📊 ${tool.tool_slug}:`);
      for (const period of allPeriods) {
        const periodRankings = await db
          .select()
          .from(rankings)
          .where(eq(rankings.period, period));

        if (periodRankings.length > 0) {
          const periodData = periodRankings[0].data as RankingData;
          const toolEntry = periodData.rankings.find((r) => r.tool_id === tool.tool_id);

          if (toolEntry) {
            const posDisplay = toolEntry.position === null ? "unranked" : `#${toolEntry.position}`;
            console.log(`   ${period}: ✅ ${posDisplay}`);
          } else {
            console.log(`   ${period}: ❌ missing`);
          }
        }
      }
      console.log("");
    }

    console.log("✨ Trending chart continuity fix completed successfully!");
    console.log("\n📈 Expected result:");
    console.log("   - September tools now exist in all periods (May-September)");
    console.log("   - Historical periods show them as unranked (position: null)");
    console.log("   - September shows their actual top 5 positions");
    console.log("   - Chart lines will now connect smoothly across periods");

  } catch (error) {
    console.error("\n❌ Error fixing trending continuity:", error);
    if (error instanceof Error) {
      console.error("Stack trace:", error.stack);
    }
    process.exit(1);
  } finally {
    console.log("\n🔌 Closing database connection...");
    await closeDb();
    console.log("✅ Done");
  }
}

// Run the script
fixTrendingContinuity();
