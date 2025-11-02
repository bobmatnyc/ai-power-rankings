#!/usr/bin/env tsx

/**
 * Inspect tools for package registry information
 */

import { getDb } from "../lib/db/connection";
import { tools } from "../lib/db/schema";

async function main() {
  console.log("🔍 Inspecting tools for package registry information\n");

  const db = getDb();
  if (!db) {
    console.error("❌ Database connection not available");
    process.exit(1);
  }

  const allTools = await db.select().from(tools).limit(15);
  console.log(`Analyzing ${allTools.length} sample tools...\n`);

  for (const tool of allTools) {
    console.log("=".repeat(80));
    console.log(`Tool: ${tool.name} (${tool.slug})`);
    const data = tool.data as any;

    // Check for package identifiers
    const packageFields = [
      "npm_package",
      "pypi_package",
      "vscode_extension",
      "extension_id",
      "package_name",
    ];
    let foundAny = false;
    packageFields.forEach((field) => {
      if (data[field]) {
        console.log(`  ${field}: ${data[field]}`);
        foundAny = true;
      }
      if (data.info && data.info[field]) {
        console.log(`  info.${field}: ${data.info[field]}`);
        foundAny = true;
      }
    });

    // Check for any metrics already
    if (data.metrics) {
      console.log(`  Has metrics: ${Object.keys(data.metrics).join(", ")}`);
      foundAny = true;
    }

    if (!foundAny) {
      console.log("  No package info or metrics found");
    }
    console.log("");
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
