#!/usr/bin/env tsx

import { getDb, closeDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function inspectJules() {
  const db = getDb();

  const result = await db.select().from(tools).where(eq(tools.slug, "jules")).limit(1);

  if (result[0]) {
    console.log("\n=== Jules Data ===");
    console.log("Name:", result[0].name);
    console.log("Slug:", result[0].slug);
    console.log("\nMetrics data:");
    const data = result[0].data as any;

    // Check for actual metrics
    console.log("\nVS Code installs:", data.metrics?.vscode?.installs || "N/A");
    console.log("npm downloads:", data.metrics?.npm?.downloads_last_month || "N/A");
    console.log("GitHub stars:", data.metrics?.github?.stars || "N/A");
    console.log("PyPI downloads:", data.metrics?.pypi?.downloads_last_month || "N/A");
    console.log("User count:", data.metrics?.users || data.user_count || "N/A");
    console.log("Revenue:", data.metrics?.monthly_arr || data.annual_recurring_revenue || "N/A");
    console.log("News mentions:", data.metrics?.news_mentions || "N/A");

    console.log("\nDescription length:", data.description?.length || 0);
    console.log("Features count:", data.features?.length || 0);
    console.log("Company:", data.company || data.company_name || "N/A");
    console.log("Pricing model:", data.business?.pricing_model || data.pricing_model || "N/A");

    console.log("\n=== Full Data ===");
    console.log(JSON.stringify(data, null, 2));
  }

  await closeDb();
}

inspectJules();
