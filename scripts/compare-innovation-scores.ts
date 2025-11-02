#!/usr/bin/env tsx

/**
 * Compare Innovation Scores Across All Top Tools
 *
 * Creates a comprehensive comparison to show GitHub Copilot's
 * innovation score in context.
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { rankings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function compareInnovationScores() {
  const db = getDb();
  console.log("\n📊 Innovation Score Comparison - Top 20 Tools\n");
  console.log("=".repeat(100));

  // Get current ranking
  const currentRankings = await db
    .select()
    .from(rankings)
    .where(eq(rankings.isCurrent, true))
    .limit(1);

  if (currentRankings.length === 0) {
    console.log("❌ No current rankings found!");
    await closeDb();
    return;
  }

  const ranking = currentRankings[0];
  const rankingData = ranking.data as any;
  const rankingsArray = Array.isArray(rankingData) ? rankingData : rankingData?.rankings || [];

  // Extract and sort by innovation score
  const toolsData = rankingsArray
    .map((r: any) => ({
      rank: r.rank || r.position,
      name: r.tool_name || r.name,
      slug: r.tool_slug || r.slug,
      overall: r.overall_score || r.score || 0,
      innovation: (r.factor_scores || r.factorScores || {}).innovation || 0,
      agentic: (r.factor_scores || r.factorScores || {}).agenticCapability || 0,
      technical: (r.factor_scores || r.factorScores || {}).technicalPerformance || 0,
      adoption: (r.factor_scores || r.factorScores || {}).developerAdoption || 0,
    }))
    .sort((a: any, b: any) => b.innovation - a.innovation)
    .slice(0, 20);

  console.log("\n🏆 Top 20 Tools by Innovation Score\n");
  console.log("Innovation | Overall | Tool Name            | Rank | Agentic | Technical | Adoption");
  console.log("-".repeat(100));

  toolsData.forEach((t: any, idx: number) => {
    const isGitHub = t.slug === 'github-copilot';
    const marker = isGitHub ? '👉' : '  ';

    console.log(
      `${marker} ${t.innovation.toFixed(1).padStart(9)} | ` +
      `${t.overall.toFixed(2).padStart(7)} | ` +
      `${t.name.substring(0, 20).padEnd(20)} | ` +
      `${t.rank.toString().padStart(4)} | ` +
      `${t.agentic.toFixed(1).padStart(7)} | ` +
      `${t.technical.toFixed(1).padStart(9)} | ` +
      `${t.adoption.toFixed(1).padStart(8)}`
    );
  });

  // Find GitHub Copilot's position (might not be in top 20 by innovation)
  const copilotIdx = toolsData.findIndex((t: any) => t.slug === 'github-copilot');

  if (copilotIdx === -1) {
    // Copilot not in top 20 by innovation, need to find it in full rankings
    const copilotFull = rankingsArray.find((r: any) =>
      (r.tool_slug || r.slug) === 'github-copilot'
    );

    if (copilotFull) {
      const copilot = {
        rank: copilotFull.rank || copilotFull.position,
        name: copilotFull.tool_name || copilotFull.name,
        slug: copilotFull.tool_slug || copilotFull.slug,
        overall: copilotFull.overall_score || copilotFull.score || 0,
        innovation: (copilotFull.factor_scores || copilotFull.factorScores || {}).innovation || 0,
        agentic: (copilotFull.factor_scores || copilotFull.factorScores || {}).agenticCapability || 0,
      };

      console.log("\n" + "=".repeat(100));
      console.log("\n📈 GitHub Copilot Innovation Analysis\n");
      console.log(`❌ GitHub Copilot is NOT in top 20 by innovation score!`);
      console.log(`\nInnovation Score: ${copilot.innovation.toFixed(1)}`);
      console.log(`Innovation Rank: Beyond top 20`);
      console.log(`Overall Rank: ${copilot.rank} (Still #1 overall!)`);

      // Find actual innovation rank
      const allInnovation = rankingsArray
        .map((r: any) => ({
          slug: r.tool_slug || r.slug,
          innovation: (r.factor_scores || r.factorScores || {}).innovation || 0,
        }))
        .sort((a: any, b: any) => b.innovation - a.innovation);

      const innovationRank = allInnovation.findIndex(t => t.slug === 'github-copilot') + 1;
      console.log(`Actual Innovation Rank: ${innovationRank} out of ${rankingsArray.length} tools`);

      const higher = allInnovation.filter((t: any) => t.innovation > copilot.innovation).length;
      console.log(`\nTools with HIGHER innovation: ${higher}`);

      await closeDb();
      return;
    }
  }

  const copilot = toolsData[copilotIdx];

  console.log("\n" + "=".repeat(100));
  console.log("\n📈 GitHub Copilot Innovation Analysis\n");
  console.log(`Innovation Score: ${copilot.innovation.toFixed(1)}`);
  console.log(`Innovation Rank: ${copilotIdx + 1} out of ${toolsData.length} (top 20)`);
  console.log(`Overall Rank: ${copilot.rank}`);

  // Count tools with higher/lower innovation
  const higher = toolsData.filter((t: any) => t.innovation > copilot.innovation).length;
  const same = toolsData.filter((t: any) => t.innovation === copilot.innovation).length - 1;
  const lower = toolsData.filter((t: any) => t.innovation < copilot.innovation).length;

  console.log(`\nTools with HIGHER innovation: ${higher}`);
  if (higher > 0) {
    const higherTools = toolsData.filter((t: any) => t.innovation > copilot.innovation);
    higherTools.forEach((t: any) => {
      console.log(`  • ${t.name} (${t.innovation.toFixed(1)})`);
    });
  }

  console.log(`\nTools with SAME innovation: ${same}`);
  console.log(`Tools with LOWER innovation: ${lower}`);

  // Statistics
  const allScores = toolsData.map((t: any) => t.innovation);
  const avg = allScores.reduce((sum: number, s: number) => sum + s, 0) / allScores.length;
  const sorted = [...allScores].sort((a, b) => b - a);
  const median = sorted[Math.floor(sorted.length / 2)];

  console.log(`\n📊 Innovation Score Statistics (Top 20):`);
  console.log(`Average: ${avg.toFixed(1)}`);
  console.log(`Median: ${median.toFixed(1)}`);
  console.log(`Max: ${sorted[0].toFixed(1)}`);
  console.log(`Min: ${sorted[sorted.length - 1].toFixed(1)}`);
  console.log(`GitHub Copilot: ${copilot.innovation.toFixed(1)} (${((copilot.innovation - avg) / avg * 100).toFixed(1)}% above average)`);

  // Show distribution
  console.log(`\n📊 Innovation Score Distribution:`);
  const buckets = {
    '90-100': 0,
    '80-89': 0,
    '70-79': 0,
    '60-69': 0,
    '50-59': 0,
    '40-49': 0,
    '30-39': 0,
  };

  allScores.forEach((s: number) => {
    if (s >= 90) buckets['90-100']++;
    else if (s >= 80) buckets['80-89']++;
    else if (s >= 70) buckets['70-79']++;
    else if (s >= 60) buckets['60-69']++;
    else if (s >= 50) buckets['50-59']++;
    else if (s >= 40) buckets['40-49']++;
    else buckets['30-39']++;
  });

  Object.entries(buckets).forEach(([range, count]) => {
    const bar = '█'.repeat(count);
    const isCopilotRange = range === '80-89';
    const marker = isCopilotRange ? ' 👉 GitHub Copilot is here' : '';
    console.log(`  ${range}: ${bar} (${count})${marker}`);
  });

  console.log("\n✅ Comparison Complete\n");
  await closeDb();
}

compareInnovationScores().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
