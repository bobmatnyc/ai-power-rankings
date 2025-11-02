#!/usr/bin/env tsx

import { getDb, closeDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// Copy the exact calculation logic
function calculateMarketTractionDebug(metrics: any): number {
  let score = 0;
  const log: string[] = [];

  log.push(`\n=== Market Traction Calculation ===`);

  // Access actual metrics data
  const metricsData = (metrics as any).metrics || {};
  log.push(`metrics.metrics exists: ${!!metricsData}`);

  // ARR calculation
  const monthlyArr = metrics.info?.metrics?.monthly_arr ||
                    metrics.info?.metrics?.annual_recurring_revenue ||
                    metrics.info?.annual_recurring_revenue || 0;

  log.push(`\nARR Detection:`);
  log.push(`  metrics.info?.metrics?.monthly_arr: ${metrics.info?.metrics?.monthly_arr}`);
  log.push(`  metrics.info?.metrics?.annual_recurring_revenue: ${metrics.info?.metrics?.annual_recurring_revenue}`);
  log.push(`  metrics.info?.annual_recurring_revenue: ${metrics.info?.annual_recurring_revenue}`);
  log.push(`  Final monthlyArr: ${monthlyArr}`);

  if (monthlyArr >= 400000000) {
    score += 50;
    log.push(`  ✅ ARR >= $400M → +50 points`);
  } else if (monthlyArr >= 100000000) {
    score += 45;
    log.push(`  ✅ ARR >= $100M → +45 points`);
  } else if (monthlyArr > 0) {
    log.push(`  ℹ️  ARR = $${monthlyArr.toLocaleString()} (lower tier or no threshold met)`);
  } else {
    log.push(`  ❌ No ARR data found`);
  }

  log.push(`\nScore after ARR: ${score}`);

  // Pricing model fallback
  if (monthlyArr === 0) {
    const pricingModel = metrics.info?.business?.pricing_model || metrics.info?.pricing_model;
    const basePrice = metrics.info?.business?.base_price || 0;
    const hasEnterprise = metrics.info?.business?.enterprise_pricing;

    log.push(`\nPricing Model Fallback (no ARR):`);
    log.push(`  pricing_model: ${pricingModel}`);
    log.push(`  base_price: ${basePrice}`);
    log.push(`  has_enterprise: ${hasEnterprise}`);

    if (hasEnterprise) {
      score += 20;
      log.push(`  → +20 points (enterprise)`);
    } else if (pricingModel === "subscription" && basePrice >= 50) {
      score += 15;
      log.push(`  → +15 points (subscription $50+)`);
    } else if (pricingModel === "subscription" && basePrice >= 20) {
      score += 12;
      log.push(`  → +12 points (subscription $20+)`);
    } else if (pricingModel === "subscription") {
      score += 8;
      log.push(`  → +8 points (subscription)`);
    }
  } else {
    log.push(`\nSkipping pricing fallback (ARR exists)`);
  }

  log.push(`\n=== Final Market Traction Score: ${score} ===\n`);

  console.log(log.join('\n'));
  return score;
}

async function debugMarketTraction() {
  const db = getDb();

  const copilot = await db.select().from(tools).where(eq(tools.slug, "github-copilot")).limit(1);

  if (!copilot[0]) {
    console.log("Copilot not found!");
    await closeDb();
    return;
  }

  const toolData = copilot[0].data as any;
  const metrics = {
    tool_id: copilot[0].id,
    name: copilot[0].name,
    slug: copilot[0].slug,
    category: copilot[0].category,
    status: copilot[0].status,
    info: toolData,
    metrics: toolData.metrics || {},
  };

  console.log("\n🔍 Debugging GitHub Copilot Market Traction Calculation\n");
  const score = calculateMarketTractionDebug(metrics);

  console.log(`\n📊 Expected: 50+ points (has $400M ARR)`);
  console.log(`📊 Actual: ${score} points`);

  if (score < 50) {
    console.log(`\n❌ BUG DETECTED: Copilot should score 50+ for market traction!`);
  } else {
    console.log(`\n✅ Calculation is correct`);
  }

  await closeDb();
}

debugMarketTraction();
