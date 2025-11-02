#!/usr/bin/env tsx

import { getDb, closeDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";

async function compareAdoption() {
  const db = getDb();

  const toolNames = ["jules", "github-copilot", "cursor", "claude-code"];
  const result = await db.select().from(tools).where(inArray(tools.slug, toolNames));

  console.log("\n" + "=".repeat(100));
  console.log("ADOPTION METRICS COMPARISON");
  console.log("=".repeat(100));

  for (const tool of result) {
    const data = tool.data as any;
    const metrics = data.metrics || {};

    console.log(`\n${tool.name.toUpperCase()} (${tool.slug})`);
    console.log("-".repeat(100));

    console.log("📊 Download/Install Metrics:");
    console.log("  VS Code installs:      ", metrics.vscode?.installs?.toLocaleString() || "N/A");
    console.log("  npm downloads (month): ", metrics.npm?.downloads_last_month?.toLocaleString() || "N/A");
    console.log("  PyPI downloads (month):", metrics.pypi?.downloads_last_month?.toLocaleString() || "N/A");

    console.log("\n🌟 Engagement Metrics:");
    console.log("  GitHub stars:          ", metrics.github?.stars?.toLocaleString() || "N/A");
    console.log("  User count:            ", (data.info?.metrics?.users || data.user_count || "N/A"));
    console.log("  News mentions:         ", data.info?.metrics?.news_mentions || "N/A");

    console.log("\n💰 Business Metrics:");
    console.log("  Revenue/ARR:           ", (data.info?.metrics?.monthly_arr || data.info?.metrics?.annual_recurring_revenue || "N/A"));
    console.log("  Pricing model:         ", data.info?.business?.pricing_model || data.pricing_model || "N/A");
    console.log("  Company:               ", data.info?.company || data.info?.company_name || "N/A");

    console.log("\n🔬 Technical Metrics:");
    console.log("  SWE-bench verified:    ", data.info?.metrics?.swe_bench?.verified || "N/A");
    console.log("  Context window:        ", data.info?.technical?.context_window?.toLocaleString() || "N/A");
    console.log("  Multi-file support:    ", data.info?.technical?.multi_file_support || "N/A");
  }

  console.log("\n" + "=".repeat(100));
  console.log("KEY INSIGHTS:");
  console.log("=".repeat(100));

  const jules = result.find(t => t.slug === "jules");
  const copilot = result.find(t => t.slug === "github-copilot");
  const cursor = result.find(t => t.slug === "cursor");

  if (jules && copilot) {
    const julesInstalls = (jules.data as any).metrics?.vscode?.installs || 0;
    const copilotInstalls = (copilot.data as any).metrics?.vscode?.installs || 0;

    console.log(`\n📉 GitHub Copilot has ${Math.round(copilotInstalls / julesInstalls).toLocaleString()}x more VS Code installs than Jules`);
    console.log(`   Copilot: ${copilotInstalls.toLocaleString()} vs Jules: ${julesInstalls.toLocaleString()}`);
  }

  console.log("\n🎯 Problem: Jules ranks #1 despite having minimal adoption metrics");
  console.log("   Solution: Increase developer adoption weight to 22% and market traction to 18%");

  await closeDb();
}

compareAdoption();
