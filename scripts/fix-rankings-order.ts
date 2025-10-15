/**
 * Fix the rankings order to be sorted by score correctly
 */

import { getDb } from "../lib/db/connection";
import { rankings } from "../lib/db/schema";
import { eq } from "drizzle-orm";

async function fixRankingsOrder() {
  const db = getDb();
  if (!db) {
    console.error("❌ Database connection not available");
    process.exit(1);
  }

  console.log("🔍 Fixing rankings order by score...\n");

  // Get current rankings
  const currentRankings = await db
    .select()
    .from(rankings)
    .where(eq(rankings.isCurrent, true))
    .limit(1);

  if (currentRankings.length === 0) {
    console.error("❌ No current rankings found");
    process.exit(1);
  }

  const ranking = currentRankings[0];
  const rankingsData = ranking.data as any;
  let toolsList: any[] = [];

  if (Array.isArray(rankingsData)) {
    toolsList = rankingsData;
  } else if (rankingsData && typeof rankingsData === "object") {
    if (rankingsData.rankings && Array.isArray(rankingsData.rankings)) {
      toolsList = rankingsData.rankings;
    } else if (rankingsData.data && Array.isArray(rankingsData.data)) {
      toolsList = rankingsData.data;
    }
  }

  console.log(`📋 Tools before sorting: ${toolsList.length}`);

  // Sort by score descending
  toolsList.sort((a, b) => {
    const scoreA = a.score || 0;
    const scoreB = b.score || 0;
    return scoreB - scoreA; // Descending order
  });

  // Renumber positions
  toolsList.forEach((tool, index) => {
    const oldPosition = tool.position;
    const newPosition = index + 1;
    tool.position = newPosition;

    // Update movement data
    if (tool.movement && tool.movement.previous_position) {
      const change = tool.movement.previous_position - newPosition;
      tool.movement.change = change;
      tool.movement.direction = change > 0 ? "up" : change < 0 ? "down" : "same";
    }
  });

  // Update the rankings table
  await db
    .update(rankings)
    .set({
      data: toolsList,
      updatedAt: new Date(),
    })
    .where(eq(rankings.id, ranking.id));

  console.log("✅ Rankings sorted by score and positions updated!\n");

  // Show top 20 positions
  console.log("🏆 Top 20 Rankings (Sorted by Score):");
  toolsList.slice(0, 20).forEach((tool) => {
    console.log(`   ${tool.position}. ${tool.tool_name} - ${tool.score}`);
  });

  // Verify the 7 new tools
  console.log("\n🔍 New tools positions:");
  const newToolSlugs = [
    "openai-codex",
    "greptile",
    "google-gemini-cli",
    "graphite",
    "qwen-code",
    "gitlab-duo",
    "anything-max",
  ];

  for (const slug of newToolSlugs) {
    const found = toolsList.find((t) => t.tool_slug === slug);
    if (found) {
      console.log(`   ${found.position}. ${found.tool_name} - ${found.score}`);
    }
  }

  process.exit(0);
}

fixRankingsOrder().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
