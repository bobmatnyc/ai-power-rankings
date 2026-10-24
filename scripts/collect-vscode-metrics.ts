#!/usr/bin/env tsx

/**
 * VS Code Marketplace Metrics Collection Script
 * Collects install counts, ratings, and metadata from VS Code Marketplace
 *
 * Expected Coverage: 20-25 tools with VS Code extensions
 *
 * Tools likely to have VS Code extensions:
 * - GitHub Copilot, Cursor, Continue.dev, Cline, Tabnine, Codeium, CodeGeeX
 * - JetBrains AI, Claude Code, WindSurf, Aider, Sourcegraph Cody
 * - Amazon Q Developer, GitLab Duo, Qodo Gen, Snyk Code
 */

import { getDb } from "../lib/db/connection";
import { tools } from "../lib/db/schema";
import { sql } from "drizzle-orm";
// #95: the collector class lives in lib/metrics-collectors/ so the cron route can share it.
import { VSCodeMarketplaceCollector, type VSCodeMetrics } from "../lib/metrics-collectors/vscode";

/**
 * Main execution
 */
async function main() {
  console.log("🚀 VS Code Marketplace Metrics Collection\n");
  console.log("Expected Coverage: 20-25 tools with VS Code extensions\n");

  const collector = new VSCodeMarketplaceCollector();

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
    console.log(
      "  npx tsx scripts/collect-vscode-metrics.ts --test   # Test on 5 tools"
    );
    console.log(
      "  npx tsx scripts/collect-vscode-metrics.ts --full   # Run on all tools"
    );
    console.log("\nLikely candidates for VS Code extensions:");
    const likelyCandidates = [
      "GitHub Copilot",
      "Cursor",
      "Continue",
      "Cline",
      "Tabnine",
      "Codeium",
      "CodeGeeX",
      "Claude Code",
      "WindSurf",
      "Aider",
      "Sourcegraph Cody",
      "Amazon Q Developer",
      "GitLab Duo",
      "Qodo Gen",
      "Snyk Code",
    ];
    likelyCandidates.forEach((name, i) => {
      console.log(`  ${i + 1}. ${name}`);
    });
    return;
  }

  console.log("Step 2: Collecting VS Code Marketplace metrics...\n");
  const toolsToProcess = testMode ? allTools.slice(0, 5) : allTools;
  console.log(`Processing ${toolsToProcess.length} tools...\n`);

  const results: Array<{
    tool: string;
    slug: string;
    status: "success" | "not_found" | "failed";
    metrics?: VSCodeMetrics;
    error?: string;
  }> = [];

  for (let i = 0; i < toolsToProcess.length; i++) {
    const tool = toolsToProcess[i];
    console.log(`[${i + 1}/${toolsToProcess.length}] ${tool.name} (${tool.slug})`);

    try {
      const toolData = tool.data as any;
      const metrics = await collector.findExtensionForTool(
        tool.name,
        tool.slug,
        toolData
      );

      if (metrics) {
        console.log(`   ✅ Success!`);
        console.log(`      Extension: ${metrics.extension_id}`);
        console.log(`      Installs: ${metrics.installs.toLocaleString()}`);
        console.log(`      Rating: ${metrics.rating.toFixed(1)} (${metrics.ratings_count} ratings)`);
        console.log(`      Version: ${metrics.version}`);
        console.log(`      Updated: ${new Date(metrics.last_updated).toLocaleDateString()}`);

        // Update database
        const currentData = toolData;
        const updatedData = {
          ...currentData,
          metrics: {
            ...(currentData.metrics || {}),
            vscode: metrics,
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
        console.log(`   ⚠️  No VS Code extension found`);
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
    // Rate limiting delay
    await collector.delay();
  }

  // Summary report
  console.log("\n" + "=".repeat(80));
  console.log("📊 VS CODE MARKETPLACE COLLECTION REPORT");
  console.log("=".repeat(80));
  console.log(`Total tools in database: ${allTools.length}`);
  console.log(`Tools processed: ${toolsToProcess.length}`);
  console.log(`Extensions found: ${results.filter((r) => r.status === "success").length}`);
  console.log(`Not found: ${results.filter((r) => r.status === "not_found").length}`);
  console.log(`Failed: ${results.filter((r) => r.status === "failed").length}`);
  console.log("");

  const successfulResults = results.filter((r) => r.status === "success");
  if (successfulResults.length > 0) {
    const totalInstalls = successfulResults.reduce(
      (sum, r) => sum + (r.metrics?.installs || 0),
      0
    );
    const avgRating =
      successfulResults.reduce((sum, r) => sum + (r.metrics?.rating || 0), 0) /
      successfulResults.length;

    console.log("📈 Metrics Summary:");
    console.log(`   Total installs across all extensions: ${totalInstalls.toLocaleString()}`);
    console.log(`   Average rating: ${avgRating.toFixed(2)}`);
    console.log("");

    console.log("🏆 Top Extensions by Installs:");
    console.log("─".repeat(80));
    successfulResults
      .sort((a, b) => (b.metrics?.installs || 0) - (a.metrics?.installs || 0))
      .slice(0, 10)
      .forEach((result, idx) => {
        console.log(`${idx + 1}. ${result.tool} (${result.slug})`);
        console.log(`   Extension: ${result.metrics?.extension_id}`);
        console.log(`   Installs: ${result.metrics?.installs.toLocaleString()}`);
        console.log(
          `   Rating: ${result.metrics?.rating.toFixed(1)}/5.0 (${result.metrics?.ratings_count} ratings)`
        );
        console.log("");
      });
  }

  if (results.some((r) => r.status === "not_found")) {
    console.log("❓ Tools without VS Code extensions:");
    console.log("─".repeat(80));
    results
      .filter((r) => r.status === "not_found")
      .slice(0, 20)
      .forEach((result) => {
        console.log(`   • ${result.tool} (${result.slug})`);
      });
    console.log("");
  }

  if (results.some((r) => r.status === "failed")) {
    console.log("❌ Failed tools:");
    console.log("─".repeat(80));
    results
      .filter((r) => r.status === "failed")
      .forEach((result) => {
        console.log(`   • ${result.tool}: ${result.error}`);
      });
    console.log("");
  }

  const coverage = ((successfulResults.length / allTools.length) * 100).toFixed(1);
  console.log(`✅ VS Code Marketplace metrics collection complete!`);
  console.log(`   Coverage: ${coverage}% (${successfulResults.length}/${allTools.length} tools)`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
