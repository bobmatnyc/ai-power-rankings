#!/usr/bin/env tsx

/**
 * Verification Script for Phase 1 Tool Updates
 *
 * Verifies that all 5 Phase 1 tools have been successfully updated with:
 * - Complete company information
 * - Comprehensive overview
 * - Full pricing tiers
 * - Key features
 * - Target audience
 * - Use cases
 * - Integrations
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const PHASE1_TOOLS = [
  "github-copilot",
  "cursor",
  "replit-agent",
  "claude-code",
  "devin"
];

interface VerificationResult {
  slug: string;
  name: string;
  hasCompany: boolean;
  hasWebsite: boolean;
  hasOverview: boolean;
  overviewLength: number;
  featuresCount: number;
  pricingTiersCount: number;
  hasTargetAudience: boolean;
  useCasesCount: number;
  integrationsCount: number;
  allFieldsComplete: boolean;
}

async function verifyTool(slug: string): Promise<VerificationResult> {
  const db = getDb();
  const result = await db.select().from(tools).where(eq(tools.slug, slug));

  if (result.length === 0) {
    throw new Error(`Tool not found: ${slug}`);
  }

  const tool = result[0];
  const toolData = tool.data as Record<string, any> || {};

  const hasCompany = !!toolData.company && toolData.company.trim() !== '';
  const hasWebsite = !!toolData.website && toolData.website.trim() !== '';
  const hasOverview = !!toolData.overview && toolData.overview.trim() !== '';
  const overviewLength = toolData.overview ? toolData.overview.length : 0;
  const featuresCount = Array.isArray(toolData.features) ? toolData.features.length : 0;
  const pricingTiersCount = toolData.pricing?.tiers ? toolData.pricing.tiers.length : 0;
  const hasTargetAudience = !!toolData.target_audience && toolData.target_audience.trim() !== '';
  const useCasesCount = Array.isArray(toolData.use_cases) ? toolData.use_cases.length : 0;
  const integrationsCount = Array.isArray(toolData.integrations) ? toolData.integrations.length : 0;

  const allFieldsComplete = hasCompany &&
                           hasWebsite &&
                           hasOverview &&
                           overviewLength >= 100 &&
                           featuresCount >= 8 &&
                           pricingTiersCount >= 3 &&
                           hasTargetAudience &&
                           useCasesCount >= 5 &&
                           integrationsCount >= 5;

  return {
    slug,
    name: tool.name,
    hasCompany,
    hasWebsite,
    hasOverview,
    overviewLength,
    featuresCount,
    pricingTiersCount,
    hasTargetAudience,
    useCasesCount,
    integrationsCount,
    allFieldsComplete
  };
}

async function main() {
  console.log("\n" + "=".repeat(80));
  console.log("🔍 PHASE 1 TOOLS - VERIFICATION REPORT");
  console.log("=".repeat(80));
  console.log(`\nVerifying ${PHASE1_TOOLS.length} updated tools...\n`);

  const results: VerificationResult[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const slug of PHASE1_TOOLS) {
    try {
      const result = await verifyTool(slug);
      results.push(result);

      if (result.allFieldsComplete) {
        successCount++;
      } else {
        failureCount++;
      }
    } catch (error) {
      console.error(`❌ Error verifying ${slug}:`, error);
      failureCount++;
    }
  }

  // Display detailed results for each tool
  console.log("📊 DETAILED VERIFICATION RESULTS:\n");

  for (const result of results) {
    const status = result.allFieldsComplete ? "✅" : "⚠️";
    console.log(`${status} ${result.name} (${result.slug})`);
    console.log(`   Company: ${result.hasCompany ? "✅" : "❌"}`);
    console.log(`   Website: ${result.hasWebsite ? "✅" : "❌"}`);
    console.log(`   Overview: ${result.hasOverview ? `✅ (${result.overviewLength} chars)` : "❌"}`);
    console.log(`   Features: ${result.featuresCount >= 8 ? "✅" : "⚠️"} (${result.featuresCount} features)`);
    console.log(`   Pricing Tiers: ${result.pricingTiersCount >= 3 ? "✅" : "⚠️"} (${result.pricingTiersCount} tiers)`);
    console.log(`   Target Audience: ${result.hasTargetAudience ? "✅" : "❌"}`);
    console.log(`   Use Cases: ${result.useCasesCount >= 5 ? "✅" : "⚠️"} (${result.useCasesCount} cases)`);
    console.log(`   Integrations: ${result.integrationsCount >= 5 ? "✅" : "⚠️"} (${result.integrationsCount} integrations)`);
    console.log();
  }

  // Summary
  console.log("=".repeat(80));
  console.log("📈 VERIFICATION SUMMARY");
  console.log("=".repeat(80));
  console.log(`\nTotal Tools: ${PHASE1_TOOLS.length}`);
  console.log(`✅ Complete: ${successCount}/${PHASE1_TOOLS.length}`);
  console.log(`⚠️  Incomplete: ${failureCount}/${PHASE1_TOOLS.length}`);

  const successRate = (successCount / PHASE1_TOOLS.length) * 100;
  console.log(`\n🎯 Success Rate: ${successRate.toFixed(1)}%`);

  if (successCount === PHASE1_TOOLS.length) {
    console.log("\n🎉 PHASE 1 COMPLETE! All tools updated successfully.");
  } else {
    console.log("\n⚠️  Some tools need attention. Review incomplete fields above.");
  }

  console.log("=".repeat(80));
}

main()
  .catch((error) => {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  })
  .finally(() => {
    closeDb();
  });
