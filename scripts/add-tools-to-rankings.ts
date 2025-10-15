/**
 * Add the 7 new tools to the current rankings table
 * This updates the JSONB data field in the rankings table
 */

import { getDb } from "../lib/db/connection";
import { rankings, tools } from "../lib/db/schema";
import { eq } from "drizzle-orm";

// New tools with their assigned scores and positions
const newToolsData = [
  { slug: "openai-codex", score: 92, position: 4 }, // Insert after top 3
  { slug: "greptile", score: 90, position: 5 },
  { slug: "google-gemini-cli", score: 88, position: 6 },
  { slug: "graphite", score: 87, position: 7 },
  { slug: "qwen-code", score: 86, position: 8 },
  { slug: "gitlab-duo", score: 84, position: 9 },
  { slug: "anything-max", score: 80, position: 10 },
];

async function addToolsToRankings() {
  const db = getDb();
  if (!db) {
    console.error("❌ Database connection not available");
    process.exit(1);
  }

  console.log("🔍 Adding 7 tools to current rankings...\n");

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
  console.log(`📊 Current Rankings: ${ranking.period} (${ranking.algorithmVersion})`);

  // Parse existing rankings data
  const rankingsData = ranking.data as any;
  let existingTools: any[] = [];

  if (Array.isArray(rankingsData)) {
    existingTools = rankingsData;
  } else if (rankingsData && typeof rankingsData === "object") {
    if (rankingsData.rankings && Array.isArray(rankingsData.rankings)) {
      existingTools = rankingsData.rankings;
    } else if (rankingsData.data && Array.isArray(rankingsData.data)) {
      existingTools = rankingsData.data;
    }
  }

  console.log(`📋 Existing tools in rankings: ${existingTools.length}\n`);

  // Fetch tool data for all 7 new tools
  const newToolEntries: any[] = [];

  for (const toolData of newToolsData) {
    const toolRecords = await db
      .select()
      .from(tools)
      .where(eq(tools.slug, toolData.slug))
      .limit(1);

    if (toolRecords.length === 0) {
      console.log(`⚠️  Tool not found: ${toolData.slug}`);
      continue;
    }

    const tool = toolRecords[0];
    const currentScore = tool.currentScore as any;

    if (!currentScore || !currentScore.overallScore) {
      console.log(`⚠️  Tool has no score: ${toolData.slug}`);
      continue;
    }

    // Create ranking entry matching the existing format
    const rankingEntry = {
      tool_id: tool.id,
      tool_name: tool.name,
      tool_slug: tool.slug,
      position: toolData.position,
      score: currentScore.overallScore,
      factor_scores: {
        agenticCapability: currentScore.technicalCapability || 0,
        innovation: Math.round((currentScore.overallScore || 0) * 0.85),
        technicalPerformance: currentScore.technicalCapability || 0,
        technicalCapability: currentScore.technicalCapability || 0,
        developerAdoption: currentScore.developerAdoption || 0,
        marketTraction: currentScore.marketTraction || 0,
        businessSentiment: currentScore.communitySentiment || 0,
        communitySentiment: currentScore.communitySentiment || 0,
        developmentVelocity: currentScore.developmentVelocity || 0,
        platformResilience: currentScore.platformResilience || 0,
      },
      movement: {
        previous_position: null,
        change: 0,
        direction: "new",
      },
      sentiment_analysis: {
        rawSentiment: 0.7,
        adjustedSentiment: 0.7,
        newsImpact: 100,
        notes: "Newly added to rankings",
      },
    };

    newToolEntries.push(rankingEntry);
    console.log(`✅ Prepared: ${tool.name} (Position ${toolData.position}, Score ${toolData.score})`);
  }

  if (newToolEntries.length === 0) {
    console.error("❌ No new tool entries to add");
    process.exit(1);
  }

  // Insert new tools at their positions and re-number existing tools
  console.log("\n🔄 Reordering rankings to insert new tools...");

  // Separate existing tools and renumber
  const updatedRankings = [...existingTools];

  // Find insertion points and adjust positions
  for (const newEntry of newToolEntries) {
    const insertPosition = newEntry.position - 1; // Array is 0-indexed

    // Shift all tools at or after this position down
    for (let i = updatedRankings.length - 1; i >= insertPosition; i--) {
      updatedRankings[i].position = i + 2; // Adjust position
    }

    // Insert the new tool
    updatedRankings.splice(insertPosition, 0, newEntry);
  }

  // Renumber all positions sequentially
  updatedRankings.forEach((tool, index) => {
    tool.position = index + 1;
  });

  console.log(`📊 New rankings count: ${updatedRankings.length}`);

  // Update the rankings table
  await db
    .update(rankings)
    .set({
      data: updatedRankings,
      updatedAt: new Date(),
    })
    .where(eq(rankings.id, ranking.id));

  console.log("\n✅ Rankings updated successfully!");

  // Verify the update
  console.log("\n🔍 Verifying new tools in rankings:");
  for (const toolData of newToolsData) {
    const found = updatedRankings.find((t) => t.tool_slug === toolData.slug);
    if (found) {
      console.log(`   ✅ ${found.tool_name}: Position ${found.position}, Score ${found.score}`);
    } else {
      console.log(`   ❌ ${toolData.slug}: NOT FOUND`);
    }
  }

  // Show top 15 positions
  console.log("\n🏆 Top 15 Rankings:");
  updatedRankings
    .slice(0, 15)
    .forEach((tool) => {
      console.log(`   ${tool.position}. ${tool.tool_name} - ${tool.score}`);
    });

  process.exit(0);
}

addToolsToRankings().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
