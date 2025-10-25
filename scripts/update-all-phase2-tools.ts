#!/usr/bin/env tsx

/**
 * Batch Update All Phase 2 Enterprise AI Coding Tools
 *
 * This script runs all Phase 2 tool content updates in sequence:
 * 1. JetBrains AI Assistant
 * 2. Amazon Q Developer
 * 3. Google Gemini Code Assist
 * 4. Sourcegraph Cody
 * 5. Tabnine
 * 6. Pieces for Developers
 * 7. Windsurf
 *
 * Run with: npm run tsx scripts/update-all-phase2-tools.ts
 */

import { exec } from "child_process";
import { promisify } from "util";
import * as path from "path";

const execAsync = promisify(exec);

// Define all Phase 2 tool update scripts
const PHASE2_SCRIPTS = [
  {
    name: "JetBrains AI Assistant",
    slug: "jetbrains-ai",
    script: "update-jetbrains-ai-assistant-content.ts",
    category: "Enterprise IDE Integration"
  },
  {
    name: "Amazon Q Developer",
    slug: "amazon-q-developer",
    script: "update-amazon-q-developer-content.ts",
    category: "AWS Cloud Integration"
  },
  {
    name: "Google Gemini Code Assist",
    slug: "gemini-code-assist",
    script: "update-google-gemini-code-assist-content.ts",
    category: "GCP Cloud Integration"
  },
  {
    name: "Sourcegraph Cody",
    slug: "sourcegraph-cody",
    script: "update-sourcegraph-cody-content.ts",
    category: "Enterprise Code Intelligence"
  },
  {
    name: "Tabnine",
    slug: "tabnine",
    script: "update-tabnine-content.ts",
    category: "Privacy-First Enterprise AI"
  },
  {
    name: "Pieces for Developers",
    slug: "pieces-for-developers",
    script: "update-pieces-content.ts",
    category: "On-Device Developer Productivity"
  },
  {
    name: "Windsurf",
    slug: "windsurf",
    script: "update-windsurf-content.ts",
    category: "AI-Native IDE"
  }
];

interface UpdateResult {
  name: string;
  slug: string;
  success: boolean;
  duration: number;
  error?: string;
}

async function runScript(scriptPath: string, toolName: string): Promise<{ success: boolean; duration: number; error?: string }> {
  const startTime = Date.now();

  try {
    console.log(`\n${"=".repeat(80)}`);
    console.log(`🚀 Running: ${toolName}`);
    console.log(`${"=".repeat(80)}\n`);

    const { stdout, stderr } = await execAsync(`npx tsx ${scriptPath}`, {
      cwd: path.join(process.cwd()),
      maxBuffer: 1024 * 1024 * 10 // 10MB buffer
    });

    // Print output
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);

    const duration = Date.now() - startTime;
    return { success: true, duration };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`\n❌ Error running ${toolName}:`, error.message);
    if (error.stdout) console.log(error.stdout);
    if (error.stderr) console.error(error.stderr);
    return { success: false, duration, error: error.message };
  }
}

async function main() {
  console.log("\n");
  console.log("╔" + "═".repeat(78) + "╗");
  console.log("║" + " ".repeat(78) + "║");
  console.log("║" + "  🚀 PHASE 2 ENTERPRISE AI CODING TOOLS - BATCH UPDATE  ".padEnd(78) + "║");
  console.log("║" + " ".repeat(78) + "║");
  console.log("╚" + "═".repeat(78) + "╝");
  console.log("\n");

  console.log("📋 Tools to update:");
  PHASE2_SCRIPTS.forEach((script, index) => {
    console.log(`   ${index + 1}. ${script.name.padEnd(30)} (${script.category})`);
  });
  console.log("\n");

  const results: UpdateResult[] = [];
  const startTime = Date.now();

  // Run each script in sequence
  for (const script of PHASE2_SCRIPTS) {
    const scriptPath = path.join(process.cwd(), "scripts", script.script);
    const result = await runScript(scriptPath, script.name);

    results.push({
      name: script.name,
      slug: script.slug,
      success: result.success,
      duration: result.duration,
      error: result.error
    });

    // Short pause between scripts
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  const totalDuration = Date.now() - startTime;

  // Print summary
  console.log("\n");
  console.log("╔" + "═".repeat(78) + "╗");
  console.log("║" + " ".repeat(78) + "║");
  console.log("║" + "  📊 BATCH UPDATE SUMMARY  ".padEnd(78) + "║");
  console.log("║" + " ".repeat(78) + "║");
  console.log("╚" + "═".repeat(78) + "╝");
  console.log("\n");

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`Total tools processed: ${results.length}`);
  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏱️  Total time: ${(totalDuration / 1000).toFixed(2)}s`);
  console.log("\n");

  // Detailed results
  console.log("📋 Detailed Results:\n");
  results.forEach((result, index) => {
    const status = result.success ? "✅" : "❌";
    const time = (result.duration / 1000).toFixed(2);
    console.log(`${index + 1}. ${status} ${result.name.padEnd(30)} (${time}s)`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });

  console.log("\n");

  if (failed > 0) {
    console.log("⚠️  Some updates failed. Please check the logs above for details.\n");
    process.exit(1);
  } else {
    console.log("✨ All Phase 2 tools updated successfully!\n");
    console.log("📝 Next steps:");
    console.log("   1. Verify the updates in the database");
    console.log("   2. Test the tool pages on the website");
    console.log("   3. Review the content for accuracy");
    console.log("   4. Commit the changes to git");
    console.log("\n");
  }
}

// Run the batch update
main()
  .catch((error) => {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  });
