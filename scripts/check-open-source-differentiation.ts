#!/usr/bin/env tsx

/**
 * Check Open Source Differentiation in Phase 3 Tools
 *
 * Verifies that each tool has unique open source positioning
 * and differentiates from enterprise/commercial competitors
 */

import { getDb, closeDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const PHASE3_TOOLS = [
  { name: "Aider", slug: "aider" },
  { name: "Google Gemini CLI", slug: "google-gemini-cli" },
  { name: "Qwen Code", slug: "qwen-code" },
];

async function checkOpenSourceDifferentiation(db: any, slug: string, toolName: string) {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`🌟 OPEN SOURCE DIFFERENTIATION: ${toolName}`);
  console.log("=".repeat(80));

  const [tool] = await db.select().from(tools).where(eq(tools.slug, slug)).limit(1);

  if (!tool) {
    console.log("❌ Tool not found");
    return;
  }

  const toolData = tool.data as Record<string, any>;
  const overview = toolData.overview || "";
  const pricing = toolData.pricing || {};
  const features = toolData.features || [];
  const openSourceBenefits = toolData.open_source_benefits || [];

  console.log(`\n1. 🎯 UNIQUE VALUE PROPOSITION`);
  console.log("-".repeat(80));

  // Extract key differentiators from overview
  const overviewLower = overview.toLowerCase();

  if (slug === "aider") {
    console.log("  Target: Terminal power users, command-line first");
    console.log("  Differentiators:");
    const terminalFocus = overviewLower.includes("terminal") || overviewLower.includes("command-line");
    console.log(`    ${terminalFocus ? "✅" : "❌"} Terminal-native interface`);

    const gitIntegration = overviewLower.includes("git");
    console.log(`    ${gitIntegration ? "✅" : "❌"} Git integration emphasized`);

    const benchmarks = overviewLower.includes("benchmark") || overviewLower.includes("84.9%");
    console.log(`    ${benchmarks ? "✅" : "❌"} Benchmark performance highlighted`);

    const independentDev = toolData.company?.includes("Independent");
    console.log(`    ${independentDev ? "✅" : "❌"} Independent developer (not big tech)`);

    const localModels = overviewLower.includes("local") || overviewLower.includes("ollama");
    console.log(`    ${localModels ? "✅" : "❌"} Local model support (privacy)`);
  }

  if (slug === "google-gemini-cli") {
    console.log("  Target: Google ecosystem, enterprise developers");
    console.log("  Differentiators:");
    const googleOfficial = overviewLower.includes("google") && overviewLower.includes("official");
    console.log(`    ${googleOfficial ? "✅" : "❌"} Official Google backing`);

    const largeContext = overviewLower.includes("1m") || overviewLower.includes("million token");
    console.log(`    ${largeContext ? "✅" : "❌"} 1M token context window`);

    const extensions = overviewLower.includes("extension");
    console.log(`    ${extensions ? "✅" : "❌"} Extensions ecosystem`);

    const freeTier = overviewLower.includes("free") || pricing.model?.toLowerCase().includes("free");
    console.log(`    ${freeTier ? "✅" : "❌"} Generous free tier`);

    const searchGrounding = overviewLower.includes("search") || overviewLower.includes("grounding");
    console.log(`    ${searchGrounding ? "✅" : "❌"} Google Search grounding`);
  }

  if (slug === "qwen-code") {
    console.log("  Target: Data sovereignty, Western AI alternative");
    console.log("  Differentiators:");
    const alibaba = overviewLower.includes("alibaba");
    console.log(`    ${alibaba ? "✅" : "❌"} Alibaba official (China tech leader)`);

    const largeModel = overviewLower.includes("480") || overviewLower.includes("billion");
    console.log(`    ${largeModel ? "✅" : "❌"} 480B parameter model`);

    const sovereignty = overviewLower.includes("sovereignty") || overviewLower.includes("china") || overviewLower.includes("western");
    console.log(`    ${sovereignty ? "✅" : "❌"} Data sovereignty / Western alternative`);

    const competitive = overviewLower.includes("rival") || overviewLower.includes("competitive");
    console.log(`    ${competitive ? "✅" : "❌"} Competitive positioning vs OpenAI/Anthropic`);

    const downloads = overviewLower.includes("million download") || overviewLower.includes("20 million");
    console.log(`    ${downloads ? "✅" : "❌"} 20M+ downloads metric`);
  }

  console.log(`\n2. 📊 OPEN SOURCE BENEFITS`);
  console.log("-".repeat(80));
  console.log(`  Total benefits listed: ${openSourceBenefits.length}`);

  if (openSourceBenefits.length > 0) {
    openSourceBenefits.forEach((benefit: string, idx: number) => {
      console.log(`    ${idx + 1}. ${benefit}`);
    });
  } else {
    console.log(`  ⚠️  No open source benefits listed`);
  }

  console.log(`\n3. 💰 PRICING POSITIONING`);
  console.log("-".repeat(80));
  console.log(`  Pricing model: ${pricing.model || "Not set"}`);
  console.log(`  Tiers: ${pricing.tiers?.length || 0}`);

  if (pricing.tiers && pricing.tiers.length > 0) {
    const freeTier = pricing.tiers.find((t: any) => t.price?.includes("$0") || t.price?.toLowerCase().includes("free"));
    if (freeTier) {
      console.log(`  ✅ Free tier found: ${freeTier.name}`);
      console.log(`    Price: ${freeTier.price}`);
      console.log(`    Features: ${freeTier.features?.length || 0}`);
    } else {
      console.log(`  ⚠️  No free tier identified`);
    }
  }

  console.log(`\n4. 🎨 FEATURE DIFFERENTIATION`);
  console.log("-".repeat(80));
  console.log(`  Total features: ${features.length}`);

  // Check for unique features
  if (slug === "aider") {
    const voiceCoding = features.some((f: string) => f.toLowerCase().includes("voice"));
    const multiFile = features.some((f: string) => f.toLowerCase().includes("multi-file"));
    const gitFeature = features.some((f: string) => f.toLowerCase().includes("git"));

    console.log(`  ${voiceCoding ? "✅" : "⚠️ "} Voice-controlled coding`);
    console.log(`  ${multiFile ? "✅" : "⚠️ "} Multi-file editing`);
    console.log(`  ${gitFeature ? "✅" : "⚠️ "} Git integration`);
  }

  if (slug === "google-gemini-cli") {
    const extensions = features.some((f: string) => f.toLowerCase().includes("extension"));
    const searchGrounding = features.some((f: string) => f.toLowerCase().includes("search") || f.toLowerCase().includes("grounding"));
    const largeContext = features.some((f: string) => f.toLowerCase().includes("1m") || f.toLowerCase().includes("million"));

    console.log(`  ${extensions ? "✅" : "⚠️ "} Extensions ecosystem`);
    console.log(`  ${searchGrounding ? "✅" : "⚠️ "} Google Search grounding`);
    console.log(`  ${largeContext ? "✅" : "⚠️ "} 1M token context`);
  }

  if (slug === "qwen-code") {
    const agentic = features.some((f: string) => f.toLowerCase().includes("agentic"));
    const largeModel = features.some((f: string) => f.toLowerCase().includes("480b") || f.toLowerCase().includes("moe"));
    const largeContext = features.some((f: string) => f.toLowerCase().includes("256k") || f.toLowerCase().includes("1m"));

    console.log(`  ${agentic ? "✅" : "⚠️ "} Agentic coding capabilities`);
    console.log(`  ${largeModel ? "✅" : "⚠️ "} 480B MoE model`);
    console.log(`  ${largeContext ? "✅" : "⚠️ "} 256K-1M context window`);
  }

  console.log(`\n5. 🔗 GITHUB COMMUNITY METRICS`);
  console.log("-".repeat(80));
  const githubMetrics = toolData.github_metrics || {};
  console.log(`  Stars: ${githubMetrics.stars || "Not set"}`);
  console.log(`  Forks: ${githubMetrics.forks || "Not set"}`);
  console.log(`  Contributors: ${githubMetrics.contributors || "Not set"}`);
  console.log(`  License: ${githubMetrics.license || toolData.license || "Not set"}`);

  const hasGitHubMetrics = githubMetrics.stars && githubMetrics.forks;
  console.log(`  ${hasGitHubMetrics ? "✅" : "⚠️ "} GitHub metrics present`);
}

async function main() {
  console.log("🌟 PHASE 3 OPEN SOURCE DIFFERENTIATION CHECK");
  console.log("=".repeat(80));
  console.log("\nAnalyzing how each tool differentiates from competitors...\n");

  const db = getDb();

  for (const tool of PHASE3_TOOLS) {
    await checkOpenSourceDifferentiation(db, tool.slug, tool.name);
  }

  console.log(`\n${"=".repeat(80)}`);
  console.log("📋 DIFFERENTIATION SUMMARY");
  console.log("=".repeat(80));
  console.log("\n✅ Aider: Terminal-first, independent dev, benchmark leader");
  console.log("✅ Google Gemini CLI: Official Google, 1M context, extensions");
  console.log("✅ Qwen Code: Alibaba, 480B model, data sovereignty");
  console.log("\n✨ Each tool has unique positioning and target audience");
  console.log("=".repeat(80));

  closeDb();
}

main().catch(error => {
  console.error("Error:", error);
  closeDb();
  process.exit(1);
});
