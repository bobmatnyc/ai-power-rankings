#!/usr/bin/env tsx

/**
 * Package Registry Metrics Report Generator
 * Analyzes collected metrics from VS Code, npm, and PyPI to generate comprehensive report
 */

import { getDb } from "../lib/db/connection";
import { tools } from "../lib/db/schema";

interface MetricsCoverage {
  vscode: number;
  npm: number;
  pypi: number;
  github: number;
  any: number;
  multiple: number;
}

interface RegistryStats {
  name: string;
  tools_covered: number;
  total_downloads?: number;
  total_installs?: number;
  avg_rating?: number;
  top_tools: Array<{ name: string; slug: string; metric: number }>;
}

async function main() {
  console.log("📊 Package Registry Metrics Report");
  console.log("=".repeat(80));
  console.log("\n");

  const db = getDb();
  if (!db) {
    console.error("❌ Database connection not available");
    process.exit(1);
  }

  // Fetch all tools
  const allTools = await db.select().from(tools);
  console.log(`Total tools in database: ${allTools.length}\n`);

  // Analyze coverage
  let vscodeCoverage = 0;
  let npmCoverage = 0;
  let pypiCoverage = 0;
  let githubCoverage = 0;
  let anyCoverage = 0;
  let multipleCoverage = 0;

  const vscodeTools: any[] = [];
  const npmTools: any[] = [];
  const pypiTools: any[] = [];

  for (const tool of allTools) {
    const data = tool.data as any;
    const metrics = data.metrics || {};

    let count = 0;

    if (metrics.vscode) {
      vscodeCoverage++;
      count++;
      vscodeTools.push({
        name: tool.name,
        slug: tool.slug,
        ...metrics.vscode,
      });
    }

    if (metrics.npm) {
      npmCoverage++;
      count++;
      npmTools.push({
        name: tool.name,
        slug: tool.slug,
        ...metrics.npm,
      });
    }

    if (metrics.pypi) {
      pypiCoverage++;
      count++;
      pypiTools.push({
        name: tool.name,
        slug: tool.slug,
        ...metrics.pypi,
      });
    }

    if (metrics.github) {
      githubCoverage++;
      count++;
    }

    if (count > 0) anyCoverage++;
    if (count > 1) multipleCoverage++;
  }

  // Coverage Report
  console.log("📈 COVERAGE SUMMARY");
  console.log("─".repeat(80));
  console.log(
    `VS Code Marketplace:  ${vscodeCoverage.toString().padStart(2)} / ${allTools.length} (${((vscodeCoverage / allTools.length) * 100).toFixed(1)}%)`
  );
  console.log(
    `npm Registry:         ${npmCoverage.toString().padStart(2)} / ${allTools.length} (${((npmCoverage / allTools.length) * 100).toFixed(1)}%)`
  );
  console.log(
    `PyPI:                 ${pypiCoverage.toString().padStart(2)} / ${allTools.length} (${((pypiCoverage / allTools.length) * 100).toFixed(1)}%)`
  );
  console.log(
    `GitHub:               ${githubCoverage.toString().padStart(2)} / ${allTools.length} (${((githubCoverage / allTools.length) * 100).toFixed(1)}%)`
  );
  console.log("─".repeat(80));
  console.log(
    `At least one source:  ${anyCoverage.toString().padStart(2)} / ${allTools.length} (${((anyCoverage / allTools.length) * 100).toFixed(1)}%)`
  );
  console.log(
    `Multiple sources:     ${multipleCoverage.toString().padStart(2)} / ${allTools.length} (${((multipleCoverage / allTools.length) * 100).toFixed(1)}%)`
  );
  console.log("\n");

  // VS Code Stats
  if (vscodeTools.length > 0) {
    console.log("🔷 VS CODE MARKETPLACE STATISTICS");
    console.log("─".repeat(80));

    const totalInstalls = vscodeTools.reduce((sum, t) => sum + (t.installs || 0), 0);
    const avgRating =
      vscodeTools.reduce((sum, t) => sum + (t.rating || 0), 0) / vscodeTools.length;

    console.log(`Total extensions: ${vscodeTools.length}`);
    console.log(`Total installs: ${totalInstalls.toLocaleString()}`);
    console.log(`Average rating: ${avgRating.toFixed(2)}/5.0`);
    console.log("");

    console.log("Top 10 by installs:");
    vscodeTools
      .sort((a, b) => (b.installs || 0) - (a.installs || 0))
      .slice(0, 10)
      .forEach((tool, i) => {
        console.log(
          `  ${(i + 1).toString().padStart(2)}. ${tool.name.padEnd(30)} ${tool.installs.toLocaleString().padStart(15)} installs`
        );
      });
    console.log("\n");
  }

  // npm Stats
  if (npmTools.length > 0) {
    console.log("📦 NPM REGISTRY STATISTICS");
    console.log("─".repeat(80));

    const totalMonthly = npmTools.reduce((sum, t) => sum + (t.downloads_last_month || 0), 0);
    const totalWeekly = npmTools.reduce((sum, t) => sum + (t.downloads_last_week || 0), 0);

    console.log(`Total packages: ${npmTools.length}`);
    console.log(`Total monthly downloads: ${totalMonthly.toLocaleString()}`);
    console.log(`Total weekly downloads: ${totalWeekly.toLocaleString()}`);
    console.log("");

    console.log("Top 10 by monthly downloads:");
    npmTools
      .sort((a, b) => (b.downloads_last_month || 0) - (a.downloads_last_month || 0))
      .slice(0, 10)
      .forEach((tool, i) => {
        console.log(
          `  ${(i + 1).toString().padStart(2)}. ${tool.name.padEnd(30)} ${tool.downloads_last_month.toLocaleString().padStart(15)} downloads/mo`
        );
      });
    console.log("\n");
  }

  // PyPI Stats
  if (pypiTools.length > 0) {
    console.log("🐍 PYPI STATISTICS");
    console.log("─".repeat(80));

    const totalDownloads = pypiTools.reduce((sum, t) => sum + (t.downloads_last_month || 0), 0);

    console.log(`Total packages: ${pypiTools.length}`);
    console.log(`Total monthly downloads: ${totalDownloads.toLocaleString()}`);
    console.log("");

    console.log("Top 10 by monthly downloads:");
    pypiTools
      .sort((a, b) => (b.downloads_last_month || 0) - (a.downloads_last_month || 0))
      .slice(0, 10)
      .forEach((tool, i) => {
        console.log(
          `  ${(i + 1).toString().padStart(2)}. ${tool.name.padEnd(30)} ${tool.downloads_last_month.toLocaleString().padStart(15)} downloads/mo`
        );
      });
    console.log("\n");
  }

  // Tools with Multiple Metrics
  console.log("🎯 TOOLS WITH MULTIPLE METRICS SOURCES");
  console.log("─".repeat(80));

  const toolsWithMetrics = allTools.map((tool) => {
    const data = tool.data as any;
    const metrics = data.metrics || {};
    const sources: string[] = [];

    if (metrics.vscode) sources.push("VS Code");
    if (metrics.npm) sources.push("npm");
    if (metrics.pypi) sources.push("PyPI");
    if (metrics.github) sources.push("GitHub");

    return {
      name: tool.name,
      slug: tool.slug,
      sources,
      count: sources.length,
    };
  });

  const multiSourceTools = toolsWithMetrics.filter((t) => t.count >= 2);
  multiSourceTools.sort((a, b) => b.count - a.count);

  console.log(`Total tools with 2+ metrics sources: ${multiSourceTools.length}\n`);

  multiSourceTools.slice(0, 20).forEach((tool) => {
    console.log(
      `  ${tool.name.padEnd(30)} [${tool.count}] ${tool.sources.join(", ")}`
    );
  });
  console.log("\n");

  // Tools with NO metrics
  console.log("❌ TOOLS WITH NO METRICS");
  console.log("─".repeat(80));

  const noMetricsTools = toolsWithMetrics.filter((t) => t.count === 0);
  console.log(`Total tools with no metrics: ${noMetricsTools.length}\n`);

  noMetricsTools.forEach((tool) => {
    console.log(`  • ${tool.name} (${tool.slug})`);
  });
  console.log("\n");

  // Impact Assessment
  console.log("💡 IMPACT ASSESSMENT");
  console.log("─".repeat(80));

  const previousCoverage = 9; // From GitHub metrics only
  const newCoverage = ((anyCoverage / allTools.length) * 100).toFixed(1);
  const improvement = parseFloat(newCoverage) - previousCoverage;

  console.log(`Previous coverage (GitHub only): ${previousCoverage}%`);
  console.log(`New coverage (all sources): ${newCoverage}%`);
  console.log(`Improvement: +${improvement.toFixed(1)} percentage points`);
  console.log(`Coverage increase: ${((improvement / previousCoverage) * 100).toFixed(0)}%`);
  console.log("");

  console.log("Coverage breakdown:");
  console.log(`  - GitHub only:  ${(githubCoverage - multipleCoverage)} tools`);
  console.log(`  - VS Code only: ${vscodeCoverage - multipleCoverage} tools (estimated)`);
  console.log(`  - npm only:     ${npmCoverage - multipleCoverage} tools (estimated)`);
  console.log(`  - PyPI only:    ${pypiCoverage - multipleCoverage} tools (estimated)`);
  console.log(`  - Multiple:     ${multipleCoverage} tools`);
  console.log("\n");

  // Recommendations
  console.log("🎯 RECOMMENDATIONS");
  console.log("─".repeat(80));
  console.log("1. High-quality data sources identified:");
  console.log(
    `   - VS Code Marketplace: ${vscodeCoverage} tools with install metrics`
  );
  console.log(
    `   - npm Registry: ${npmCoverage} tools with download metrics`
  );
  console.log("");
  console.log("2. Coverage gaps:");
  console.log(
    `   - ${noMetricsTools.length} tools have no metrics from any source`
  );
  console.log("   - Consider manual data entry or alternative metrics sources");
  console.log("");
  console.log("3. Next steps:");
  console.log("   - Integrate these metrics into the ranking algorithm");
  console.log(
    "   - Weight VS Code installs and npm downloads in Developer Adoption factor"
  );
  console.log("   - Use multi-source validation to increase confidence scores");
  console.log("");

  console.log("=".repeat(80));
  console.log("✅ Report generation complete!");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
