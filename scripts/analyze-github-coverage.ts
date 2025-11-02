/**
 * Analyze GitHub Repository Coverage
 * Check which tools have/don't have GitHub repositories
 */

import dotenv from "dotenv";
import { getDb } from "../lib/db/connection";
import { tools } from "../lib/db/schema";

// Load environment variables
dotenv.config({ path: ".env.local" });

interface ToolAnalysis {
  id: string;
  name: string;
  slug: string;
  hasGitHub: boolean;
  hasMetrics: boolean;
  githubUrls?: string[];
  category?: string;
}

function findGitHubUrls(data: any): string[] {
  const urls: string[] = [];

  // Deep search for GitHub URLs
  const search = (obj: any, path: string = ""): void => {
    if (!obj || typeof obj !== "object") return;

    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;

      if (typeof value === "string") {
        if (value.includes("github.com")) {
          urls.push(`${currentPath}: ${value}`);
        }
      } else if (typeof value === "object" && value !== null) {
        search(value, currentPath);
      } else if (Array.isArray(value)) {
        value.forEach((item, idx) => {
          if (typeof item === "string" && item.includes("github.com")) {
            urls.push(`${currentPath}[${idx}]: ${item}`);
          } else if (typeof item === "object") {
            search(item, `${currentPath}[${idx}]`);
          }
        });
      }
    }
  };

  search(data);
  return urls;
}

async function main() {
  console.log("🔍 GitHub Repository Coverage Analysis\n");

  const db = getDb();
  if (!db) {
    console.error("❌ Database connection not available");
    process.exit(1);
  }

  // Fetch all tools
  const allTools = await db.select().from(tools);
  console.log(`Found ${allTools.length} tools in database\n`);

  // Analyze each tool
  const analysis: ToolAnalysis[] = [];

  for (const tool of allTools) {
    const toolData = tool.data as any;
    const githubUrls = findGitHubUrls(toolData);
    const hasGitHub = githubUrls.length > 0;
    const hasMetrics = toolData?.metrics?.github ? true : false;

    analysis.push({
      id: tool.id,
      name: tool.name,
      slug: tool.slug,
      hasGitHub,
      hasMetrics,
      githubUrls: hasGitHub ? githubUrls : undefined,
      category: tool.category,
    });
  }

  // Statistics
  const withGitHub = analysis.filter((t) => t.hasGitHub);
  const withMetrics = analysis.filter((t) => t.hasMetrics);
  const withoutGitHub = analysis.filter((t) => !t.hasGitHub);

  console.log("=" .repeat(80));
  console.log("📊 COVERAGE STATISTICS");
  console.log("=".repeat(80));
  console.log(`Total Tools:                 ${analysis.length}`);
  console.log(`Tools with GitHub URLs:      ${withGitHub.length} (${Math.round((withGitHub.length / analysis.length) * 100)}%)`);
  console.log(`Tools with Metrics:          ${withMetrics.length} (${Math.round((withMetrics.length / analysis.length) * 100)}%)`);
  console.log(`Tools without GitHub:        ${withoutGitHub.length} (${Math.round((withoutGitHub.length / analysis.length) * 100)}%)`);
  console.log("");

  // Tools with GitHub URLs
  if (withGitHub.length > 0) {
    console.log("✅ Tools with GitHub Repositories:");
    console.log("─".repeat(80));
    withGitHub.forEach((tool, idx) => {
      const status = tool.hasMetrics ? "✓ Metrics Collected" : "○ No Metrics";
      console.log(`${idx + 1}. ${tool.name} (${tool.slug}) - ${status}`);
      if (tool.githubUrls && tool.githubUrls.length > 0) {
        tool.githubUrls.forEach((url) => {
          console.log(`   ${url}`);
        });
      }
    });
    console.log("");
  }

  // Tools without GitHub URLs
  if (withoutGitHub.length > 0) {
    console.log("❌ Tools without GitHub Repositories:");
    console.log("─".repeat(80));
    withoutGitHub.forEach((tool, idx) => {
      console.log(`${idx + 1}. ${tool.name} (${tool.slug})`);
      console.log(`   Category: ${tool.category || "Unknown"}`);
    });
    console.log("");
  }

  // Category breakdown
  const byCategory = analysis.reduce((acc, tool) => {
    const cat = tool.category || "Unknown";
    if (!acc[cat]) {
      acc[cat] = { total: 0, withGitHub: 0, withMetrics: 0 };
    }
    acc[cat].total++;
    if (tool.hasGitHub) acc[cat].withGitHub++;
    if (tool.hasMetrics) acc[cat].withMetrics++;
    return acc;
  }, {} as Record<string, { total: number; withGitHub: number; withMetrics: number }>);

  console.log("📊 Coverage by Category:");
  console.log("─".repeat(80));
  Object.entries(byCategory)
    .sort((a, b) => b[1].total - a[1].total)
    .forEach(([category, stats]) => {
      const ghPct = Math.round((stats.withGitHub / stats.total) * 100);
      const metricsPct = Math.round((stats.withMetrics / stats.total) * 100);
      console.log(`${category}:`);
      console.log(`  Total: ${stats.total} | GitHub: ${stats.withGitHub} (${ghPct}%) | Metrics: ${stats.withMetrics} (${metricsPct}%)`);
    });

  console.log("\n" + "=".repeat(80));
  console.log("✅ Analysis complete!");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
