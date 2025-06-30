#!/usr/bin/env tsx
/**
 * Update Tool Launch Dates
 * Updates tools with actual launch dates from research
 */

import { getToolsRepo } from "../lib/json-db";
import { loggers } from "../lib/logger";

// Launch dates from comprehensive report
const launchDates: Record<string, string> = {
  // Code Editors
  Cursor: "2023-05-01", // May 2023 (beta)
  Windsurf: "2024-11-13", // Nov 13, 2024
  "Zed AI": "2024-08-01", // Aug 2024 (AI features)

  // Autonomous Agents
  "Claude Code": "2024-12-15", // Dec 2024/Jan 2025
  Devin: "2024-03-12", // March 12, 2024
  "Google Jules": "2024-12-11", // Dec 11, 2024
  "SWE-agent": "2024-03-01", // March 2024

  // Full-Stack Builders
  "Replit Agent": "2024-09-26", // Sept 26, 2024
  "Bolt.new": "2024-10-01", // Oct 2024
  v0: "2023-10-01", // Oct 2023 beta
  Lovable: "2025-01-13", // Jan 13, 2025 (rebrand)

  // IDE-Integrated
  "GitHub Copilot": "2021-06-01", // June 2021
  "Gemini Code Assist": "2024-02-01", // Feb 2024

  // Specialized
  "Continue.dev": "2023-01-01", // 2023
  Cline: "2024-01-01", // 2024

  // Additional tools
  Magic: "2023-01-01", // 2023
  Augment: "2024-01-01", // 2024
  Poolside: "2023-01-01", // 2023
  Qodo: "2022-01-01", // 2022, rebrand 2024
  "Warp Agent": "2024-01-01", // 2024
  "EPAM AI/Run": "2024-01-01", // 2024-2025

  // Common variations/aliases
  "Codeium Windsurf": "2024-11-13",
  "GPT Engineer": "2023-06-01", // Before Lovable rebrand
  Codium: "2022-01-01", // Before Qodo rebrand
};

async function updateLaunchDates() {
  try {
    const toolsRepo = getToolsRepo();
    const tools = await toolsRepo.getAll();

    let updatedCount = 0;
    let notFoundTools: string[] = [];

    for (const [toolName, launchDate] of Object.entries(launchDates)) {
      // Find tool by name (case-insensitive)
      const tool = tools.find(
        (t) =>
          t.name.toLowerCase() === toolName.toLowerCase() ||
          t.name.toLowerCase().includes(toolName.toLowerCase()) ||
          toolName.toLowerCase().includes(t.name.toLowerCase())
      );

      if (tool) {
        // Update the tool with launch date
        const updatedTool = {
          ...tool,
          launch_date: launchDate,
          updated_at: new Date().toISOString(),
        };

        await toolsRepo.upsert(updatedTool);
        console.log(`✓ Updated ${tool.name} with launch date: ${launchDate}`);
        updatedCount++;
      } else {
        notFoundTools.push(toolName);
      }
    }

    console.log(`\n✅ Updated ${updatedCount} tools with launch dates`);

    if (notFoundTools.length > 0) {
      console.log(`\n⚠️  Tools not found in database:`);
      notFoundTools.forEach((name) => console.log(`   - ${name}`));
    }

    // List tools without launch dates
    const toolsWithoutLaunchDate = tools.filter((t) => !t.launch_date && !launchDates[t.name]);
    if (toolsWithoutLaunchDate.length > 0) {
      console.log(`\n📋 Tools still needing launch dates:`);
      toolsWithoutLaunchDate.forEach((t) => console.log(`   - ${t.name} (ID: ${t.id})`));
    }
  } catch (error) {
    console.error("Failed to update launch dates:", error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  updateLaunchDates()
    .then(() => {
      console.log("\n✅ Launch date update completed!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Update failed:", error);
      process.exit(1);
    });
}
