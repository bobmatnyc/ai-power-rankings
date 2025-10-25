#!/usr/bin/env tsx

/**
 * Verification Script for Phase 3 Open Source Tool Updates
 *
 * Checks database to confirm all Phase 3 tool content updates were applied correctly.
 */

import { getDb, closeDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const PHASE3_TOOLS = [
  { name: "Aider", slug: "aider" },
  { name: "Continue", slug: "continue" },
  { name: "Google Gemini CLI", slug: "google-gemini-cli" },
  { name: "Qwen Code", slug: "qwen-code" },
  { name: "Mentat", slug: "mentat" },
  { name: "Open Interpreter", slug: "open-interpreter" },
];

async function verifyTool(db: any, slug: string, toolName: string) {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`Verifying: ${toolName} (${slug})`);
  console.log("=".repeat(80));

  try {
    const [tool] = await db.select().from(tools).where(eq(tools.slug, slug)).limit(1);

    if (!tool) {
      console.log(`❌ NOT FOUND in database`);
      return { found: false, slug, name: toolName };
    }

    console.log(`✅ Found in database`);

    // Get data from JSONB field
    const toolData = (tool.data || {}) as Record<string, any>;

    console.log(`\n📋 Tool Information:`);
    console.log(`  ID: ${tool.id}`);
    console.log(`  Name: ${tool.name}`);
    console.log(`  Company: ${toolData.company || "NOT SET"}`);
    console.log(`  Developer: ${toolData.developer || "NOT SET"}`);
    console.log(`  Category: ${tool.category}`);

    console.log(`\n📝 Content Quality:`);
    console.log(`  Overview: ${toolData.overview ? `${toolData.overview.length} chars` : "❌ MISSING"}`);
    console.log(`  Tagline: ${toolData.tagline ? `"${toolData.tagline.substring(0, 50)}..."` : "❌ MISSING"}`);
    console.log(`  Pricing: ${toolData.pricing ? `${JSON.stringify(toolData.pricing).length} chars` : "❌ MISSING"}`);

    console.log(`\n🔗 Links:`);
    console.log(`  Website: ${toolData.website || "NOT SET"}`);
    console.log(`  GitHub: ${toolData.github_url || toolData.githubRepo || "NOT SET"}`);
    console.log(`  Documentation: ${toolData.documentation_url || "NOT SET"}`);

    console.log(`\n⭐ Features:`);
    const features = toolData.features || toolData.key_features || toolData.keyFeatures || (toolData.info?.features);
    if (features && Array.isArray(features) && features.length > 0) {
      console.log(`  Total: ${features.length} features`);
      features.slice(0, 5).forEach((feature: string, idx: number) => {
        console.log(`    ${idx + 1}. ${feature.substring(0, 60)}...`);
      });
      if (features.length > 5) {
        console.log(`    ... and ${features.length - 5} more`);
      }
    } else {
      console.log(`  ❌ NO FEATURES DEFINED`);
    }

    console.log(`\n🎯 Target Audience:`);
    const audience = toolData.target_audience || toolData.targetAudience;
    if (audience) {
      if (typeof audience === 'string') {
        console.log(`  ${audience.substring(0, 100)}${audience.length > 100 ? '...' : ''}`);
      } else if (Array.isArray(audience) && audience.length > 0) {
        console.log(`  ${audience.join(", ")}`);
      } else {
        console.log(`  ❌ NOT SET`);
      }
    } else {
      console.log(`  ❌ NOT SET`);
    }

    console.log(`\n💡 Use Cases:`);
    const useCases = toolData.use_cases || toolData.useCases;
    if (useCases && Array.isArray(useCases) && useCases.length > 0) {
      useCases.forEach((useCase: string, idx: number) => {
        console.log(`    ${idx + 1}. ${useCase}`);
      });
    } else {
      console.log(`  ❌ NOT SET`);
    }

    // Completeness check
    const completeness: string[] = [];
    if (!toolData.overview) completeness.push("overview");
    if (!toolData.tagline) completeness.push("tagline");
    if (!toolData.pricing) completeness.push("pricing");
    if (!toolData.company && !toolData.developer) completeness.push("company/developer");
    if (!features || (Array.isArray(features) && features.length === 0)) completeness.push("features");
    if (!audience || (typeof audience === 'string' && audience.trim() === '') || (Array.isArray(audience) && audience.length === 0)) completeness.push("targetAudience");
    if (!useCases || (Array.isArray(useCases) && useCases.length === 0)) completeness.push("useCases");
    if (!toolData.github_url && !toolData.githubRepo) completeness.push("githubRepo");

    if (completeness.length === 0) {
      console.log(`\n✅ COMPLETE - All required fields populated`);
      return { found: true, complete: true, slug, name: toolName };
    } else {
      console.log(`\n⚠️  INCOMPLETE - Missing fields: ${completeness.join(", ")}`);
      return { found: true, complete: false, slug, name: toolName, missing: completeness };
    }
  } catch (error) {
    console.error(`❌ Error verifying tool:`, error);
    return { found: false, error: true, slug, name: toolName };
  }
}

async function main() {
  console.log("🔍 Phase 3 Open Source Tools - Content Verification");
  console.log("=".repeat(80));
  console.log(`\nVerifying ${PHASE3_TOOLS.length} tools...\n`);

  const db = getDb();
  const results = [];
  for (const tool of PHASE3_TOOLS) {
    const result = await verifyTool(db, tool.slug, tool.name);
    results.push(result);
  }

  // Summary
  console.log(`\n${"=".repeat(80)}`);
  console.log("📊 VERIFICATION SUMMARY");
  console.log("=".repeat(80));

  const foundTools = results.filter((r) => r.found);
  const notFoundTools = results.filter((r) => !r.found);
  const completeTools = results.filter((r) => r.found && r.complete);
  const incompleteTools = results.filter((r) => r.found && !r.complete);

  console.log(`\n✅ Found in Database: ${foundTools.length}/${PHASE3_TOOLS.length}`);
  console.log(`✅ Complete Content: ${completeTools.length}/${foundTools.length} found`);
  console.log(`⚠️  Incomplete Content: ${incompleteTools.length}/${foundTools.length} found`);
  console.log(`❌ Not Found: ${notFoundTools.length}/${PHASE3_TOOLS.length}`);

  if (completeTools.length > 0) {
    console.log(`\n✅ Tools with Complete Content:`);
    completeTools.forEach((tool: any) => {
      console.log(`  ✓ ${tool.name}`);
    });
  }

  if (incompleteTools.length > 0) {
    console.log(`\n⚠️  Tools with Incomplete Content:`);
    incompleteTools.forEach((tool: any) => {
      console.log(`  - ${tool.name}`);
      console.log(`    Missing: ${tool.missing.join(", ")}`);
    });
  }

  if (notFoundTools.length > 0) {
    console.log(`\n❌ Tools Not Found in Database:`);
    notFoundTools.forEach((tool: any) => {
      console.log(`  - ${tool.name} (${tool.slug})`);
    });
    console.log(`\n📋 Action Required:`);
    console.log(`  These tools need to be added to the database before content can be updated.`);
  }

  console.log(`\n${"=".repeat(80)}`);
  console.log("\n✨ Verification completed!\n");

  closeDb();

  return {
    total: PHASE3_TOOLS.length,
    found: foundTools.length,
    complete: completeTools.length,
    incomplete: incompleteTools.length,
    notFound: notFoundTools.length,
  };
}

main()
  .then((summary) => {
    console.log(`Total: ${summary.total}, Found: ${summary.found}, Complete: ${summary.complete}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Verification failed:", error);
    closeDb();
    process.exit(1);
  });
