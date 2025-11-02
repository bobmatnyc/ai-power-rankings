#!/usr/bin/env tsx

import { getDb, closeDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function checkMetricsStructure() {
  const db = getDb();

  // Check Cursor data structure
  const cursor = await db.select().from(tools).where(eq(tools.slug, "cursor")).limit(1);
  const data = cursor[0].data as any;

  console.log("\n=== CURSOR DATA STRUCTURE ===");
  console.log("");

  console.log("📍 Checking NEW metrics locations (data.metrics.*):");
  console.log("  data.metrics.github.stars:", data.metrics?.github?.stars);
  console.log("  data.metrics.vscode.installs:", data.metrics?.vscode?.installs);
  console.log("  data.metrics.npm.downloads_last_month:", data.metrics?.npm?.downloads_last_month);
  console.log("  data.metrics.pypi.downloads_last_month:", data.metrics?.pypi?.downloads_last_month);
  console.log("");

  console.log("📍 Checking LEGACY locations (data.info.*):");
  console.log("  data.info.metrics.github_stars:", data.info?.metrics?.github_stars);
  console.log("  data.info.github_stats.stars:", data.info?.github_stats?.stars);
  console.log("  data.info.vscode_installs:", data.info?.vscode_installs);
  console.log("  data.info.npm_downloads:", data.info?.npm_downloads);
  console.log("");

  if (data.metrics) {
    console.log("📦 Full metrics object:");
    console.log(JSON.stringify(data.metrics, null, 2));
  } else {
    console.log("⚠️  No metrics object found at data.metrics");
  }

  // Check a few more tools
  console.log("\n\n=== CHECKING MORE TOOLS ===");

  const allTools = await db.select().from(tools).limit(5);

  for (const tool of allTools) {
    const toolData = tool.data as any;
    const hasNewMetrics = !!toolData.metrics;
    const hasVscode = !!toolData.metrics?.vscode;
    const hasNpm = !!toolData.metrics?.npm;
    const hasGithub = !!toolData.metrics?.github;

    console.log(`\n${tool.slug}:`);
    console.log(`  Has metrics object: ${hasNewMetrics}`);
    if (hasNewMetrics) {
      console.log(`  - GitHub: ${hasGithub} (stars: ${toolData.metrics?.github?.stars})`);
      console.log(`  - VS Code: ${hasVscode} (installs: ${toolData.metrics?.vscode?.installs})`);
      console.log(`  - npm: ${hasNpm} (downloads: ${toolData.metrics?.npm?.downloads_last_month})`);
    }
  }

  await closeDb();
}

checkMetricsStructure();
