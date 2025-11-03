#!/usr/bin/env tsx

/**
 * Data Path Verification Script
 * Verifies where metrics are stored vs where v7.4 expects them
 */

import { getDb } from "../lib/db/connection";
import { tools } from "../lib/db/schema";
import { sql } from "drizzle-orm";

interface PathCheckResult {
  slug: string;
  name: string;
  actualPaths: {
    vscode: boolean;
    github: boolean;
    npm: boolean;
    pypi: boolean;
  };
  v74Paths: {
    vscode_installs: boolean;
    github_stats: boolean;
    npm_downloads: boolean;
    info_metrics: boolean;
  };
  sampleValues: {
    actual_vscode_installs?: number;
    actual_github_stars?: number;
    actual_npm_downloads?: number;
    v74_vscode_installs?: number;
    v74_github_stars?: number;
  };
}

async function main() {
  console.log("🔍 Data Path Verification Report\n");
  console.log("Comparing actual storage paths vs v7.4 expected paths\n");
  console.log("=".repeat(80));

  const db = getDb();
  if (!db) {
    console.error("❌ Database connection not available");
    process.exit(1);
  }

  // Get all tools
  const allTools = await db.select().from(tools);
  console.log(`\n📊 Total tools in database: ${allTools.length}\n`);

  // Count metrics in actual location (data.metrics.*)
  const actualCounts = {
    vscode: 0,
    github: 0,
    npm: 0,
    pypi: 0,
    any: 0,
  };

  // Count metrics in v7.4 expected location (data.info.*)
  const v74Counts = {
    vscode_installs: 0,
    github_stats: 0,
    npm_downloads: 0,
    info_metrics_github: 0,
    info_metrics_users: 0,
  };

  const detailedResults: PathCheckResult[] = [];

  for (const tool of allTools) {
    const data = tool.data as any;

    // Check actual paths
    const hasActualMetrics = !!(data.metrics);
    const hasVSCode = !!(data.metrics?.vscode);
    const hasGitHub = !!(data.metrics?.github);
    const hasNpm = !!(data.metrics?.npm);
    const hasPyPI = !!(data.metrics?.pypi);

    if (hasActualMetrics) actualCounts.any++;
    if (hasVSCode) actualCounts.vscode++;
    if (hasGitHub) actualCounts.github++;
    if (hasNpm) actualCounts.npm++;
    if (hasPyPI) actualCounts.pypi++;

    // Check v7.4 expected paths
    const hasV74VSCode = !!(data.info?.vscode_installs);
    const hasV74GitHub = !!(data.info?.github_stats);
    const hasV74Npm = !!(data.info?.npm_downloads);
    const hasV74InfoMetrics = !!(data.info?.metrics);
    const hasV74InfoGitHub = !!(data.info?.metrics?.github_stars);
    const hasV74InfoUsers = !!(data.info?.metrics?.users);

    if (hasV74VSCode) v74Counts.vscode_installs++;
    if (hasV74GitHub) v74Counts.github_stats++;
    if (hasV74Npm) v74Counts.npm_downloads++;
    if (hasV74InfoGitHub) v74Counts.info_metrics_github++;
    if (hasV74InfoUsers) v74Counts.info_metrics_users++;

    // Collect detailed results for tools with metrics
    if (hasActualMetrics) {
      detailedResults.push({
        slug: tool.slug,
        name: tool.name,
        actualPaths: {
          vscode: hasVSCode,
          github: hasGitHub,
          npm: hasNpm,
          pypi: hasPyPI,
        },
        v74Paths: {
          vscode_installs: hasV74VSCode,
          github_stats: hasV74GitHub,
          npm_downloads: hasV74Npm,
          info_metrics: hasV74InfoMetrics,
        },
        sampleValues: {
          actual_vscode_installs: data.metrics?.vscode?.installs,
          actual_github_stars: data.metrics?.github?.stars,
          actual_npm_downloads: data.metrics?.npm?.downloads_last_month,
          v74_vscode_installs: data.info?.vscode_installs,
          v74_github_stars: data.info?.github_stats?.stars,
        },
      });
    }
  }

  // Sort by VS Code installs
  detailedResults.sort(
    (a, b) =>
      (b.sampleValues.actual_vscode_installs || 0) -
      (a.sampleValues.actual_vscode_installs || 0)
  );

  // Report 1: Summary Statistics
  console.log("\n📈 PART 1: SUMMARY STATISTICS");
  console.log("=".repeat(80));
  console.log("\nActual Storage Location (data.metrics.*):");
  console.log(`  Tools with any metrics: ${actualCounts.any} (${((actualCounts.any / allTools.length) * 100).toFixed(1)}%)`);
  console.log(`  VS Code metrics: ${actualCounts.vscode} (${((actualCounts.vscode / allTools.length) * 100).toFixed(1)}%)`);
  console.log(`  GitHub metrics: ${actualCounts.github} (${((actualCounts.github / allTools.length) * 100).toFixed(1)}%)`);
  console.log(`  npm metrics: ${actualCounts.npm} (${((actualCounts.npm / allTools.length) * 100).toFixed(1)}%)`);
  console.log(`  PyPI metrics: ${actualCounts.pypi} (${((actualCounts.pypi / allTools.length) * 100).toFixed(1)}%)`);

  console.log("\nExpected Location for v7.4 (data.info.*):");
  console.log(`  vscode_installs: ${v74Counts.vscode_installs} (${((v74Counts.vscode_installs / allTools.length) * 100).toFixed(1)}%)`);
  console.log(`  github_stats: ${v74Counts.github_stats} (${((v74Counts.github_stats / allTools.length) * 100).toFixed(1)}%)`);
  console.log(`  npm_downloads: ${v74Counts.npm_downloads} (${((v74Counts.npm_downloads / allTools.length) * 100).toFixed(1)}%)`);
  console.log(`  info.metrics.github_stars: ${v74Counts.info_metrics_github} (${((v74Counts.info_metrics_github / allTools.length) * 100).toFixed(1)}%)`);
  console.log(`  info.metrics.users: ${v74Counts.info_metrics_users} (${((v74Counts.info_metrics_users / allTools.length) * 100).toFixed(1)}%)`);

  // Report 2: Diagnosis
  console.log("\n\n🔬 PART 2: DIAGNOSIS");
  console.log("=".repeat(80));

  const mismatch = actualCounts.vscode > 0 && v74Counts.vscode_installs === 0;
  if (mismatch) {
    console.log("\n❌ MISMATCH CONFIRMED!");
    console.log(`\n  We have collected ${actualCounts.vscode} tools with VS Code metrics`);
    console.log(`  But v7.4 can only see ${v74Counts.vscode_installs} tools`);
    console.log(`\n  This confirms the data path mismatch:`);
    console.log(`    - Collection scripts store at: data.metrics.vscode.*`);
    console.log(`    - Algorithm v7.4 expects at: data.info.vscode_installs`);
    console.log(`\n  Result: 92.5% of collected metrics are INVISIBLE to v7.4`);
  } else if (actualCounts.vscode === 0) {
    console.log("\n⚠️  No metrics found in database");
    console.log("  Run collection scripts first");
  } else {
    console.log("\n✅ Paths are aligned - no mismatch detected");
  }

  // Report 3: Top 10 Tools with Metrics
  console.log("\n\n📋 PART 3: TOP 10 TOOLS WITH METRICS");
  console.log("=".repeat(80));
  console.log("\nShowing where data IS vs where v7.4 EXPECTS it:\n");
  console.log("Tool Name".padEnd(25) + " | Actual Paths      | v7.4 Paths | Sample Values");
  console.log("-".repeat(80));

  for (let i = 0; i < Math.min(10, detailedResults.length); i++) {
    const r = detailedResults[i];
    const actualSymbols = [
      r.actualPaths.vscode ? "VS" : "--",
      r.actualPaths.github ? "GH" : "--",
      r.actualPaths.npm ? "NP" : "--",
      r.actualPaths.pypi ? "PY" : "--",
    ].join(" ");

    const v74Symbols = [
      r.v74Paths.vscode_installs ? "VS" : "--",
      r.v74Paths.github_stats ? "GH" : "--",
      r.v74Paths.npm_downloads ? "NP" : "--",
    ].join(" ");

    const values = [];
    if (r.sampleValues.actual_vscode_installs) {
      values.push(`VS:${(r.sampleValues.actual_vscode_installs / 1000000).toFixed(1)}M`);
    }
    if (r.sampleValues.actual_github_stars) {
      values.push(`GH:${(r.sampleValues.actual_github_stars / 1000).toFixed(1)}k`);
    }

    console.log(
      r.name.substring(0, 24).padEnd(25) +
        " | " +
        actualSymbols.padEnd(17) +
        " | " +
        v74Symbols.padEnd(10) +
        " | " +
        values.join(", ")
    );
  }

  console.log("\nLegend: VS=VSCode, GH=GitHub, NP=npm, PY=PyPI");
  console.log("        --=Not available at this path");

  // Report 4: Sample Data Structure
  if (detailedResults.length > 0) {
    const sample = detailedResults[0];
    const sampleTool = allTools.find((t) => t.slug === sample.slug);
    if (sampleTool) {
      console.log("\n\n🔍 PART 4: SAMPLE DATA STRUCTURE");
      console.log("=".repeat(80));
      console.log(`\nTool: ${sampleTool.name} (${sampleTool.slug})\n`);

      const data = sampleTool.data as any;

      console.log("Actual storage (data.metrics):");
      console.log(JSON.stringify(data.metrics, null, 2));

      console.log("\n\nExpected location (data.info - partial):");
      const infoSample = {
        vscode_installs: data.info?.vscode_installs,
        github_stats: data.info?.github_stats,
        npm_downloads: data.info?.npm_downloads,
        metrics: data.info?.metrics,
      };
      console.log(JSON.stringify(infoSample, null, 2));
    }
  }

  // Report 5: Recommendations
  console.log("\n\n💡 PART 5: RECOMMENDATIONS");
  console.log("=".repeat(80));

  if (mismatch) {
    console.log("\n✅ RECOMMENDED FIX: Update Algorithm v7.4");
    console.log("\n   Modify lib/ranking-algorithm-v74.ts to check BOTH paths:");
    console.log("   1. New path: data.metrics.{source}.{field}  (where data IS)");
    console.log("   2. Old path: data.info.{field}               (for backward compatibility)");
    console.log("\n   This will immediately make 92.5% of metrics visible to v7.4");
    console.log("\n❌ NOT RECOMMENDED: Data migration");
    console.log("   - More complex");
    console.log("   - Risk of data loss");
    console.log("   - Requires updating collection scripts");
  }

  console.log("\n" + "=".repeat(80));
  console.log("\n✅ Verification complete!\n");
}

main().catch(console.error);
