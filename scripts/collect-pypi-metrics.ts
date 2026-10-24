#!/usr/bin/env tsx

/**
 * PyPI (Python Package Index) Metrics Collection Script
 * Collects download counts, version info, and metadata from PyPI
 *
 * Expected Coverage: 5-10 tools with PyPI packages
 *
 * Tools likely on PyPI:
 * - aider-chat
 * - gpt-engineer
 * - openai (CLI/SDK)
 * - anthropic (SDK)
 */

import { getDb } from "../lib/db/connection";
import { tools } from "../lib/db/schema";
import { sql } from "drizzle-orm";
// #95: the collector class lives in lib/metrics-collectors/ so the cron route can share it.
import { PyPIMetricsCollector, type PyPIMetrics } from "../lib/metrics-collectors/pypi";

/**
 * Main execution
 */
async function main() {
  console.log("🚀 PyPI Metrics Collection\n");
  console.log("Expected Coverage: 5-10 tools with PyPI packages\n");

  const collector = new PyPIMetricsCollector();

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
    console.log("  npx tsx scripts/collect-pypi-metrics.ts --test   # Test on 5 tools");
    console.log("  npx tsx scripts/collect-pypi-metrics.ts --full   # Run on all tools");
    return;
  }

  console.log("Step 2: Collecting PyPI metrics...\n");
  const toolsToProcess = testMode ? allTools.slice(0, 5) : allTools;
  console.log(`Processing ${toolsToProcess.length} tools...\n`);

  const results: Array<{
    tool: string;
    slug: string;
    status: "success" | "not_found" | "failed";
    metrics?: PyPIMetrics;
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
        console.log(`      Version: ${metrics.current_version}`);
        console.log(`      Python: ${metrics.python_version || "any"}`);
        console.log(`      License: ${metrics.license}`);

        // Update database
        const currentData = toolData;
        const updatedData = {
          ...currentData,
          metrics: {
            ...(currentData.metrics || {}),
            pypi: metrics,
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
        console.log(`   ⚠️  No PyPI package found`);
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
  console.log("📊 PYPI COLLECTION REPORT");
  console.log("=".repeat(80));
  console.log(`Total tools in database: ${allTools.length}`);
  console.log(`Tools processed: ${toolsToProcess.length}`);
  console.log(`Packages found: ${results.filter((r) => r.status === "success").length}`);
  console.log(`Not found: ${results.filter((r) => r.status === "not_found").length}`);
  console.log(`Failed: ${results.filter((r) => r.status === "failed").length}`);
  console.log("");

  const successfulResults = results.filter((r) => r.status === "success");
  if (successfulResults.length > 0) {
    const totalDownloads = successfulResults.reduce(
      (sum, r) => sum + (r.metrics?.downloads_last_month || 0),
      0
    );

    console.log("📈 Metrics Summary:");
    console.log(`   Total monthly downloads: ${totalDownloads.toLocaleString()}`);
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
        console.log(`   Version: ${result.metrics?.current_version}`);
        console.log(`   Python: ${result.metrics?.python_version || "any"}`);
        console.log("");
      });
  }

  const coverage = ((successfulResults.length / allTools.length) * 100).toFixed(1);
  console.log(`✅ PyPI metrics collection complete!`);
  console.log(`   Coverage: ${coverage}% (${successfulResults.length}/${allTools.length} tools)`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
