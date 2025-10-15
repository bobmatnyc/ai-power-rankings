/**
 * Check what's in the rankings table to understand the structure
 */

import { getDb } from "../lib/db/connection";
import { rankings } from "../lib/db/schema";
import { eq } from "drizzle-orm";

async function checkRankings() {
  const db = getDb();
  if (!db) {
    console.error("❌ Database connection not available");
    process.exit(1);
  }

  console.log("🔍 Checking current rankings table...\n");

  // Get current rankings
  const currentRankings = await db
    .select()
    .from(rankings)
    .where(eq(rankings.isCurrent, true))
    .limit(1);

  if (currentRankings.length === 0) {
    console.log("⚠️  No current rankings found");
    process.exit(1);
  }

  const ranking = currentRankings[0];
  console.log("📊 Current Rankings:");
  console.log(`   Period: ${ranking.period}`);
  console.log(`   Algorithm: ${ranking.algorithmVersion}`);
  console.log(`   Published: ${ranking.publishedAt}`);
  console.log(`   Is Current: ${ranking.isCurrent}`);

  // Parse the data field
  const rankingsData = ranking.data as any;
  let toolsInRankings: any[] = [];

  if (Array.isArray(rankingsData)) {
    toolsInRankings = rankingsData;
  } else if (rankingsData && typeof rankingsData === "object") {
    if (rankingsData.rankings && Array.isArray(rankingsData.rankings)) {
      toolsInRankings = rankingsData.rankings;
    } else if (rankingsData.data && Array.isArray(rankingsData.data)) {
      toolsInRankings = rankingsData.data;
    }
  }

  console.log(`\n📋 Tools in rankings: ${toolsInRankings.length}`);

  // Check if any of the 7 new tools are in the rankings
  const newToolSlugs = [
    "openai-codex",
    "greptile",
    "google-gemini-cli",
    "graphite",
    "qwen-code",
    "gitlab-duo",
    "anything-max",
  ];

  console.log("\n🔍 Checking for new tools in rankings:");
  for (const slug of newToolSlugs) {
    const found = toolsInRankings.find(
      (t) => t.tool_slug === slug || t.toolSlug === slug
    );
    console.log(`   ${slug}: ${found ? "✅ FOUND" : "❌ NOT FOUND"}`);
  }

  // Show sample of ranking data structure
  if (toolsInRankings.length > 0) {
    console.log("\n📄 Sample ranking entry:");
    console.log(JSON.stringify(toolsInRankings[0], null, 2));
  }

  process.exit(0);
}

checkRankings().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
