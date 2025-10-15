/**
 * Final verification that all 7 tools are properly integrated
 */

import { getDb } from "../lib/db/connection";
import { tools, rankings } from "../lib/db/schema";
import { eq } from "drizzle-orm";

const NEW_TOOLS = [
  { slug: "openai-codex", expectedScore: 92, category: "autonomous-agent" },
  { slug: "greptile", expectedScore: 90, category: "other" },
  { slug: "google-gemini-cli", expectedScore: 88, category: "open-source-framework" },
  { slug: "graphite", expectedScore: 87, category: "other" },
  { slug: "qwen-code", expectedScore: 86, category: "open-source-framework" },
  { slug: "gitlab-duo", expectedScore: 84, category: "other" },
  { slug: "anything-max", expectedScore: 80, category: "autonomous-agent" },
];

async function verifyEverything() {
  const db = getDb();
  if (!db) {
    console.error("❌ Database connection not available");
    process.exit(1);
  }

  console.log("🔍 FINAL VERIFICATION OF 7 NEW TOOLS\n");
  console.log("================================================================================\n");

  let allPassed = true;

  // 1. Verify tools table has all scores
  console.log("1️⃣  TOOLS TABLE VERIFICATION");
  console.log("--------------------------------------------------------------------------------");

  for (const toolData of NEW_TOOLS) {
    const result = await db
      .select({
        name: tools.name,
        slug: tools.slug,
        category: tools.category,
        currentScore: tools.currentScore,
        baselineScore: tools.baselineScore,
        deltaScore: tools.deltaScore,
      })
      .from(tools)
      .where(eq(tools.slug, toolData.slug))
      .limit(1);

    if (result.length === 0) {
      console.log(`❌ ${toolData.slug}: NOT FOUND IN TOOLS TABLE`);
      allPassed = false;
      continue;
    }

    const tool = result[0];
    const currentScore = tool.currentScore as any;
    const score = currentScore?.overallScore;

    const hasScore = score !== null && score !== undefined;
    const scoreMatches = score === toolData.expectedScore;
    const hasBaseline = tool.baselineScore && Object.keys(tool.baselineScore as object).length > 0;
    const hasDelta = tool.deltaScore !== null;
    const categoryCorrect = tool.category === toolData.category;

    const status = hasScore && scoreMatches && hasBaseline && hasDelta && categoryCorrect ? "✅" : "❌";

    console.log(`${status} ${tool.name}`);
    console.log(`   Score: ${score} (expected: ${toolData.expectedScore}) ${scoreMatches ? "✅" : "❌"}`);
    console.log(`   Category: ${tool.category} (expected: ${toolData.category}) ${categoryCorrect ? "✅" : "❌"}`);
    console.log(`   Has baseline: ${hasBaseline ? "✅" : "❌"}`);
    console.log(`   Has delta: ${hasDelta ? "✅" : "❌"}`);

    if (!hasScore || !scoreMatches || !hasBaseline || !hasDelta || !categoryCorrect) {
      allPassed = false;
    }
  }

  // 2. Verify rankings table contains all tools
  console.log("\n2️⃣  RANKINGS TABLE VERIFICATION");
  console.log("--------------------------------------------------------------------------------");

  const currentRankings = await db
    .select()
    .from(rankings)
    .where(eq(rankings.isCurrent, true))
    .limit(1);

  if (currentRankings.length === 0) {
    console.log("❌ No current rankings found");
    allPassed = false;
  } else {
    const ranking = currentRankings[0];
    const rankingsData = ranking.data as any;
    let toolsList: any[] = [];

    if (Array.isArray(rankingsData)) {
      toolsList = rankingsData;
    }

    for (const toolData of NEW_TOOLS) {
      const found = toolsList.find((t) => t.tool_slug === toolData.slug);

      if (!found) {
        console.log(`❌ ${toolData.slug}: NOT FOUND IN RANKINGS`);
        allPassed = false;
      } else {
        const scoreMatches = found.score === toolData.expectedScore;
        const hasFactorScores =
          found.factor_scores && Object.keys(found.factor_scores).length > 0;

        console.log(
          `${scoreMatches && hasFactorScores ? "✅" : "❌"} ${found.tool_name} - Position ${found.position}, Score ${found.score}`
        );

        if (!scoreMatches) {
          console.log(`   ⚠️  Score mismatch: ${found.score} vs expected ${toolData.expectedScore}`);
          allPassed = false;
        }

        if (!hasFactorScores) {
          console.log(`   ⚠️  Missing factor scores`);
          allPassed = false;
        }
      }
    }
  }

  // 3. Summary
  console.log("\n================================================================================");
  console.log(`\n📊 FINAL RESULT: ${allPassed ? "✅ ALL CHECKS PASSED" : "❌ SOME CHECKS FAILED"}\n`);

  if (allPassed) {
    console.log("🎉 Success! All 7 tools are properly integrated:");
    console.log("   • Tools table has complete score data");
    console.log("   • Rankings table includes all tools");
    console.log("   • All scores match expected values");
    console.log("   • All tools have factor scores");
    console.log("   • Categories are correct");
  }

  process.exit(allPassed ? 0 : 1);
}

verifyEverything().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
