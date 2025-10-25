#!/usr/bin/env tsx

/**
 * Batch Update Script for Phase 3 Open Source AI Coding Tools
 *
 * This script runs all Phase 3 tool content updates in sequence:
 * 1. Aider (existing)
 * 2. Continue (MISSING - will show error, needs creation)
 * 3. Google Gemini CLI (existing)
 * 4. Qwen Code (existing)
 * 5. Mentat (MISSING - will show error, needs creation)
 * 6. Open Interpreter (MISSING - will show error, needs creation)
 *
 * Usage: npx tsx scripts/update-phase3-tools-batch.ts
 */

import { execSync } from "child_process";
import { closeDb } from "@/lib/db/connection";

interface UpdateResult {
  tool: string;
  slug: string;
  success: boolean;
  message: string;
  duration: number;
}

const PHASE3_TOOLS = [
  {
    name: "Aider",
    slug: "aider",
    script: "scripts/update-aider-content.ts",
    status: "existing",
  },
  {
    name: "Continue",
    slug: "continue",
    script: "scripts/update-continue-content.ts",
    status: "missing",
  },
  {
    name: "Google Gemini CLI",
    slug: "google-gemini-cli",
    script: "scripts/update-google-gemini-cli-content.ts",
    status: "existing",
  },
  {
    name: "Qwen Code",
    slug: "qwen-code",
    script: "scripts/update-qwen-code-content.ts",
    status: "existing",
  },
  {
    name: "Mentat",
    slug: "mentat",
    script: "scripts/update-mentat-content.ts",
    status: "missing",
  },
  {
    name: "Open Interpreter",
    slug: "open-interpreter",
    script: "scripts/update-open-interpreter-content.ts",
    status: "missing",
  },
];

function runScript(scriptPath: string): { success: boolean; output: string; duration: number } {
  const startTime = Date.now();
  try {
    const output = execSync(`npx tsx ${scriptPath}`, {
      encoding: "utf-8",
      stdio: "pipe",
    });
    const duration = Date.now() - startTime;
    return { success: true, output, duration };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    return {
      success: false,
      output: error.stdout || error.stderr || error.message,
      duration,
    };
  }
}

async function main() {
  console.log("🚀 Phase 3 Open Source Tools - Batch Update");
  console.log("=".repeat(80));
  console.log(`\nUpdating ${PHASE3_TOOLS.length} open source AI coding tools...\n`);

  const results: UpdateResult[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < PHASE3_TOOLS.length; i++) {
    const tool = PHASE3_TOOLS[i];
    console.log(`\n[${ i + 1}/${PHASE3_TOOLS.length}] Processing: ${tool.name}`);
    console.log("-".repeat(80));
    console.log(`  Slug: ${tool.slug}`);
    console.log(`  Status: ${tool.status.toUpperCase()}`);
    console.log(`  Script: ${tool.script}`);

    if (tool.status === "missing") {
      console.log(`  ⚠️  WARNING: This tool is not in the database yet!`);
      console.log(`  The update script will fail - tool needs to be created first.`);
    }

    console.log(`\n  Running update script...`);

    const result = runScript(tool.script);

    const updateResult: UpdateResult = {
      tool: tool.name,
      slug: tool.slug,
      success: result.success,
      message: result.success ? "Updated successfully" : "Update failed",
      duration: result.duration,
    };

    results.push(updateResult);

    if (result.success) {
      successCount++;
      console.log(`  ✅ SUCCESS (${(result.duration / 1000).toFixed(2)}s)`);
    } else {
      failureCount++;
      console.log(`  ❌ FAILED (${(result.duration / 1000).toFixed(2)}s)`);
      if (tool.status === "missing") {
        console.log(`  ℹ️  Expected failure - tool not in database`);
      }
    }

    // Show abbreviated output
    const lines = result.output.split("\n");
    const importantLines = lines.filter(
      (line) =>
        line.includes("✅") ||
        line.includes("❌") ||
        line.includes("Found tool:") ||
        line.includes("Tool not found") ||
        line.includes("Successfully updated") ||
        line.includes("GitHub stars:")
    );

    if (importantLines.length > 0) {
      console.log(`\n  Key output:`);
      importantLines.slice(0, 5).forEach((line) => {
        console.log(`    ${line.trim()}`);
      });
    }
  }

  // Summary report
  console.log("\n" + "=".repeat(80));
  console.log("\n📊 BATCH UPDATE SUMMARY");
  console.log("=".repeat(80));
  console.log(`\nTotal tools processed: ${PHASE3_TOOLS.length}`);
  console.log(`✅ Successful updates: ${successCount}`);
  console.log(`❌ Failed updates: ${failureCount}`);

  console.log(`\n📋 Detailed Results:\n`);

  results.forEach((result, index) => {
    const status = result.success ? "✅ SUCCESS" : "❌ FAILED";
    const duration = (result.duration / 1000).toFixed(2);
    console.log(`  ${index + 1}. ${result.tool.padEnd(20)} ${status.padEnd(12)} (${duration}s)`);
  });

  // Missing tools notice
  const missingTools = PHASE3_TOOLS.filter((t) => t.status === "missing");
  if (missingTools.length > 0) {
    console.log(`\n⚠️  MISSING TOOLS (${missingTools.length}):`);
    console.log("=".repeat(80));
    console.log(`\nThe following tools are not in the database and need to be created:\n`);
    missingTools.forEach((tool) => {
      console.log(`  - ${tool.name} (${tool.slug})`);
    });
    console.log(`\n📋 Next Steps:`);
    console.log(`  1. Add these tools to the database manually or via admin script`);
    console.log(`  2. Re-run the individual update scripts for these tools`);
    console.log(`  3. Or re-run this batch script after adding them`);
  }

  // Success tools summary
  const existingTools = PHASE3_TOOLS.filter((t) => t.status === "existing");
  if (existingTools.length > 0) {
    console.log(`\n✅ UPDATED TOOLS (${successCount}/${existingTools.length} existing):`);
    console.log("=".repeat(80));
    results
      .filter((r) => r.success)
      .forEach((result) => {
        console.log(`  ✓ ${result.tool} - ${result.message}`);
      });
  }

  console.log("\n" + "=".repeat(80));
  console.log("\n🎯 Phase 3 batch update completed!");
  console.log(`\nTotal execution time: ${results.reduce((sum, r) => sum + r.duration, 0) / 1000}s`);
  console.log("\n" + "=".repeat(80));

  return {
    totalTools: PHASE3_TOOLS.length,
    successCount,
    failureCount,
    results,
  };
}

// Run the batch update
main()
  .then((summary) => {
    console.log("\n✨ Batch update process completed!\n");
    process.exit(summary.failureCount > 0 ? 1 : 0);
  })
  .catch((error) => {
    console.error("\n❌ Fatal error during batch update:", error);
    process.exit(1);
  })
  .finally(() => {
    closeDb();
  });
