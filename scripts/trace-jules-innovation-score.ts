#!/usr/bin/env tsx

/**
 * Trace Jules Innovation Score Calculation
 * Shows step-by-step how the innovation score reaches 110
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

function calculateMaturityBonus(launchYear?: number): number {
  if (!launchYear) return 0;

  const currentYear = new Date().getFullYear();
  const age = currentYear - launchYear;

  // Sweet spot: 1-3 years (established but modern)
  if (age >= 1 && age <= 3) return 10;
  if (age >= 4 && age <= 5) return 5;
  if (age < 1) return 3; // New but unproven
  return 0; // Too old might be outdated
}

async function traceInnovationScore(slug: string) {
  const db = getDb();
  const toolRecords = await db.select().from(tools).where(eq(tools.slug, slug));

  if (toolRecords.length === 0) {
    console.log(`Tool not found: ${slug}`);
    return;
  }

  const tool = toolRecords[0];
  const info = tool.info as any;

  console.log("=".repeat(100));
  console.log(`🔍 TRACING INNOVATION SCORE: ${tool.name}`);
  console.log("=".repeat(100));

  console.log("\n📋 Tool Info:");
  console.log(`  Name: ${tool.name}`);
  console.log(`  Slug: ${tool.slug}`);
  console.log(`  Category: ${tool.category}`);
  console.log(`  Launch Year: ${info?.launch_year || 'N/A'}`);

  let score = 30;
  console.log(`\n🎯 Innovation Score Calculation:`);
  console.log(`  Base score: ${score}`);

  // Step 1: Feature count
  const featureCount = info?.features?.length || 0;
  console.log(`\n  Step 1: Feature Count = ${featureCount}`);
  if (featureCount > 0) {
    const featureScore = Math.min(85, 30 + featureCount * 3);
    console.log(`    Formula: min(85, 30 + ${featureCount} * 3) = min(85, ${30 + featureCount * 3}) = ${featureScore}`);
    score = featureScore;
    console.log(`    Score after features: ${score}`);
  }

  // Step 2: Innovation keywords
  const innovativeKeywords = [
    "specification-driven",
    "autonomous",
    "agent",
    "mcp",
    "scaffolding",
    "multi-modal",
    "reasoning",
    "planning",
    "orchestration",
    "background agent",
    "speculative",
  ];

  const description = `${info?.summary || ""} ${info?.description || ""}`;
  const matchedKeywords = innovativeKeywords.filter((keyword) =>
    description.toLowerCase().includes(keyword)
  );

  console.log(`\n  Step 2: Innovation Keywords (${matchedKeywords.length} matched)`);
  matchedKeywords.forEach(kw => console.log(`    ✓ "${kw}"`));

  const beforeCap = score + matchedKeywords.length * 8;
  const afterCap = Math.min(100, beforeCap);
  console.log(`    Formula: min(100, ${score} + ${matchedKeywords.length} * 8) = min(100, ${beforeCap}) = ${afterCap}`);
  score = afterCap;
  console.log(`    Score after keywords (capped at 100): ${score}`);

  // Step 3: Performance innovations (ADDED AFTER CAP!)
  console.log(`\n  Step 3: Performance Innovations (⚠️  ADDED AFTER 100 CAP)`);
  const performance = info?.technical?.performance;
  let perfBonus = 0;
  if (performance) {
    if (performance.mixture_of_experts) {
      console.log(`    ✓ mixture_of_experts: +5`);
      perfBonus += 5;
    }
    if (performance.speculative_decoding) {
      console.log(`    ✓ speculative_decoding: +5`);
      perfBonus += 5;
    }
    if (performance.indexing_speed) {
      console.log(`    ✓ indexing_speed: +3`);
      perfBonus += 3;
    }
  } else {
    console.log(`    No performance innovations found`);
  }
  score += perfBonus;
  console.log(`    Score after performance: ${score}`);

  // Step 4: Maturity bonus (ALSO ADDED AFTER CAP!)
  const maturityBonus = calculateMaturityBonus(info?.launch_year);
  console.log(`\n  Step 4: Maturity Bonus (⚠️  ALSO ADDED AFTER 100 CAP)`);
  console.log(`    Launch year: ${info?.launch_year || 'N/A'}`);
  console.log(`    Maturity bonus: +${maturityBonus}`);
  score += maturityBonus;

  console.log(`\n  ❌ FINAL INNOVATION SCORE: ${score} (EXCEEDS MAX OF 100!)\n`);

  console.log("=".repeat(100));
  console.log("🐛 BUG IDENTIFIED:");
  console.log("=".repeat(100));
  console.log("\nLine 362: score = Math.min(100, score + matchedKeywords * 8);");
  console.log("    ↑ Caps score at 100");
  console.log("\nLines 367-369: Add performance bonuses (5 + 5 + 3 = up to 13 points)");
  console.log("    ↑ ❌ ADDED AFTER THE CAP!");
  console.log("\nLine 373: score += calculateMaturityBonus(metrics);");
  console.log("    ↑ ❌ ADDED AFTER THE CAP! (up to 10 points)");
  console.log("\nResult: Scores can reach 100 + 13 + 10 = 123 (way over limit)");
  console.log("\n💡 FIX: Move the Math.min(100, score) cap to the FINAL return statement\n");

  // Show features if available
  if (info?.features && Array.isArray(info.features) && info.features.length > 0) {
    console.log("\n📝 Features List:");
    info.features.forEach((feature: string, idx: number) => {
      console.log(`  ${idx + 1}. ${feature}`);
    });
  }

  await closeDb();
}

async function main() {
  await traceInnovationScore('google-jules');

  console.log("\n\n");
  console.log("=".repeat(100));
  console.log("📊 COMPARISON WITH OTHER TOP TOOLS");
  console.log("=".repeat(100));

  const compareTools = ['devin', 'refact-ai', 'cursor', 'windsurf'];
  for (const slug of compareTools) {
    await traceInnovationScore(slug);
    console.log("\n");
  }
}

main().catch(console.error);
