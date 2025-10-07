#!/usr/bin/env tsx
/**
 * Verify Trending Data Script
 *
 * Verifies that the generated historical rankings will work correctly
 * with the trending chart by checking:
 * 1. All periods have valid data
 * 2. Tool slugs are consistent across periods
 * 3. Scores can be tracked over time
 */

import { getDb } from "@/lib/db/connection";
import { rankings } from "@/lib/db/schema";

interface RankingItem {
  tool_id: string;
  tool_slug: string;
  position: number;
  score: number;
  tier: string;
}

interface PeriodData {
  period: string;
  algorithmVersion: string;
  isCurrent: boolean;
  publishedAt: Date | null;
  rankingsCount: number;
  topTools: string[];
}

async function verifyTrendingData() {
  const db = getDb();
  if (!db) {
    throw new Error("Database connection required");
  }

  console.log("=== Verifying Trending Data ===\n");

  // Get all ranking periods
  const allRankings = await db
    .select()
    .from(rankings)
    .orderBy(rankings.period);

  console.log(`📊 Found ${allRankings.length} ranking periods\n`);

  // Analyze each period
  const periodSummaries: PeriodData[] = [];

  for (const ranking of allRankings) {
    const data = ranking.data as any;
    const rankingItems: RankingItem[] = data?.rankings || [];

    const summary: PeriodData = {
      period: ranking.period,
      algorithmVersion: ranking.algorithmVersion,
      isCurrent: ranking.isCurrent,
      publishedAt: ranking.publishedAt,
      rankingsCount: rankingItems.length,
      topTools: rankingItems.slice(0, 5).map((r) => r.tool_slug),
    };

    periodSummaries.push(summary);

    const currentLabel = summary.isCurrent ? " [CURRENT]" : "";
    console.log(`📅 Period: ${summary.period}${currentLabel}`);
    console.log(`   Algorithm: ${summary.algorithmVersion}`);
    console.log(`   Published: ${summary.publishedAt?.toISOString() || "N/A"}`);
    console.log(`   Rankings: ${summary.rankingsCount} tools`);
    console.log(`   Top 5: ${summary.topTools.join(", ")}`);
    console.log();
  }

  // Test trending data extraction for a specific tool
  console.log("=== Testing Trending Data Extraction ===\n");

  // Pick a tool that should exist in all periods
  const testToolSlugs = ["refact-ai", "amazon-q-developer", "claude-code"];

  for (const toolSlug of testToolSlugs) {
    console.log(`📈 Trending data for: ${toolSlug}`);

    const trendingData: Array<{ period: string; score: number; position: number; tier: string }> =
      [];

    for (const ranking of allRankings) {
      const data = ranking.data as any;
      const rankingItems: RankingItem[] = data?.rankings || [];
      const toolRanking = rankingItems.find((r) => r.tool_slug === toolSlug);

      if (toolRanking) {
        trendingData.push({
          period: ranking.period,
          score: toolRanking.score,
          position: toolRanking.position,
          tier: toolRanking.tier,
        });
      }
    }

    if (trendingData.length > 0) {
      console.log(`   ✓ Found in ${trendingData.length} periods`);
      trendingData.forEach((d) => {
        console.log(`      ${d.period}: Score ${d.score}, Position #${d.position}, Tier ${d.tier}`);
      });
    } else {
      console.log(`   ❌ Not found in any period`);
    }
    console.log();
  }

  // Check for consistency issues
  console.log("=== Consistency Checks ===\n");

  // 1. Check that all periods have data
  const emptyPeriods = periodSummaries.filter((p) => p.rankingsCount === 0);
  if (emptyPeriods.length > 0) {
    console.log(`❌ Found ${emptyPeriods.length} periods with no rankings:`);
    emptyPeriods.forEach((p) => console.log(`   - ${p.period}`));
  } else {
    console.log("✓ All periods have rankings data");
  }

  // 2. Check that only one period is marked as current
  const currentPeriods = periodSummaries.filter((p) => p.isCurrent);
  if (currentPeriods.length === 1) {
    console.log(`✓ Exactly one current period: ${currentPeriods[0].period}`);
  } else if (currentPeriods.length === 0) {
    console.log("❌ No period marked as current");
  } else {
    console.log(`❌ Multiple periods marked as current: ${currentPeriods.map((p) => p.period).join(", ")}`);
  }

  // 3. Check chronological order
  const dates = periodSummaries
    .map((p) => ({ period: p.period, date: p.publishedAt }))
    .filter((p) => p.date !== null);

  let chronologicalOrder = true;
  for (let i = 1; i < dates.length; i++) {
    if (dates[i].date! < dates[i - 1].date!) {
      chronologicalOrder = false;
      console.log(`❌ Periods out of chronological order: ${dates[i - 1].period} vs ${dates[i].period}`);
    }
  }
  if (chronologicalOrder) {
    console.log("✓ Periods are in chronological order");
  }

  // 4. Summary statistics
  console.log("\n=== Statistics ===\n");
  console.log(`Total periods: ${periodSummaries.length}`);
  console.log(`Date range: ${periodSummaries[0].period} to ${periodSummaries[periodSummaries.length - 1].period}`);
  console.log(`Average rankings per period: ${Math.round(periodSummaries.reduce((sum, p) => sum + p.rankingsCount, 0) / periodSummaries.length)}`);

  const baselinePeriods = periodSummaries.filter((p) =>
    p.algorithmVersion.includes("baseline")
  );
  console.log(`Baseline periods: ${baselinePeriods.length}`);
  console.log(`Current algorithm periods: ${periodSummaries.length - baselinePeriods.length}`);

  console.log("\n✅ Verification completed!");
  console.log("\n💡 The trending chart should now display:");
  console.log(`   - ${periodSummaries.length} data points (${periodSummaries[0].period} to ${periodSummaries[periodSummaries.length - 1].period})`);
  console.log("   - Score progression over time for each tool");
  console.log("   - Position changes across periods");
}

verifyTrendingData()
  .then(() => {
    console.log("\n✅ Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  });
