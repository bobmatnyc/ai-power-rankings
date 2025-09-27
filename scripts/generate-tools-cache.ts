#!/usr/bin/env tsx

import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import fs from "fs-extra";
import { ToolsRepository } from "../src/lib/db/repositories/tools.repository";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function generateToolsCache() {
  console.log("🔨 Generating tools cache...\n");

  try {
    const toolsRepository = new ToolsRepository();

    // Get all tools
    const allTools = await toolsRepository.getAll();
    console.log(`📦 Found ${allTools.length} tools`);

    // Generate cache file
    const cacheDir = path.join(__dirname, "../src/data/cache");
    await fs.ensureDir(cacheDir);

    const cacheFile = path.join(cacheDir, "tools.json");

    // Write tools array directly (maintaining compatibility)
    await fs.writeJson(cacheFile, allTools, { spaces: 2 });

    console.log(`✅ Cache generated: ${cacheFile}`);
    console.log(`📊 Total tools: ${allTools.length}`);

    // Show category breakdown
    const categories = await toolsRepository.getCategoriesWithCounts();
    console.log("\n📂 Categories:");
    for (const [category, count] of Object.entries(categories)) {
      console.log(`  - ${category}: ${count} tools`);
    }
  } catch (error) {
    console.error("❌ Error generating tools cache:", error);
    process.exit(1);
  }
}

generateToolsCache();
