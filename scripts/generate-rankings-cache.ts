#!/usr/bin/env tsx

import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import fs from "fs-extra";
import { RankingsRepository } from "../src/lib/db/repositories/rankings.repository.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function generateRankingsCache() {
  console.log("📊 Generating rankings cache...\n");

  try {
    const rankingsRepository = new RankingsRepository();

    // Get the latest rankings
    const latestRankings = await rankingsRepository.getCurrent();

    if (!latestRankings) {
      console.log("⚠️ No rankings found to cache");
      return;
    }

    console.log(`📦 Found rankings for period: ${latestRankings.period}`);
    const rankingsData = latestRankings.data as any;
    const rankings = rankingsData?.rankings || [];
    console.log(`📊 Total tools ranked: ${rankings.length}`);

    // Generate cache file
    const cacheDir = path.join(__dirname, "../src/data/cache");
    await fs.ensureDir(cacheDir);

    const cacheFile = path.join(cacheDir, "rankings.json");

    // Write rankings directly (maintaining compatibility)
    const cacheData = {
      period: latestRankings.period,
      rankings: rankings,
      algorithm: rankingsData?.algorithm || {},
      _source: "database",
      _timestamp: new Date().toISOString(),
    };
    await fs.writeJson(cacheFile, cacheData, { spaces: 2 });

    console.log(`✅ Cache generated: ${cacheFile}`);
    console.log(`📊 Rankings period: ${latestRankings.period}`);
    console.log(`📊 Total rankings: ${rankings.length}`);

    // Show tier breakdown
    const tierBreakdown: Record<string, number> = {};
    rankings.forEach((ranking: any) => {
      const tier = ranking.tier || "Unranked";
      tierBreakdown[tier] = (tierBreakdown[tier] || 0) + 1;
    });

    console.log("\n📂 Tier breakdown:");
    for (const [tier, count] of Object.entries(tierBreakdown)) {
      console.log(`  - ${tier}: ${count} tools`);
    }
  } catch (error) {
    console.error("❌ Error generating rankings cache:", error);
    process.exit(1);
  }
}

generateRankingsCache();
