#!/usr/bin/env npx tsx

import { ToolsRepository } from "./src/lib/json-db/tools-repository.js";

async function rebuildIndex() {
  console.log("Rebuilding tools index...\n");

  const toolsRepository = new ToolsRepository();

  try {
    await toolsRepository.rebuildIndex();
    console.log("\n✅ Index rebuilt successfully!");

    // Verify the rebuild
    const allTools = await toolsRepository.getAll();
    console.log(`\nTotal tools after rebuild: ${allTools.length}`);

    // Check categories
    const categories = await toolsRepository.getCategoriesWithCounts();
    console.log("\nCategories with counts:");
    for (const [category, count] of Object.entries(categories)) {
      console.log(`  - ${category}: ${count} tools`);
    }
  } catch (error) {
    console.error("Error rebuilding index:", error);
  }
}

rebuildIndex();
