#!/usr/bin/env tsx

/**
 * npm Registry Metrics Collection Script
 * Collects download counts, version info, and metadata from npm registry
 *
 * Expected Coverage: 15-20 tools with npm packages
 *
 * Tools likely on npm:
 * - Continue.dev (@continuedev/continue)
 * - Aider (aider-chat CLI might not be npm)
 * - Various CLI tools and SDKs
 */

import { getDb } from "../lib/db/connection";
import { tools } from "../lib/db/schema";
import { sql } from "drizzle-orm";
// #95: the collector class lives in lib/metrics-collectors/ so the cron route can share it.
import { NpmMetricsCollector, type NpmMetrics } from "../lib/metrics-collectors/npm";

/**
 * Main execution
 */
async function main() {
  console.log("🚀 npm Registry Metrics Collection\n");
  console.log("Expected Coverage: 15-20 tools with npm packages\n");

  const collector = new NpmMetricsCollector();

  // Connect to database
  console.log("Step 1: Connecting to database...");
  const db = getDb();
  if (!db) {
    console.error("❌ Database connection not available");
    process.exit(1);
  }

  const allTools = await db.select().from(tools);
  console.log(`✅ Found ${allTools.length} tools in database\n`);

  // Determine mode
  const testMode = process.argv.includes("--test");
  const fullMode = process.argv.includes("--full");

  if (!testMode && !fullMode) {
    console.log("Step 2: Preview mode - use --test or --full to collect metrics\n");
    console.log("Commands:");
    console.log("  npx tsx scripts/collect-npm-metrics.ts --test   # Test on 5 tools");
    console.log("  npx tsx scripts/collect-npm-metrics.ts --full   # Run on all tools");
    return;
  }

  console.log("Step 2: Collecting npm registry metrics...\n");
  const toolsToProcess = testMode ? allTools.slice(0, 5) : allTools;
  console.log(`Processing ${toolsToProcess.length} tools...\n`);

  const results: Array<{
    tool: string;
    slug: string;
    status: "success" | "not_found" | "failed";
    metrics?: NpmMetrics;
    error?: string;
  }> = [];

  for (let i = 0; i < toolsToProcess.length; i++) {
    const tool = toolsToProcess[i];
    console.log(`[${i + 1}/${toolsToProcess.length}] ${tool.name} (${tool.slug})`);

    try {
      const toolData = tool.data as any;
      const metrics = await collector.findPackageForTool(tool.name, tool.slug, toolData);

      if (metrics) {
        console.log(`   ✅ Success!`);
        console.log(`      Package: ${metrics.package_name}`);
        console.log(`      Downloads (month): ${metrics.downloads_last_month.toLocaleString()}`);
        console.log(`      Downloads (week): ${metrics.downloads_last_week.toLocaleString()}`);
        console.log(`      Version: ${metrics.current_version}`);
        console.log(`      License: ${metrics.license}`);

        // Update database
        const currentData = toolData;
        const updatedData = {
          ...currentData,
          metrics: {
            ...(currentData.metrics || {}),
            npm: metrics,
          },
        };

        await db
          .update(tools)
          .set({
            data: updatedData as any,
            updatedAt: new Date(),
          })
          .where(sql`id = ${tool.id}`);

        console.log(`   💾 Stored in database`);
        results.push({ tool: tool.name, slug: tool.slug, status: "success", metrics });
      } else {
        console.log(`   ⚠️  No npm package found`);
        results.push({
          tool: tool.name,
          slug: tool.slug,
          status: "not_found",
        });
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error}`);
      results.push({
        tool: tool.name,
        slug: tool.slug,
        status: "failed",
        error: String(error),
      });
    }

    console.log("");
    await collector.delay();
  }

  // Summary report
  console.log("\n" + "=".repeat(80));
  console.log("📊 NPM REGISTRY COLLECTION REPORT");
  console.log("=".repeat(80));
  console.log(`Total tools in database: ${allTools.length}`);
  console.log(`Tools processed: ${toolsToProcess.length}`);
  console.log(`Packages found: ${results.filter((r) => r.status === "success").length}`);
  console.log(`Not found: ${results.filter((r) => r.status === "not_found").length}`);
  console.log(`Failed: ${results.filter((r) => r.status === "failed").length}`);
  console.log("");

  const successfulResults = results.filter((r) => r.status === "success");
  if (successfulResults.length > 0) {
    const totalDownloadsMonth = successfulResults.reduce(
      (sum, r) => sum + (r.metrics?.downloads_last_month || 0),
      0
    );
    const totalDownloadsWeek = successfulResults.reduce(
      (sum, r) => sum + (r.metrics?.downloads_last_week || 0),
      0
    );

    console.log("📈 Metrics Summary:");
    console.log(`   Total monthly downloads: ${totalDownloadsMonth.toLocaleString()}`);
    console.log(`   Total weekly downloads: ${totalDownloadsWeek.toLocaleString()}`);
    console.log("");

    console.log("🏆 Top Packages by Monthly Downloads:");
    console.log("─".repeat(80));
    successfulResults
      .sort((a, b) => (b.metrics?.downloads_last_month || 0) - (a.metrics?.downloads_last_month || 0))
      .slice(0, 10)
      .forEach((result, idx) => {
        console.log(`${idx + 1}. ${result.tool} (${result.slug})`);
        console.log(`   Package: ${result.metrics?.package_name}`);
        console.log(
          `   Monthly downloads: ${result.metrics?.downloads_last_month.toLocaleString()}`
        );
        console.log(
          `   Weekly downloads: ${result.metrics?.downloads_last_week.toLocaleString()}`
        );
        console.log(`   Version: ${result.metrics?.current_version}`);
        console.log("");
      });
  }

  const coverage = ((successfulResults.length / allTools.length) * 100).toFixed(1);
  console.log(`✅ npm registry metrics collection complete!`);
  console.log(`   Coverage: ${coverage}% (${successfulResults.length}/${allTools.length} tools)`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
