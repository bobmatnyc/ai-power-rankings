#!/usr/bin/env tsx

/**
 * Debug Innovation Score Calculation
 *
 * Step-by-step debugging of the innovation calculation
 * to find where the 87.0 comes from.
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function debugInnovation() {
  const db = getDb();
  console.log("\n🐛 Debugging Innovation Score Calculation\n");
  console.log("=".repeat(80));

  const result = await db
    .select()
    .from(tools)
    .where(eq(tools.slug, 'github-copilot'))
    .limit(1);

  if (result.length === 0) {
    console.log("❌ GitHub Copilot not found!");
    await closeDb();
    return;
  }

  const tool = result[0];
  const toolData = tool.data as any;
  const info = toolData.info || {};

  console.log("\n📊 Step-by-Step Innovation Calculation\n");

  // Step 1: Base score
  let score = 30;
  console.log(`Step 1 - Base Score: ${score}`);

  // Step 2: Feature count
  const featureCount = (info.features || []).length;
  console.log(`\nStep 2 - Feature Count: ${featureCount} features`);

  if (featureCount > 0) {
    const featureCalc = 30 + featureCount * 3;
    console.log(`  Calculation: 30 + (${featureCount} × 3) = ${featureCalc}`);
    score = Math.min(85, featureCalc);
    console.log(`  Score after min(85, ${featureCalc}): ${score}`);
  }

  // Step 3: Innovation keywords
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

  const description = `${info.summary || ""} ${info.description || ""}`;
  const matchedKeywords = innovativeKeywords.filter((keyword) =>
    description.toLowerCase().includes(keyword)
  );

  console.log(`\nStep 3 - Innovation Keywords: ${matchedKeywords.length} matched`);
  console.log(`  Keywords: ${matchedKeywords.join(', ')}`);

  const keywordBonus = matchedKeywords.length * 8;
  console.log(`  Calculation: ${matchedKeywords.length} × 8 = ${keywordBonus}`);
  score = score + keywordBonus;
  console.log(`  Score after keywords: ${score}`);

  // Step 4: Performance innovations
  console.log(`\nStep 4 - Performance Innovations:`);
  const performance = info.technical?.performance;

  let performanceBonus = 0;
  if (performance?.mixture_of_experts) {
    performanceBonus += 5;
    console.log(`  Mixture of Experts: +5`);
  } else {
    console.log(`  Mixture of Experts: Not found (0)`);
  }

  if (performance?.speculative_decoding) {
    performanceBonus += 5;
    console.log(`  Speculative Decoding: +5`);
  } else {
    console.log(`  Speculative Decoding: Not found (0)`);
  }

  if (performance?.indexing_speed) {
    performanceBonus += 3;
    console.log(`  Indexing Speed: +3`);
  } else {
    console.log(`  Indexing Speed: Not found (0)`);
  }

  console.log(`  Total Performance Bonus: ${performanceBonus}`);
  score = score + performanceBonus;
  console.log(`  Score after performance: ${score}`);

  // Step 5: Maturity bonus
  console.log(`\nStep 5 - Maturity Bonus:`);
  const launchYear = info.launch_year;
  console.log(`  Launch Year: ${launchYear || 'Not set'}`);

  let maturityBonus = 0;
  if (launchYear) {
    const currentYear = new Date().getFullYear();
    const age = currentYear - launchYear;
    console.log(`  Age: ${age} years (${currentYear} - ${launchYear})`);

    if (age >= 1 && age <= 3) {
      maturityBonus = 10;
      console.log(`  Bonus for 1-3 years: +10`);
    } else if (age >= 4 && age <= 5) {
      maturityBonus = 5;
      console.log(`  Bonus for 4-5 years: +5`);
    } else if (age < 1) {
      maturityBonus = 3;
      console.log(`  Bonus for < 1 year: +3`);
    } else {
      maturityBonus = 0;
      console.log(`  Bonus for > 5 years: 0`);
    }
  } else {
    console.log(`  No launch year → Bonus: 0`);
  }

  score = score + maturityBonus;
  console.log(`  Score after maturity: ${score}`);

  // Step 6: Cap at 100
  const finalScore = Math.min(100, score);
  console.log(`\nStep 6 - Final Score: min(100, ${score}) = ${finalScore}`);

  console.log("\n" + "=".repeat(80));
  console.log(`\n🎯 FINAL INNOVATION SCORE: ${finalScore}`);
  console.log(`📊 Stored in Database: 87.0`);
  console.log(`❓ Difference: ${Math.abs(finalScore - 87.0).toFixed(1)} points`);

  if (finalScore !== 87.0) {
    console.log(`\n⚠️  MISMATCH DETECTED!`);
    console.log(`\nPossible Reasons:`);
    console.log(`1. Data has changed since rankings were generated`);
    console.log(`2. Algorithm has been modified since rankings were created`);
    console.log(`3. Feature list was different when rankings were created`);
    console.log(`4. Description text has been updated`);
    console.log(`\nRecommendation: Re-generate rankings to sync database with current algorithm`);
  } else {
    console.log(`\n✅ Score matches database! Calculation is correct.`);
  }

  console.log("\n" + "=".repeat(80));
  console.log("\n✅ Debug Complete\n");

  await closeDb();
}

debugInnovation().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
