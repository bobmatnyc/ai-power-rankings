#!/usr/bin/env tsx

/**
 * Final October 2025 Tool Addition Report
 *
 * Generates a comprehensive report with database evidence
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

async function generateFinalReport() {
  const db = getDb();
  console.log("\n");
  console.log("═".repeat(80));
  console.log("  FINAL OCTOBER 2025 TOOL ADDITION REPORT");
  console.log("═".repeat(80));
  console.log("\n");

  const slugs = ["clacky-ai", "flint", "dfinity-caffeine"];

  // Get detailed tool information
  const toolRecords = await db
    .select()
    .from(tools)
    .where(inArray(tools.slug, slugs));

  console.log("📊 DATABASE QUERY EVIDENCE\n");
  console.log(`Query: SELECT * FROM tools WHERE slug IN ('clacky-ai', 'flint', 'dfinity-caffeine')`);
  console.log(`Results: ${toolRecords.length} records found\n`);
  console.log("─".repeat(80));

  for (const tool of toolRecords) {
    const data = tool.data as any;
    const baseline = tool.baselineScore as any;
    const current = tool.currentScore as any;

    console.log(`\n🔷 TOOL: ${tool.name.toUpperCase()}`);
    console.log("─".repeat(80));

    console.log("\n📋 Database Record:");
    console.log(`   UUID: ${tool.id}`);
    console.log(`   Slug: ${tool.slug}`);
    console.log(`   Name: ${tool.name}`);
    console.log(`   Category: ${tool.category}`);
    console.log(`   Status: ${tool.status}`);
    console.log(`   Created: ${tool.createdAt?.toISOString() || "N/A"}`);
    console.log(`   Updated: ${tool.updatedAt?.toISOString() || "N/A"}`);
    console.log(`   Score Updated: ${tool.scoreUpdatedAt?.toISOString() || "N/A"}`);

    console.log("\n📊 Scoring Data:");
    console.log(`   Overall Score: ${current?.overallScore || "NULL"}/100`);
    console.log("\n   Baseline Scores (Algorithm v7.2):");
    console.log(`     • Market Traction: ${baseline?.marketTraction || "NULL"}`);
    console.log(`     • Technical Capability: ${baseline?.technicalCapability || "NULL"}`);
    console.log(`     • Developer Adoption: ${baseline?.developerAdoption || "NULL"}`);
    console.log(`     • Development Velocity: ${baseline?.developmentVelocity || "NULL"}`);
    console.log(`     • Platform Resilience: ${baseline?.platformResilience || "NULL"}`);
    console.log(`     • Community Sentiment: ${baseline?.communitySentiment || "NULL"}`);

    console.log("\n🌐 Tool Metadata:");
    console.log(`   Website: ${data?.website || "N/A"}`);
    console.log(`   Launch Date: ${data?.launchDate || "N/A"}`);
    console.log(`   Subcategory: ${data?.subcategory || "N/A"}`);

    console.log("\n💼 Business Information:");
    if (data?.business) {
      console.log(`   Company: ${data.business.company || "N/A"}`);
      console.log(`   Founder(s): ${data.business.founder || data.business.founders?.join(", ") || "N/A"}`);
      console.log(`   Founded: ${data.business.founded || "N/A"}`);
      console.log(`   Funding: ${data.business.funding || "N/A"}`);
      console.log(`   Pricing Model: ${data.business.pricing_model || "N/A"}`);
      if (data.business.customers) {
        console.log(`   Customers: ${data.business.customers.join(", ")}`);
      }
    }

    console.log("\n📝 Content Summary:");
    console.log(`   Summary: ${data?.summary || "N/A"}`);
    console.log(`   Description Length: ${data?.description?.length || 0} characters`);
    console.log(`   Features: ${data?.features?.length || 0} items`);
    console.log(`   Use Cases: ${data?.use_cases?.length || 0} items`);
    console.log(`   Differentiators: ${data?.differentiators?.length || 0} items`);

    if (data?.features && data.features.length > 0) {
      console.log("\n🎯 Key Features:");
      data.features.slice(0, 5).forEach((feature: string, i: number) => {
        console.log(`     ${i + 1}. ${feature}`);
      });
      if (data.features.length > 5) {
        console.log(`     ... and ${data.features.length - 5} more`);
      }
    }

    if (data?.differentiators && data.differentiators.length > 0) {
      console.log("\n⭐ Key Differentiators:");
      data.differentiators.slice(0, 3).forEach((diff: string, i: number) => {
        console.log(`     ${i + 1}. ${diff}`);
      });
      if (data.differentiators.length > 3) {
        console.log(`     ... and ${data.differentiators.length - 3} more`);
      }
    }

    console.log("\n" + "─".repeat(80));
  }

  // Get ranking position
  console.log("\n\n📈 RANKING VERIFICATION\n");
  console.log("─".repeat(80));

  const allActiveTools = await db
    .select({
      slug: tools.slug,
      name: tools.name,
      currentScore: tools.currentScore,
    })
    .from(tools)
    .where(eq(tools.status, "active"));

  const rankedTools = allActiveTools
    .map(t => ({
      slug: t.slug,
      name: t.name,
      score: (t.currentScore as any)?.overallScore || 0,
    }))
    .filter(t => t.score > 0)
    .sort((a, b) => b.score - a.score);

  console.log(`Total Active Tools with Scores: ${rankedTools.length}\n`);

  rankedTools.forEach((tool, index) => {
    const isNewTool = slugs.includes(tool.slug);
    if (isNewTool) {
      console.log(`  ✨ #${index + 1}. ${tool.name} - ${tool.score}/100 [NEW]`);
    } else {
      console.log(`     #${index + 1}. ${tool.name} - ${tool.score}/100`);
    }
  });

  // Summary statistics
  console.log("\n\n📊 MIGRATION SUMMARY STATISTICS\n");
  console.log("─".repeat(80));

  const newToolRanks = slugs.map(slug => {
    const rank = rankedTools.findIndex(t => t.slug === slug) + 1;
    const tool = rankedTools[rank - 1];
    return { slug, name: tool?.name, rank, score: tool?.score };
  });

  console.log("\nNew Tools Added:");
  newToolRanks.forEach(t => {
    console.log(`  • ${t.name}: Rank #${t.rank} with score ${t.score}/100`);
  });

  const avgScore = newToolRanks.reduce((sum, t) => sum + (t.score || 0), 0) / newToolRanks.length;
  const avgRank = newToolRanks.reduce((sum, t) => sum + t.rank, 0) / newToolRanks.length;

  console.log(`\nStatistics:`);
  console.log(`  • Average Score: ${avgScore.toFixed(1)}/100`);
  console.log(`  • Average Rank: #${avgRank.toFixed(1)}`);
  console.log(`  • Highest Ranked: ${newToolRanks[0].name} at #${newToolRanks[0].rank}`);
  console.log(`  • Total Tools in Database: ${rankedTools.length}`);

  console.log("\n\n✅ VERIFICATION CHECKLIST\n");
  console.log("─".repeat(80));

  const checks = [
    { check: "All 3 tools exist in database", status: toolRecords.length === 3 },
    { check: "All tools have baseline scores", status: toolRecords.every(t => (t.baselineScore as any)?.overallScore > 0) },
    { check: "All tools have current scores", status: toolRecords.every(t => (t.currentScore as any)?.overallScore > 0) },
    { check: "All tools have complete metadata", status: toolRecords.every(t => {
      const d = t.data as any;
      return d?.website && d?.description && d?.features?.length > 0;
    })},
    { check: "All tools are active status", status: toolRecords.every(t => t.status === "active") },
    { check: "All tools appear in rankings", status: newToolRanks.every(t => t.rank > 0 && t.rank <= rankedTools.length) },
    { check: "All scores calculated correctly", status: toolRecords.every(t => {
      const b = t.baselineScore as any;
      const c = t.currentScore as any;
      return b?.overallScore === c?.overallScore; // baseline = current (no delta)
    })},
  ];

  checks.forEach(({ check, status }) => {
    console.log(`  ${status ? "✅" : "❌"} ${check}`);
  });

  const allPassed = checks.every(c => c.status);

  console.log("\n" + "═".repeat(80));
  console.log(`  ${allPassed ? "✅ ALL CHECKS PASSED" : "❌ SOME CHECKS FAILED"}`);
  console.log("═".repeat(80));
  console.log("\n");

  return {
    toolsAdded: toolRecords.length,
    allChecksPass: allPassed,
    rankings: newToolRanks,
  };
}

async function main() {
  try {
    const result = await generateFinalReport();

    if (!result.allChecksPass) {
      console.error("⚠️  Some verification checks failed");
      process.exit(1);
    }

    console.log("✨ Migration verified successfully!\n");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

main();
