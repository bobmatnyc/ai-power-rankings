#!/usr/bin/env tsx

import { getDb, closeDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function debugCopilot() {
  const db = getDb();

  const copilot = await db.select().from(tools).where(eq(tools.slug, "github-copilot")).limit(1);

  if (!copilot[0]) {
    console.log("Copilot not found!");
    await closeDb();
    return;
  }

  const data = copilot[0].data as any;

  console.log("\n=== GitHub Copilot Data Paths ===\n");

  console.log("Top-level data structure:");
  console.log("  data.info exists:", !!data.info);
  console.log("  data.info.metrics exists:", !!data.info?.metrics);
  console.log("  data.info.business exists:", !!data.info?.business);
  console.log("  data.metrics exists:", !!data.metrics);

  console.log("\n💰 ARR/Revenue Paths:");
  console.log("  data.info.metrics.monthly_arr:", data.info?.metrics?.monthly_arr);
  console.log("  data.info.metrics.annual_recurring_revenue:", data.info?.metrics?.annual_recurring_revenue);
  console.log("  data.info.annual_recurring_revenue:", data.info?.annual_recurring_revenue);
  console.log("  data.annual_recurring_revenue:", data.annual_recurring_revenue);

  console.log("\n📦 Pricing Paths:");
  console.log("  data.info.business.pricing_model:", data.info?.business?.pricing_model);
  console.log("  data.pricing_model:", data.pricing_model);
  console.log("  data.info.business.base_price:", data.info?.business?.base_price);

  console.log("\n📊 User/Adoption Paths:");
  console.log("  data.info.metrics.users:", data.info?.metrics?.users);
  console.log("  data.info.user_count:", data.info?.user_count);
  console.log("  data.user_count:", data.user_count);
  console.log("  data.info.metrics.news_mentions:", data.info?.metrics?.news_mentions);

  console.log("\n🔢 Metrics object:");
  console.log("  data.metrics.vscode.installs:", data.metrics?.vscode?.installs);
  console.log("  data.metrics.npm.downloads_last_month:", data.metrics?.npm?.downloads_last_month);
  console.log("  data.metrics.github.stars:", data.metrics?.github?.stars);

  // Test the exact logic from the algorithm
  const monthlyArr = data.info?.metrics?.monthly_arr ||
                    data.info?.metrics?.annual_recurring_revenue ||
                    data.info?.annual_recurring_revenue || 0;

  console.log("\n=== Algorithm Logic Test ===");
  console.log("  monthlyArr calculated value:", monthlyArr);
  console.log("  monthlyArr >= 400000000:", monthlyArr >= 400000000);

  if (monthlyArr >= 400000000) {
    console.log("  ✅ Should get 50 points for ARR");
  } else if (monthlyArr === 0) {
    console.log("  ⚠️  Would fall through to pricing model fallback");
  }

  await closeDb();
}

debugCopilot();
