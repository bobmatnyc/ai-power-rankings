/**
 * Verify GitHub Metrics Storage
 * Check that metrics were stored correctly in the database
 */

import dotenv from "dotenv";
import { getDb } from "../lib/db/connection";
import { tools } from "../lib/db/schema";
import { sql } from "drizzle-orm";

// Load environment variables
dotenv.config({ path: ".env.local" });

async function main() {
  console.log("🔍 Verifying GitHub Metrics Storage\n");

  const db = getDb();
  if (!db) {
    console.error("❌ Database connection not available");
    process.exit(1);
  }

  // Query tools with GitHub metrics
  const toolsWithMetrics = await db
    .select()
    .from(tools)
    .where(sql`data->'metrics'->'github' IS NOT NULL`);

  console.log(`Found ${toolsWithMetrics.length} tools with GitHub metrics\n`);
  console.log("=".repeat(80));

  for (const tool of toolsWithMetrics) {
    const toolData = tool.data as any;
    const githubMetrics = toolData?.metrics?.github;

    if (githubMetrics) {
      console.log(`\n📊 ${tool.name} (${tool.slug})`);
      console.log("─".repeat(80));
      console.log(`⭐ Stars:              ${githubMetrics.stars?.toLocaleString() || "N/A"}`);
      console.log(`🍴 Forks:              ${githubMetrics.forks?.toLocaleString() || "N/A"}`);
      console.log(`👁️  Watchers:           ${githubMetrics.watchers?.toLocaleString() || "N/A"}`);
      console.log(`🐛 Open Issues:        ${githubMetrics.open_issues?.toLocaleString() || "N/A"}`);
      console.log(`📝 Commits (30d):      ${githubMetrics.commit_count_30d || "N/A"}`);
      console.log(`👥 Contributors:       ${githubMetrics.contributors_count || "N/A"}`);
      console.log(`💻 Language:           ${githubMetrics.language || "N/A"}`);
      console.log(`📅 Created:            ${githubMetrics.created_at ? new Date(githubMetrics.created_at).toLocaleDateString() : "N/A"}`);
      console.log(`🔄 Last Updated:       ${githubMetrics.updated_at ? new Date(githubMetrics.updated_at).toLocaleDateString() : "N/A"}`);
      console.log(`📌 Last Pushed:        ${githubMetrics.pushed_at ? new Date(githubMetrics.pushed_at).toLocaleDateString() : "N/A"}`);
      console.log(`📊 Metrics Collected:  ${githubMetrics.last_updated ? new Date(githubMetrics.last_updated).toLocaleString() : "N/A"}`);
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("✅ Verification complete!");

  // Summary statistics
  if (toolsWithMetrics.length > 0) {
    const metrics = toolsWithMetrics.map((t: any) => t.data?.metrics?.github).filter(Boolean);

    const totalStars = metrics.reduce((sum: number, m: any) => sum + (m.stars || 0), 0);
    const avgStars = totalStars / metrics.length;
    const totalForks = metrics.reduce((sum: number, m: any) => sum + (m.forks || 0), 0);
    const avgForks = totalForks / metrics.length;

    console.log("\n📈 Summary Statistics:");
    console.log(`   Total Stars:   ${totalStars.toLocaleString()}`);
    console.log(`   Average Stars: ${Math.round(avgStars).toLocaleString()}`);
    console.log(`   Total Forks:   ${totalForks.toLocaleString()}`);
    console.log(`   Average Forks: ${Math.round(avgForks).toLocaleString()}`);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
