#!/usr/bin/env node

/**
 * Script to check what data is actually in the tools table
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";

async function checkToolData() {
  try {
    console.log("🔍 Checking tool data structure...");

    const db = getDb();
    if (!db) {
      throw new Error("Failed to get database connection");
    }

    // Get a sample of tools
    const sampleTools = await db.select().from(tools).limit(3);

    console.log(`\n📊 Found ${sampleTools.length} sample tools\n`);

    sampleTools.forEach((tool, index) => {
      const toolData = tool.data as any;
      console.log(`\n=== Tool ${index + 1} ===`);
      console.log(`ID: ${tool.id}`);
      console.log(`Name: ${tool.name}`);
      console.log(`Category: ${tool.category}`);
      console.log(`\nData keys:`, Object.keys(toolData));
      console.log(`\nData sample:`, JSON.stringify(toolData, null, 2).substring(0, 500));
      console.log(`\nbaseline_score:`, tool.baselineScore);
      console.log(`delta_score:`, tool.deltaScore);
      console.log(`current_score:`, tool.currentScore);
    });

  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

if (require.main === module) {
  checkToolData()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { checkToolData };
