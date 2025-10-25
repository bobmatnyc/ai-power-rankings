#!/usr/bin/env tsx

/**
 * Detailed QA Verification Script for Phase 3 Open Source Tools
 *
 * Performs comprehensive quality checks on:
 * - Aider
 * - Google Gemini CLI
 * - Qwen Code
 *
 * Verifies content completeness, accuracy, and open source focus.
 */

import { getDb, closeDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const PHASE3_TOOLS_IN_DB = [
  { name: "Aider", slug: "aider" },
  { name: "Google Gemini CLI", slug: "google-gemini-cli" },
  { name: "Qwen Code", slug: "qwen-code" },
];

interface QAIssue {
  severity: "critical" | "warning" | "info";
  field: string;
  message: string;
}

async function verifyToolQuality(db: any, slug: string, toolName: string) {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`🔍 QA VERIFICATION: ${toolName}`);
  console.log("=".repeat(80));

  const issues: QAIssue[] = [];

  try {
    const [tool] = await db.select().from(tools).where(eq(tools.slug, slug)).limit(1);

    if (!tool) {
      console.log(`❌ CRITICAL: Tool not found in database`);
      return { slug, name: toolName, found: false, issues: [{ severity: "critical", field: "database", message: "Tool not found" }] };
    }

    const toolData = (tool.data || {}) as Record<string, any>;

    // 1. CONTENT COMPLETENESS CHECK
    console.log(`\n📋 1. CONTENT COMPLETENESS`);
    console.log("-".repeat(80));

    // Developer/Organization
    const company = toolData.company || toolData.developer;
    if (!company) {
      issues.push({ severity: "critical", field: "company/developer", message: "Missing developer/organization" });
      console.log(`  ❌ Developer/Organization: MISSING`);
    } else {
      console.log(`  ✅ Developer/Organization: ${company}`);
    }

    // GitHub URL
    const githubUrl = toolData.github_url || toolData.githubRepo;
    if (!githubUrl) {
      issues.push({ severity: "critical", field: "github_url", message: "Missing GitHub repository URL" });
      console.log(`  ❌ GitHub URL: MISSING`);
    } else {
      console.log(`  ✅ GitHub URL: ${githubUrl}`);
    }

    // Overview length check
    const overview = toolData.overview || "";
    const overviewWords = overview.split(/\s+/).length;
    if (!overview) {
      issues.push({ severity: "critical", field: "overview", message: "Missing overview" });
      console.log(`  ❌ Overview: MISSING`);
    } else if (overviewWords < 100) {
      issues.push({ severity: "warning", field: "overview", message: `Overview too short (${overviewWords} words, expected 100+)` });
      console.log(`  ⚠️  Overview: ${overviewWords} words (expected 100+)`);
    } else {
      console.log(`  ✅ Overview: ${overviewWords} words`);
    }

    // Pricing
    if (!toolData.pricing) {
      issues.push({ severity: "critical", field: "pricing", message: "Missing pricing information" });
      console.log(`  ❌ Pricing: MISSING`);
    } else {
      const pricingTiers = toolData.pricing.tiers || [];
      console.log(`  ✅ Pricing: ${pricingTiers.length} tiers configured`);
    }

    // Features
    const features = toolData.features || toolData.key_features || [];
    if (!features || features.length < 8) {
      issues.push({ severity: "warning", field: "features", message: `Only ${features.length} features (expected 8+)` });
      console.log(`  ⚠️  Features: ${features.length} (expected 8+)`);
    } else {
      console.log(`  ✅ Features: ${features.length} features`);
    }

    // Website
    if (!toolData.website) {
      issues.push({ severity: "warning", field: "website", message: "Missing website URL" });
      console.log(`  ⚠️  Website: MISSING`);
    } else {
      console.log(`  ✅ Website: ${toolData.website}`);
    }

    // License
    if (!toolData.license) {
      issues.push({ severity: "critical", field: "license", message: "Missing license information" });
      console.log(`  ❌ License: MISSING`);
    } else {
      console.log(`  ✅ License: ${toolData.license}`);
    }

    // 2. OPEN SOURCE CONTENT QUALITY
    console.log(`\n🌟 2. OPEN SOURCE FOCUS VERIFICATION`);
    console.log("-".repeat(80));

    // Check for "open source" mentions in overview
    const overviewLower = overview.toLowerCase();
    const hasOpenSourceMention = overviewLower.includes("open source") || overviewLower.includes("open-source");
    if (!hasOpenSourceMention) {
      issues.push({ severity: "warning", field: "overview", message: "Overview doesn't emphasize open source nature" });
      console.log(`  ⚠️  Open source mention in overview: NOT FOUND`);
    } else {
      console.log(`  ✅ Open source mentioned in overview`);
    }

    // GitHub metrics presence
    const githubMetrics = toolData.github_metrics || {};
    if (!githubMetrics.stars) {
      issues.push({ severity: "critical", field: "github_metrics", message: "Missing GitHub star count" });
      console.log(`  ❌ GitHub metrics: MISSING`);
    } else {
      console.log(`  ✅ GitHub stars: ${githubMetrics.stars}`);
      console.log(`  ✅ GitHub forks: ${githubMetrics.forks || "N/A"}`);
      console.log(`  ✅ Contributors: ${githubMetrics.contributors || "N/A"}`);
    }

    // Free tier verification
    const hasFreeOpen = toolData.pricing?.model?.toLowerCase().includes("free") ||
                        toolData.pricing?.model?.toLowerCase().includes("open source");
    if (!hasFreeOpen) {
      issues.push({ severity: "warning", field: "pricing", message: "Pricing model doesn't emphasize free/open source" });
      console.log(`  ⚠️  Free/open source pricing: NOT EMPHASIZED`);
    } else {
      console.log(`  ✅ Free/open source nature in pricing`);
    }

    // Open source benefits
    if (!toolData.open_source_benefits || toolData.open_source_benefits.length === 0) {
      issues.push({ severity: "info", field: "open_source_benefits", message: "No open source benefits listed" });
      console.log(`  ℹ️  Open source benefits: NOT LISTED`);
    } else {
      console.log(`  ✅ Open source benefits: ${toolData.open_source_benefits.length} listed`);
    }

    // 3. DATA ACCURACY SPOT CHECK
    console.log(`\n🎯 3. DATA ACCURACY SPOT CHECK`);
    console.log("-".repeat(80));

    // Tool-specific checks
    if (slug === "aider") {
      // Aider: 38K+ stars, terminal-based, benchmark scores
      const starsMatch = githubMetrics.stars?.includes("38") || githubMetrics.stars?.includes("38,");
      if (!starsMatch) {
        issues.push({ severity: "warning", field: "github_metrics.stars", message: `Expected ~38K stars, got: ${githubMetrics.stars}` });
        console.log(`  ⚠️  Star count: ${githubMetrics.stars} (expected ~38K)`);
      } else {
        console.log(`  ✅ Star count verified: ${githubMetrics.stars}`);
      }

      const terminalMention = overviewLower.includes("terminal") || overviewLower.includes("command-line") || overviewLower.includes("cli");
      if (!terminalMention) {
        issues.push({ severity: "warning", field: "overview", message: "Terminal-based nature not emphasized" });
        console.log(`  ⚠️  Terminal-based: NOT MENTIONED`);
      } else {
        console.log(`  ✅ Terminal-based nature emphasized`);
      }

      const benchmarkMention = overviewLower.includes("benchmark") || overviewLower.includes("84.9%");
      if (benchmarkMention) {
        console.log(`  ✅ Benchmark scores mentioned`);
      } else {
        console.log(`  ℹ️  Benchmark scores: NOT MENTIONED`);
      }
    }

    if (slug === "google-gemini-cli") {
      // Google Gemini CLI: 80K+ stars, Google official, 1M tokens
      const starsMatch = githubMetrics.stars?.includes("80") || githubMetrics.stars?.includes("80,");
      if (!starsMatch) {
        issues.push({ severity: "warning", field: "github_metrics.stars", message: `Expected ~80K stars, got: ${githubMetrics.stars}` });
        console.log(`  ⚠️  Star count: ${githubMetrics.stars} (expected ~80K)`);
      } else {
        console.log(`  ✅ Star count verified: ${githubMetrics.stars}`);
      }

      const googleOfficial = company?.toLowerCase().includes("google");
      if (!googleOfficial) {
        issues.push({ severity: "critical", field: "company", message: "Should be marked as Google official" });
        console.log(`  ❌ Google official: NOT IDENTIFIED`);
      } else {
        console.log(`  ✅ Google official status verified`);
      }

      const contextMention = overviewLower.includes("1m") || overviewLower.includes("1 m") || overviewLower.includes("million token");
      if (!contextMention) {
        issues.push({ severity: "warning", field: "overview", message: "1M token context not emphasized" });
        console.log(`  ⚠️  1M token context: NOT MENTIONED`);
      } else {
        console.log(`  ✅ 1M token context mentioned`);
      }
    }

    if (slug === "qwen-code") {
      // Qwen Code: Alibaba, 480B model, data sovereignty
      const alibabaOfficial = company?.toLowerCase().includes("alibaba");
      if (!alibabaOfficial) {
        issues.push({ severity: "critical", field: "company", message: "Should be marked as Alibaba official" });
        console.log(`  ❌ Alibaba official: NOT IDENTIFIED`);
      } else {
        console.log(`  ✅ Alibaba official status verified`);
      }

      const modelMention = overviewLower.includes("480b") || overviewLower.includes("480 b");
      if (!modelMention) {
        issues.push({ severity: "warning", field: "overview", message: "480B model not emphasized" });
        console.log(`  ⚠️  480B model: NOT MENTIONED`);
      } else {
        console.log(`  ✅ 480B model mentioned`);
      }

      const sovereigntyMention = overviewLower.includes("sovereignty") || overviewLower.includes("china") || overviewLower.includes("alternative");
      if (sovereigntyMention) {
        console.log(`  ✅ Data sovereignty/alternative positioning mentioned`);
      } else {
        console.log(`  ℹ️  Data sovereignty: NOT EMPHASIZED`);
      }
    }

    // 4. TECHNICAL VERIFICATION
    console.log(`\n⚙️  4. TECHNICAL METADATA`);
    console.log("-".repeat(80));
    console.log(`  Category: ${tool.category}`);
    console.log(`  Launch year: ${toolData.launch_year || "N/A"}`);
    console.log(`  Updated 2025: ${toolData.updated_2025 ? "✅ Yes" : "❌ No"}`);
    console.log(`  Recent updates: ${toolData.recent_updates_2025?.length || 0} entries`);
    console.log(`  Target audience: ${toolData.target_audience ? "✅ Set" : "❌ Missing"}`);
    console.log(`  Use cases: ${toolData.use_cases?.length || 0} listed`);
    console.log(`  Integrations: ${toolData.integrations?.length || 0} listed`);

    // Summary
    console.log(`\n📊 QA SUMMARY`);
    console.log("-".repeat(80));

    const criticalIssues = issues.filter(i => i.severity === "critical");
    const warningIssues = issues.filter(i => i.severity === "warning");
    const infoIssues = issues.filter(i => i.severity === "info");

    console.log(`  Critical issues: ${criticalIssues.length}`);
    console.log(`  Warnings: ${warningIssues.length}`);
    console.log(`  Info: ${infoIssues.length}`);

    if (criticalIssues.length > 0) {
      console.log(`\n  ❌ CRITICAL ISSUES:`);
      criticalIssues.forEach(issue => {
        console.log(`    - ${issue.field}: ${issue.message}`);
      });
    }

    if (warningIssues.length > 0) {
      console.log(`\n  ⚠️  WARNINGS:`);
      warningIssues.forEach(issue => {
        console.log(`    - ${issue.field}: ${issue.message}`);
      });
    }

    const passQA = criticalIssues.length === 0;
    console.log(`\n  ${passQA ? "✅ PASSED QA" : "❌ FAILED QA"}`);

    return {
      slug,
      name: toolName,
      found: true,
      passedQA: passQA,
      issues,
      criticalCount: criticalIssues.length,
      warningCount: warningIssues.length,
      infoCount: infoIssues.length,
    };
  } catch (error) {
    console.error(`❌ Error during QA verification:`, error);
    return {
      slug,
      name: toolName,
      found: false,
      passedQA: false,
      issues: [{ severity: "critical", field: "error", message: String(error) }],
    };
  }
}

async function main() {
  console.log("🔍 PHASE 3 OPEN SOURCE TOOLS - DETAILED QA VERIFICATION");
  console.log("=".repeat(80));
  console.log(`\nVerifying ${PHASE3_TOOLS_IN_DB.length} tools in database...\n`);

  const db = getDb();
  const results = [];

  for (const tool of PHASE3_TOOLS_IN_DB) {
    const result = await verifyToolQuality(db, tool.slug, tool.name);
    results.push(result);
  }

  // FINAL SUMMARY
  console.log(`\n${"=".repeat(80)}`);
  console.log("🎯 FINAL QA VERIFICATION SUMMARY");
  console.log("=".repeat(80));

  const foundTools = results.filter(r => r.found);
  const passedTools = results.filter(r => r.passedQA);
  const failedTools = results.filter(r => r.found && !r.passedQA);

  console.log(`\n📊 Overall Results:`);
  console.log(`  Tools verified: ${foundTools.length}/${PHASE3_TOOLS_IN_DB.length}`);
  console.log(`  Passed QA: ${passedTools.length}/${foundTools.length}`);
  console.log(`  Failed QA: ${failedTools.length}/${foundTools.length}`);

  if (passedTools.length > 0) {
    console.log(`\n✅ PASSED QA:`);
    passedTools.forEach(tool => {
      console.log(`  ✓ ${tool.name} (${tool.warningCount} warnings, ${tool.infoCount} info)`);
    });
  }

  if (failedTools.length > 0) {
    console.log(`\n❌ FAILED QA:`);
    failedTools.forEach(tool => {
      console.log(`  ✗ ${tool.name} (${tool.criticalCount} critical issues)`);
    });
  }

  const totalCritical = results.reduce((sum, r) => sum + (r.criticalCount || 0), 0);
  const totalWarnings = results.reduce((sum, r) => sum + (r.warningCount || 0), 0);
  const totalInfo = results.reduce((sum, r) => sum + (r.infoCount || 0), 0);

  console.log(`\n📋 Issue Counts:`);
  console.log(`  Critical: ${totalCritical}`);
  console.log(`  Warnings: ${totalWarnings}`);
  console.log(`  Info: ${totalInfo}`);

  const overallPass = failedTools.length === 0 && foundTools.length === PHASE3_TOOLS_IN_DB.length;

  console.log(`\n${"=".repeat(80)}`);
  if (overallPass) {
    console.log("✅ PHASE 3 QA VERIFICATION: PASSED");
    console.log("\nAll tools have complete, accurate, open source-focused content.");
  } else {
    console.log("⚠️  PHASE 3 QA VERIFICATION: ISSUES FOUND");
    console.log("\nSome tools have quality issues that need attention.");
  }
  console.log("=".repeat(80));

  closeDb();

  return {
    total: PHASE3_TOOLS_IN_DB.length,
    found: foundTools.length,
    passed: passedTools.length,
    failed: failedTools.length,
    overallPass,
  };
}

main()
  .then((summary) => {
    console.log(`\n✨ QA verification completed: ${summary.passed}/${summary.found} passed\n`);
    process.exit(summary.overallPass ? 0 : 1);
  })
  .catch((error) => {
    console.error("❌ QA verification failed:", error);
    closeDb();
    process.exit(1);
  });
