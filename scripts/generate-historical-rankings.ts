#!/usr/bin/env tsx
/**
 * Generate Historical Rankings Script
 *
 * Creates monthly ranking periods from May 2025 to August 2025 using the baseline
 * snapshot as the starting point. This provides historical data for trending charts.
 *
 * Process:
 * 1. Load baseline snapshot from ranking_versions table
 * 2. Transform baseline data into rankings format
 * 3. Generate periods: 2025-05, 2025-06, 2025-07, 2025-08
 * 4. Insert into rankings table with proper timestamps
 * 5. Keep existing 2025-09 period unchanged
 */

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/connection";
import { rankingVersions, rankings } from "@/lib/db/schema";

interface BaselineTool {
  id: string;
  name: string;
  slug: string;
  scores: {
    current: {
      overallScore: number;
      [key: string]: number;
    };
  };
  category: string;
}

interface RankingItem {
  tool_id: string;
  tool_slug: string;
  position: number;
  score: number;
  tier: string;
}

/**
 * Calculate tier based on score
 */
function calculateTier(score: number): string {
  if (score >= 90) return "S";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  return "D";
}

/**
 * Transform baseline tools into rankings format
 */
function transformBaselineToRankings(tools: BaselineTool[]): RankingItem[] {
  // Sort by overall score descending
  const sortedTools = [...tools].sort(
    (a, b) => b.scores.current.overallScore - a.scores.current.overallScore
  );

  // Map to ranking format with positions
  return sortedTools.map((tool, index) => ({
    tool_id: tool.id,
    tool_slug: tool.slug,
    position: index + 1,
    score: tool.scores.current.overallScore,
    tier: calculateTier(tool.scores.current.overallScore),
  }));
}

/**
 * Generate a period string for a given month
 */
function generatePeriod(year: number, month: number): string {
  return `${year}-${month.toString().padStart(2, "0")}`;
}

/**
 * Generate end-of-month timestamp
 */
function getEndOfMonth(year: number, month: number): Date {
  // Last day of the month at 23:59:59
  const lastDay = new Date(year, month, 0); // month is 1-indexed, so this gives last day of previous month
  return new Date(year, month - 1, lastDay.getDate(), 23, 59, 59);
}

async function generateHistoricalRankings() {
  const db = getDb();
  if (!db) {
    throw new Error("Database connection required");
  }

  console.log("=== Generating Historical Rankings ===\n");

  // Step 1: Load baseline snapshot
  console.log("📥 Loading baseline snapshot...");
  const baselineResults = await db
    .select()
    .from(rankingVersions)
    .where(eq(rankingVersions.version, "baseline-may-2025"))
    .limit(1);

  if (baselineResults.length === 0) {
    throw new Error("❌ Baseline snapshot not found!");
  }

  const baseline = baselineResults[0];
  const snapshot = baseline.rankingsSnapshot as any;

  if (!snapshot.tools || !Array.isArray(snapshot.tools)) {
    throw new Error("❌ Invalid baseline snapshot structure!");
  }

  console.log(`✓ Loaded baseline with ${snapshot.tools.length} tools`);

  // Step 2: Transform baseline to rankings format
  console.log("\n🔄 Transforming baseline data to rankings format...");
  const rankingItems = transformBaselineToRankings(snapshot.tools);
  console.log(`✓ Generated ${rankingItems.length} ranking items`);
  console.log(`   Top 3: ${rankingItems.slice(0, 3).map(r => `${r.tool_slug} (${r.score})`).join(", ")}`);

  // Step 3: Generate monthly periods
  const periods = [
    { year: 2025, month: 5 },  // May 2025
    { year: 2025, month: 6 },  // June 2025
    { year: 2025, month: 7 },  // July 2025
    { year: 2025, month: 8 },  // August 2025
  ];

  console.log("\n📅 Generating ranking periods...");
  let insertedCount = 0;
  let skippedCount = 0;

  for (const { year, month } of periods) {
    const period = generatePeriod(year, month);
    const publishedAt = getEndOfMonth(year, month);

    console.log(`\n   Processing ${period}...`);
    console.log(`      Published: ${publishedAt.toISOString()}`);

    try {
      // Check if period already exists
      const existing = await db
        .select()
        .from(rankings)
        .where(eq(rankings.period, period))
        .limit(1);

      if (existing.length > 0) {
        console.log(`      ⏭️  Already exists, skipping`);
        skippedCount++;
        continue;
      }

      // Insert new ranking period
      await db.insert(rankings).values({
        period,
        algorithmVersion: "v1.0-baseline",
        isCurrent: false, // Historical periods are never current
        publishedAt,
        data: { rankings: rankingItems },
      });

      console.log(`      ✓ Inserted successfully`);
      insertedCount++;
    } catch (error) {
      console.error(`      ❌ Error inserting ${period}:`, error);
      throw error;
    }
  }

  // Step 4: Verify results
  console.log("\n=== Verification ===\n");
  const allRankings = await db
    .select({
      period: rankings.period,
      algorithmVersion: rankings.algorithmVersion,
      isCurrent: rankings.isCurrent,
      publishedAt: rankings.publishedAt,
    })
    .from(rankings)
    .orderBy(rankings.period);

  console.log("All ranking periods in database:");
  allRankings.forEach((r) => {
    const current = r.isCurrent ? " [CURRENT]" : "";
    console.log(`   ${r.period} - ${r.algorithmVersion}${current} - ${r.publishedAt?.toISOString()}`);
  });

  console.log("\n=== Summary ===");
  console.log(`✓ Periods inserted: ${insertedCount}`);
  console.log(`⏭️  Periods skipped: ${skippedCount}`);
  console.log(`📊 Total periods: ${allRankings.length}`);
  console.log(`✓ Current period: ${allRankings.find(r => r.isCurrent)?.period || "none"}`);

  // Verify data integrity
  console.log("\n=== Data Integrity Check ===");
  for (const r of allRankings) {
    const fullRanking = await db
      .select()
      .from(rankings)
      .where(eq(rankings.period, r.period))
      .limit(1);

    if (fullRanking.length > 0) {
      const data = fullRanking[0].data as any;
      const rankingsCount = data?.rankings?.length || 0;
      const status = rankingsCount > 0 ? "✓" : "❌";
      console.log(`   ${status} ${r.period}: ${rankingsCount} rankings`);
    }
  }

  console.log("\n✅ Historical rankings generation completed!");
  console.log("\n💡 Next steps:");
  console.log("   1. Verify trending chart now shows 5 data points");
  console.log("   2. Check that each period has valid data");
  console.log("   3. Confirm only 2025-09 is marked as current");
}

generateHistoricalRankings()
  .then(() => {
    console.log("\n✅ Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  });
