#!/usr/bin/env tsx
/**
 * Fix Ranking Movements
 * This script fixes the movement data for rankings by comparing with the previous available period
 */

import fs from "fs/promises";
import path from "path";

interface Ranking {
  tool_id: string;
  tool_name: string;
  position: number;
  score: number;
  tier: string;
  factor_scores: Record<string, number>;
  movement?: {
    previous_position?: number;
    change: number;
    direction: "up" | "down" | "same" | "new";
  };
  change_analysis?: {
    primary_reason: string;
  };
}

interface RankingPeriod {
  period: string;
  algorithm_version: string;
  is_current: boolean;
  created_at: string;
  rankings: Ranking[];
}

async function fixRankingMovements() {
  try {
    console.log("🔄 Starting ranking movement fix...\n");

    const rankingsDir = path.join(process.cwd(), "data", "json", "rankings", "periods");
    const files = await fs.readdir(rankingsDir);

    // Get all valid period files
    const periodFiles = files
      .filter((f) => f.endsWith(".json") && !f.includes("deleted") && !f.includes("backup"))
      .map((f) => f.replace(".json", ""))
      .sort();

    console.log(`📊 Found ${periodFiles.length} ranking periods\n`);

    // Process each period
    for (let i = 0; i < periodFiles.length; i++) {
      const period = periodFiles[i];
      const filePath = path.join(rankingsDir, `${period}.json`);
      const content = await fs.readFile(filePath, "utf-8");
      const data: RankingPeriod = JSON.parse(content);

      console.log(`\n📅 Processing period: ${period}`);

      // Skip if it's the first period (no previous to compare)
      if (i === 0) {
        console.log("   ⏭️  First period - all entries should be 'new'");
        continue;
      }

      // Get previous period data
      const previousPeriod = periodFiles[i - 1];
      const previousFilePath = path.join(rankingsDir, `${previousPeriod}.json`);
      const previousContent = await fs.readFile(previousFilePath, "utf-8");
      const previousData: RankingPeriod = JSON.parse(previousContent);

      console.log(`   📊 Comparing with previous period: ${previousPeriod}`);

      // Create a map of previous positions
      const previousPositions = new Map<string, number>();
      previousData.rankings.forEach((r) => {
        previousPositions.set(r.tool_id, r.position);
      });

      let updatedCount = 0;

      // Update movement data for each ranking
      data.rankings.forEach((ranking) => {
        const previousPosition = previousPositions.get(ranking.tool_id);

        if (previousPosition === undefined) {
          // Tool is new
          ranking.movement = {
            change: 0,
            direction: "new",
          };
        } else {
          // Tool existed before
          const change = previousPosition - ranking.position;
          ranking.movement = {
            previous_position: previousPosition,
            change: Math.abs(change),
            direction: change > 0 ? "up" : change < 0 ? "down" : "same",
          };

          // Update change analysis if significant movement
          if (Math.abs(change) >= 5 && !ranking.change_analysis) {
            ranking.change_analysis = {
              primary_reason: change > 0 ? "Performance improvements" : "Competitive pressure",
            };
          }
        }

        updatedCount++;
      });

      // Write updated data back
      await fs.writeFile(filePath, JSON.stringify(data, null, 2) + "\n");
      console.log(`   ✅ Updated ${updatedCount} movement records`);
    }

    console.log("\n✨ Ranking movement fix complete!");
  } catch (error) {
    console.error("❌ Error fixing ranking movements:", error);
    process.exit(1);
  }
}

// Run the fix
fixRankingMovements();
