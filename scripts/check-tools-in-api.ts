#!/usr/bin/env tsx

/**
 * Check Tools in API
 *
 * Verifies that the October 2025 tools appear in the tools API endpoint
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

async function checkToolsInApi() {
  const db = getDb();
  console.log("🔍 Checking Tools in Database API\n");
  console.log("=".repeat(80));

  const slugsToCheck = ["clacky-ai", "flint", "dfinity-caffeine"];

  // Get all tools (simulating API call)
  const allTools = await db
    .select({
      id: tools.id,
      slug: tools.slug,
      name: tools.name,
      category: tools.category,
      status: tools.status,
      currentScore: tools.currentScore,
      data: tools.data,
    })
    .from(tools)
    .where(inArray(tools.slug, slugsToCheck));

  console.log(`\n📊 Found ${allTools.length} tools in database\n`);

  for (const tool of allTools) {
    const scoreObj = tool.currentScore as any;
    const data = tool.data as any;

    console.log("─".repeat(80));
    console.log(`\n✅ ${tool.name}`);
    console.log(`   Slug: ${tool.slug}`);
    console.log(`   Category: ${tool.category}`);
    console.log(`   Status: ${tool.status}`);
    console.log(`   Score: ${scoreObj?.overallScore || "NULL"}/100`);
    console.log(`   Website: ${data?.website || "N/A"}`);
    console.log(`   Description: ${(data?.description || "").substring(0, 120)}...`);
  }

  console.log("\n" + "=".repeat(80));

  // Now get all active tools to see ranking
  console.log("\n📈 All Active Tools (sorted by score):\n");

  const activeTools = await db
    .select({
      slug: tools.slug,
      name: tools.name,
      currentScore: tools.currentScore,
    })
    .from(tools)
    .where(eq(tools.status, "active"));

  // Sort by score
  const sortedTools = activeTools
    .map(t => ({
      slug: t.slug,
      name: t.name,
      score: (t.currentScore as any)?.overallScore || 0,
    }))
    .filter(t => t.score > 0)
    .sort((a, b) => b.score - a.score);

  console.log(`Total active tools with scores: ${sortedTools.length}\n`);

  // Find our tools in the ranking
  const ourTools = sortedTools.filter(t => slugsToCheck.includes(t.slug));

  console.log("Our tools in the rankings:");
  ourTools.forEach(tool => {
    const rank = sortedTools.findIndex(t => t.slug === tool.slug) + 1;
    console.log(`  #${rank}. ${tool.name} (${tool.slug}) - Score: ${tool.score}/100`);
  });

  // Show top 10 for context
  console.log("\nTop 10 tools for context:");
  sortedTools.slice(0, 10).forEach((tool, index) => {
    const isOurTool = slugsToCheck.includes(tool.slug);
    console.log(`  ${isOurTool ? "→" : " "} #${index + 1}. ${tool.name} - ${tool.score}/100`);
  });

  console.log("\n" + "=".repeat(80));
  console.log("✨ API check completed!\n");
}

async function main() {
  try {
    await checkToolsInApi();
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

main();
