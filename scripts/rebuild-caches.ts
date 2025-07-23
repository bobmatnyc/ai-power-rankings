#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const DATA_PATH = join(process.cwd(), "data", "json");
const CACHE_PATH = join(process.cwd(), "src", "data", "cache");

async function rebuildToolsCache() {
  console.log("🔧 Rebuilding tools cache...");

  try {
    // Read the main tools.json file
    const toolsPath = join(DATA_PATH, "tools", "tools.json");
    const toolsData = JSON.parse(await readFile(toolsPath, "utf-8"));

    // Extract just the tools array for the cache
    const cacheData = toolsData.tools || [];

    // Write to cache
    const cachePath = join(CACHE_PATH, "tools.json");
    await writeFile(cachePath, JSON.stringify(cacheData, null, 2));
    console.log(`✅ Tools cache rebuilt with ${cacheData.length} tools`);

    // Check if Kiro is included
    const kiro = cacheData.find((t: any) => t.slug === "kiro");
    if (kiro) {
      console.log(`✅ Kiro included with ID ${kiro.id}`);
    } else {
      console.log("⚠️  Kiro not found in tools data");
    }
  } catch (error) {
    console.error("❌ Error rebuilding tools cache:", error);
  }
}

async function rebuildNewsCache() {
  console.log("📰 Rebuilding news cache...");

  try {
    // Read the main news.json file
    const newsPath = join(DATA_PATH, "news", "news.json");
    const newsData = JSON.parse(await readFile(newsPath, "utf-8"));

    // Use the news data as-is for cache
    const cachePath = join(CACHE_PATH, "news.json");
    await writeFile(cachePath, JSON.stringify(newsData, null, 2));
    console.log(`✅ News cache rebuilt with ${newsData.articles?.length || 0} articles`);
  } catch (error) {
    console.error("❌ Error rebuilding news cache:", error);
  }
}

async function rebuildRankingsCache() {
  console.log("📊 Rebuilding rankings cache...");

  try {
    // Read the rankings index file
    const indexPath = join(DATA_PATH, "rankings", "index.json");
    const indexData = JSON.parse(await readFile(indexPath, "utf-8"));

    // Read all ranking period files
    const periodsPath = join(DATA_PATH, "rankings", "periods");
    const allRankings: any = {};

    // Get the latest rankings from the periods directory
    const latestFiles = [
      "2025-01-01.json",
      "2025-02-01.json",
      "2025-03-01.json",
      "2025-04-01.json",
      "2025-05-01.json",
      "2025-06-01.json",
      "2025-07-16.json", // Previous July rankings
      "2025-07.json", // New v7-fixed July rankings
    ];

    for (const file of latestFiles) {
      try {
        const filePath = join(periodsPath, file);
        const data = JSON.parse(await readFile(filePath, "utf-8"));

        // Extract period key from filename (e.g., '2025-01' from '2025-01-01.json')
        const periodKey = file.replace(".json", "");
        allRankings[periodKey] = data;
      } catch (error) {
        console.log(`⚠️  Could not read ${file}`);
      }
    }

    // Add the latest period from the index if available
    if (indexData.current_period) {
      allRankings.current = {
        period: indexData.current_period,
        rankings: indexData.rankings || [],
      };
    }

    // Write combined rankings to cache
    const cachePath = join(CACHE_PATH, "rankings.json");
    await writeFile(cachePath, JSON.stringify(allRankings, null, 2));
    console.log(`✅ Rankings cache rebuilt with ${Object.keys(allRankings).length} periods`);
  } catch (error) {
    console.error("❌ Error rebuilding rankings cache:", error);
  }
}

async function main() {
  console.log("🚀 Starting cache rebuild...\n");

  await rebuildToolsCache();
  await rebuildNewsCache();
  await rebuildRankingsCache();

  console.log("\n✅ Cache rebuild completed!");
}

main().catch(console.error);
