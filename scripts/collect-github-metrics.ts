/**
 * GitHub Metrics Collection Script
 * Phase 1: Collect stars, forks, commits, contributors for tools with GitHub repos
 */

import dotenv from "dotenv";
import { getDb } from "../lib/db/connection";
import { tools } from "../lib/db/schema";
import { sql } from "drizzle-orm";
// #95: the collector class lives in lib/metrics-collectors/ so the cron route can share it.
import { GitHubMetricsCollector, type GitHubMetrics, type GitHubRepoInfo } from "../lib/metrics-collectors/github";

// Load environment variables
dotenv.config({ path: ".env.local" });

/**
 * Main execution
 */
async function main() {
  console.log("🚀 GitHub Metrics Collection - Phase 1\n");

  // Check for GitHub token
  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    console.error("❌ GITHUB_TOKEN not found in environment variables");
    console.error("   Please add GITHUB_TOKEN to .env.local");
    process.exit(1);
  }

  const collector = new GitHubMetricsCollector(githubToken);

  // Step 1: Verify token
  console.log("Step 1: Verifying GitHub token...");
  const isValid = await collector.verifyToken();
  if (!isValid) {
    console.error("❌ GitHub token verification failed");
    process.exit(1);
  }
  console.log("");

  // Step 2: Connect to database and fetch tools
  console.log("Step 2: Fetching tools from database...");
  const db = getDb();
  if (!db) {
    console.error("❌ Database connection not available");
    process.exit(1);
  }

  const allTools = await db.select().from(tools);
  console.log(`✅ Found ${allTools.length} tools in database\n`);

  // Step 3: Identify tools with GitHub repos
  console.log("Step 3: Identifying tools with GitHub repositories...");
  const toolsWithGitHub: Array<{
    id: string;
    name: string;
    slug: string;
    githubInfo: GitHubRepoInfo;
  }> = [];

  for (const tool of allTools) {
    const toolData = tool.data as any;
    const githubUrls = collector.findGitHubUrls(toolData);

    if (githubUrls.length > 0) {
      // Use the first valid GitHub URL
      for (const url of githubUrls) {
        const repoInfo = collector["parseGitHubUrl"](url);
        if (repoInfo) {
          toolsWithGitHub.push({
            id: tool.id,
            name: tool.name,
            slug: tool.slug,
            githubInfo: repoInfo,
          });
          break; // Use first valid URL only
        }
      }
    }
  }

  console.log(`✅ Found ${toolsWithGitHub.length} tools with GitHub repositories\n`);

  // Step 4: Show sample tools (for testing)
  console.log("Step 4: Sample tools with GitHub repos:");
  console.log("─".repeat(80));
  toolsWithGitHub.slice(0, 5).forEach((tool, idx) => {
    console.log(`${idx + 1}. ${tool.name} (${tool.slug})`);
    console.log(`   ${tool.githubInfo.owner}/${tool.githubInfo.repo}`);
    console.log(`   ${tool.githubInfo.url}`);
  });
  console.log("─".repeat(80));
  console.log("");

  // Step 5: Collect metrics for sample tools (test mode)
  const testMode = process.argv.includes("--test");
  const fullMode = process.argv.includes("--full");
  const sampleSize = testMode ? Math.min(5, toolsWithGitHub.length) : toolsWithGitHub.length;
  const toolsToProcess = fullMode ? toolsWithGitHub : toolsWithGitHub.slice(0, sampleSize);

  if (testMode) {
    console.log(`Step 5: Testing on ${sampleSize} sample tools...\n`);
  } else if (fullMode) {
    console.log(`Step 5: Collecting metrics for ALL ${toolsWithGitHub.length} tools...\n`);
  } else {
    console.log(`Step 5: Preview mode - use --test or --full to collect metrics\n`);
    console.log("Commands:");
    console.log("  npm run tsx scripts/collect-github-metrics.ts --test   # Test on 5 tools");
    console.log("  npm run tsx scripts/collect-github-metrics.ts --full   # Run on all tools");
    return;
  }

  const results: Array<{
    tool: string;
    status: "success" | "failed";
    metrics?: GitHubMetrics;
    error?: string;
  }> = [];

  for (let i = 0; i < toolsToProcess.length; i++) {
    const tool = toolsToProcess[i];
    console.log(`[${i + 1}/${toolsToProcess.length}] ${tool.name}`);
    console.log(`   Repository: ${tool.githubInfo.owner}/${tool.githubInfo.repo}`);

    try {
      const metrics = await collector.collectMetrics(
        tool.githubInfo.owner,
        tool.githubInfo.repo
      );

      if (metrics) {
        console.log(`   ✅ Success! Stars: ${metrics.stars}, Forks: ${metrics.forks}`);

        // Get current tool data
        const currentTool = await db
          .select()
          .from(tools)
          .where(sql`id = ${tool.id}`)
          .limit(1);

        if (currentTool.length > 0) {
          const currentData = currentTool[0].data as any;

          // Merge metrics into tool data
          const updatedData = {
            ...currentData,
            metrics: {
              ...(currentData.metrics || {}),
              github: metrics,
            },
          };

          // Update database with merged data
          await db
            .update(tools)
            .set({
              data: updatedData as any,
              updatedAt: new Date(),
            })
            .where(sql`id = ${tool.id}`);

          console.log(`   💾 Stored in database`);
        }

        results.push({ tool: tool.name, status: "success", metrics });
      } else {
        console.log(`   ⚠️  No metrics collected`);
        results.push({
          tool: tool.name,
          status: "failed",
          error: "No metrics returned",
        });
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error}`);
      results.push({
        tool: tool.name,
        status: "failed",
        error: String(error),
      });
    }

    console.log("");
    // Small delay to be nice to GitHub API
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Step 6: Summary report
  console.log("\n" + "=".repeat(80));
  console.log("📊 EXECUTION REPORT");
  console.log("=".repeat(80));
  console.log(`Total tools in database: ${allTools.length}`);
  console.log(`Tools with GitHub repos: ${toolsWithGitHub.length}`);
  console.log(`Tools processed: ${toolsToProcess.length}`);
  console.log(`Successful: ${results.filter((r) => r.status === "success").length}`);
  console.log(`Failed: ${results.filter((r) => r.status === "failed").length}`);
  console.log("");

  if (results.some((r) => r.status === "success")) {
    console.log("Sample metrics collected:");
    console.log("─".repeat(80));
    results
      .filter((r) => r.status === "success")
      .slice(0, 3)
      .forEach((result) => {
        console.log(`${result.tool}:`);
        if (result.metrics) {
          console.log(`  ⭐ Stars: ${result.metrics.stars}`);
          console.log(`  🍴 Forks: ${result.metrics.forks}`);
          console.log(`  📝 Commits (30d): ${result.metrics.commit_count_30d}`);
          console.log(`  👥 Contributors: ${result.metrics.contributors_count}`);
        }
      });
  }

  if (results.some((r) => r.status === "failed")) {
    console.log("\nFailed tools:");
    console.log("─".repeat(80));
    results
      .filter((r) => r.status === "failed")
      .forEach((result) => {
        console.log(`❌ ${result.tool}: ${result.error}`);
      });
  }

  console.log("\n✅ GitHub metrics collection complete!");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
