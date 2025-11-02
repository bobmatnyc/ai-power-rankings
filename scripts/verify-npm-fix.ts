#!/usr/bin/env tsx

/**
 * Verify npm Data Quality Fix
 * Compares current state with expected corrections
 */

import { getDb } from "../lib/db/connection";
import { tools } from "../lib/db/schema";
import { inArray } from "drizzle-orm";

async function main() {
  console.log("=== NPM DATA QUALITY FIX VERIFICATION ===\n");

  const db = getDb();

  // Tools that should have npm data removed
  const shouldNotHaveNpm = [
    "chatgpt-canvas",
    "gemini-code-assist",
    "jetbrains-ai",
    "gitlab-duo-agent-platform",
    "warp",
    "zed",
    "lovable",
    "bolt-new",
    "replit-agent",
    "trae-ai",
    "qoder",
    "kiro",
    "microsoft-agentic-devops",
    "refact-ai",
  ];

  // Tools that should have correct npm data
  const shouldHaveNpm = [
    { slug: "claude-code", package: "claude-code" },
    { slug: "github-copilot", package: "@github/copilot" },
    { slug: "cline", package: "cline" },
    { slug: "augment-code", package: "@augmentcode/auggie" },
    { slug: "sourcegraph-cody", package: "@sourcegraph/cody" },
    { slug: "gitlab-duo", package: "@gitlab/duo-cli" },
  ];

  console.log("1. VERIFYING REMOVED NPM DATA\n");

  const toolsToCheck = await db.select().from(tools).where(inArray(tools.slug, shouldNotHaveNpm));

  let removedCount = 0;
  let stillHasNpmCount = 0;

  for (const tool of toolsToCheck) {
    const data = tool.data as any;
    const hasNpm = data?.metrics?.npm;

    if (hasNpm) {
      console.log(`❌ ${tool.slug} - Still has npm data (${data.metrics.npm.package_name})`);
      stillHasNpmCount++;
    } else {
      console.log(`✅ ${tool.slug} - npm data removed`);
      removedCount++;
    }
  }

  console.log(`\n✓ Removed: ${removedCount}/${shouldNotHaveNpm.length}`);
  if (stillHasNpmCount > 0) {
    console.log(`⚠️  Still has npm: ${stillHasNpmCount}`);
  }

  console.log("\n2. VERIFYING CORRECT NPM DATA\n");

  let correctCount = 0;
  let incorrectCount = 0;

  for (const expected of shouldHaveNpm) {
    const [tool] = await db
      .select()
      .from(tools)
      .where(inArray(tools.slug, [expected.slug]))
      .limit(1);

    if (tool) {
      const data = tool.data as any;
      const npm = data?.metrics?.npm;

      if (npm && npm.package_name === expected.package) {
        console.log(
          `✅ ${expected.slug} - Correct (${npm.package_name}, ${npm.downloads_last_month.toLocaleString()} downloads)`
        );
        correctCount++;
      } else if (npm) {
        console.log(
          `❌ ${expected.slug} - Wrong package (expected ${expected.package}, got ${npm.package_name})`
        );
        incorrectCount++;
      } else {
        console.log(`⚠️  ${expected.slug} - No npm data`);
        incorrectCount++;
      }
    }
  }

  console.log(`\n✓ Correct: ${correctCount}/${shouldHaveNpm.length}`);
  if (incorrectCount > 0) {
    console.log(`⚠️  Incorrect: ${incorrectCount}`);
  }

  console.log("\n3. OVERALL STATISTICS\n");

  const allTools = await db.select().from(tools);
  const toolsWithNpm = allTools.filter((tool) => {
    const data = tool.data as any;
    return data?.metrics?.npm;
  });

  const totalDownloads = toolsWithNpm.reduce((sum, tool) => {
    const data = tool.data as any;
    return sum + (data.metrics.npm.downloads_last_month || 0);
  }, 0);

  console.log(`Total tools: ${allTools.length}`);
  console.log(`Tools with npm data: ${toolsWithNpm.length}`);
  console.log(`Total downloads: ${totalDownloads.toLocaleString()}`);
  console.log(
    `Average downloads per tool: ${Math.round(totalDownloads / toolsWithNpm.length).toLocaleString()}`
  );

  console.log("\n4. TOP 5 TOOLS BY NPM DOWNLOADS\n");

  const sortedByNpm = toolsWithNpm
    .sort((a, b) => {
      const aData = a.data as any;
      const bData = b.data as any;
      return bData.metrics.npm.downloads_last_month - aData.metrics.npm.downloads_last_month;
    })
    .slice(0, 5);

  sortedByNpm.forEach((tool, idx) => {
    const data = tool.data as any;
    const npm = data.metrics.npm;
    console.log(`${idx + 1}. ${tool.name} (${tool.slug})`);
    console.log(`   Package: ${npm.package_name}`);
    console.log(`   Downloads: ${npm.downloads_last_month.toLocaleString()}`);
    console.log("");
  });

  console.log("=== VERIFICATION COMPLETE ===\n");

  if (removedCount === shouldNotHaveNpm.length && correctCount === shouldHaveNpm.length) {
    console.log("✅ All corrections verified successfully!");
    console.log(`   Removed: ${removedCount} incorrect mappings`);
    console.log(`   Verified: ${correctCount} correct mappings`);
    console.log(`   Total downloads now: ${totalDownloads.toLocaleString()} (all legitimate)`);
  } else {
    console.log("⚠️  Some issues detected. Review output above.");
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
