#!/usr/bin/env tsx

/**
 * Verify October 2025 Tool Additions
 *
 * Checks that ClackyAI, Flint, and DFINITY Caffeine have complete data and scoring
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function verifyTools() {
  const db = getDb();
  console.log("🔍 Verifying October 2025 Tool Additions\n");
  console.log("=".repeat(80));

  const slugsToCheck = ["clacky-ai", "flint", "dfinity-caffeine"];

  for (const slug of slugsToCheck) {
    try {
      const result = await db
        .select()
        .from(tools)
        .where(eq(tools.slug, slug))
        .limit(1);

      if (result.length === 0) {
        console.log(`\n❌ Tool NOT FOUND: ${slug}`);
        continue;
      }

      const tool = result[0];
      const data = tool.data as any;
      const currentScore = tool.currentScore as any;
      const baselineScore = tool.baselineScore as any;

      console.log(`\n✅ ${tool.name}`);
      console.log("─".repeat(80));
      console.log(`   ID: ${tool.id}`);
      console.log(`   Slug: ${tool.slug}`);
      console.log(`   Category: ${tool.category}`);
      console.log(`   Status: ${tool.status}`);

      console.log(`\n   📊 SCORING:`);
      console.log(`   Overall Score: ${currentScore?.overallScore || "NULL"}/100`);
      console.log(`   Baseline Scores:`);
      console.log(`     - Market Traction: ${baselineScore?.marketTraction || "NULL"}`);
      console.log(`     - Technical Capability: ${baselineScore?.technicalCapability || "NULL"}`);
      console.log(`     - Developer Adoption: ${baselineScore?.developerAdoption || "NULL"}`);
      console.log(`     - Development Velocity: ${baselineScore?.developmentVelocity || "NULL"}`);
      console.log(`     - Platform Resilience: ${baselineScore?.platformResilience || "NULL"}`);
      console.log(`     - Community Sentiment: ${baselineScore?.communitySentiment || "NULL"}`);

      console.log(`\n   📝 METADATA:`);
      console.log(`   Website: ${data?.website || "N/A"}`);
      console.log(`   Launch Date: ${data?.launchDate || "N/A"}`);
      console.log(`   Subcategory: ${data?.subcategory || "N/A"}`);
      console.log(`   Features: ${data?.features?.length || 0} features`);
      console.log(`   Use Cases: ${data?.use_cases?.length || 0} use cases`);
      console.log(`   Differentiators: ${data?.differentiators?.length || 0} differentiators`);

      if (data?.summary) {
        console.log(`\n   📄 SUMMARY:`);
        console.log(`   ${data.summary}`);
      }

      if (data?.business) {
        console.log(`\n   💼 BUSINESS:`);
        console.log(`   Company: ${data.business.company || "N/A"}`);
        console.log(`   Founder: ${data.business.founder || data.business.founders?.join(", ") || "N/A"}`);
        console.log(`   Funding: ${data.business.funding || "N/A"}`);
        console.log(`   Pricing: ${data.business.pricing_model || "N/A"}`);
      }

      console.log(`\n   ✅ DATA COMPLETENESS CHECK:`);
      const checks = {
        "Has Name": !!tool.name,
        "Has Slug": !!tool.slug,
        "Has Category": !!tool.category,
        "Has Overall Score": !!currentScore?.overallScore,
        "Has Baseline Score": !!baselineScore && Object.keys(baselineScore).length > 0,
        "Has Website": !!data?.website,
        "Has Description": !!data?.description,
        "Has Features": !!data?.features && data.features.length > 0,
        "Has Summary": !!data?.summary,
        "Has Business Info": !!data?.business,
      };

      for (const [check, passed] of Object.entries(checks)) {
        console.log(`   ${passed ? "✓" : "✗"} ${check}`);
      }

      const allPassed = Object.values(checks).every(v => v);
      console.log(`\n   ${allPassed ? "✅ ALL CHECKS PASSED" : "⚠️  SOME CHECKS FAILED"}`);

    } catch (error) {
      console.error(`\n❌ Error checking ${slug}:`, error);
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("✨ Verification completed!\n");
}

async function main() {
  try {
    await verifyTools();
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

main();
