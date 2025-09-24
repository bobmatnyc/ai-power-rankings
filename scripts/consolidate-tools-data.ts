#!/usr/bin/env tsx

/**
 * Consolidate tools data from individual files into tools.json
 * This ensures all technical data is available for the ranking algorithm
 */

import path from "node:path";
import fs from "fs-extra";

async function consolidateTools() {
  const dataDir = path.join(process.cwd(), "data/json/tools");
  const individualDir = path.join(dataDir, "individual");
  const toolsJsonPath = path.join(dataDir, "tools.json");

  console.log("Consolidating tools data...");

  // Read all individual tool files
  const files = await fs.readdir(individualDir);
  const toolFiles = files.filter((f) => f.endsWith(".json"));

  const tools: any[] = [];

  for (const file of toolFiles) {
    const filePath = path.join(individualDir, file);
    const tool = await fs.readJson(filePath);
    tools.push(tool);
  }

  // Sort tools by ID
  tools.sort((a, b) => parseInt(a.id, 10) - parseInt(b.id, 10));

  // Create the consolidated data structure
  const toolsData = {
    tools,
    metadata: {
      total: tools.length,
      last_updated: new Date().toISOString(),
      version: "2.0.0",
    },
  };

  // Save to tools.json
  await fs.writeJson(toolsJsonPath, toolsData, { spaces: 2 });

  console.log(`✅ Consolidated ${tools.length} tools into tools.json`);

  // Verify Claude Code has technical data
  const claudeCode = tools.find((t) => t.id === "4");
  if (claudeCode) {
    console.log("\nClaude Code technical data check:");
    console.log("- Context Window:", claudeCode.info?.technical?.context_window || "MISSING");
    console.log(
      "- Language Support:",
      claudeCode.info?.technical?.language_support?.length || "MISSING"
    );
    console.log("- LLM Providers:", claudeCode.info?.technical?.llm_providers?.length || "MISSING");
  }
}

consolidateTools().catch(console.error);
