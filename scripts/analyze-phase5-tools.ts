/**
 * Script to analyze remaining tools for Phase 5 content updates
 * Identifies which tools still need comprehensive content updates
 */

import { db } from "../lib/db";
import { tools } from "../lib/db/schema";
import { sql } from "drizzle-orm";

// Tools already updated in Phases 1-4
const UPDATED_TOOLS = [
  // Phase 1: Market Leaders
  "github-copilot",
  "cursor",
  "replit-agent",
  "claude-code",
  "devin",

  // Phase 2: Enterprise Tools
  "jetbrains-ai",
  "amazon-q",
  "gemini-code-assist",
  "sourcegraph-cody",
  "tabnine",
  "windsurf",

  // Phase 3: Open Source
  "aider",
  "google-gemini-cli",
  "qwen-code",

  // Phase 4: Specialized Tools
  "coderabbit",
  "snyk-code",
  "sourcery",
  "diffblue-cover",
  "qodo-gen",
  "gitlab-duo",
  "graphite",
  "greptile",
  "cerebras-code",
];

interface ToolAnalysis {
  id: string;
  name: string;
  slug: string;
  category: string;
  status: string;
  hasCompany: boolean;
  hasOverview: boolean;
  hasPricing: boolean;
  hasFeatures: boolean;
  hasKeyFeatures: boolean;
  contentCompleteness: number;
  lastUpdated: Date | null;
  updatedInPhase?: string;
}

async function analyzeTools() {
  console.log("🔍 Analyzing all tools in database...\n");

  const allTools = await db
    .select({
      id: tools.id,
      name: tools.name,
      slug: tools.slug,
      category: tools.category,
      status: tools.status,
      data: tools.data,
      updatedAt: tools.updatedAt,
    })
    .from(tools)
    .orderBy(tools.name);

  console.log(`📊 Total tools in database: ${allTools.length}\n`);

  const analyses: ToolAnalysis[] = allTools.map((tool) => {
    const data = tool.data as any;

    // Check content completeness
    const hasCompany = !!(data?.company?.name && data?.company?.description);
    const hasOverview = !!(data?.overview && data?.overview.length > 100);
    const hasPricing = !!(data?.pricing && Object.keys(data.pricing).length > 0);
    const hasFeatures = !!(data?.features && data.features.length > 0);
    const hasKeyFeatures = !!(data?.keyFeatures && data.keyFeatures.length > 0);

    // Calculate completeness score
    const checks = [hasCompany, hasOverview, hasPricing, hasFeatures, hasKeyFeatures];
    const contentCompleteness = (checks.filter(Boolean).length / checks.length) * 100;

    // Check if updated in previous phases
    const updatedInPhase = UPDATED_TOOLS.includes(tool.slug)
      ? getPhaseForTool(tool.slug)
      : undefined;

    return {
      id: tool.id,
      name: tool.name,
      slug: tool.slug,
      category: tool.category,
      status: tool.status,
      hasCompany,
      hasOverview,
      hasPricing,
      hasFeatures,
      hasKeyFeatures,
      contentCompleteness,
      lastUpdated: tool.updatedAt,
      updatedInPhase,
    };
  });

  // Separate updated vs remaining tools
  const updatedTools = analyses.filter(t => t.updatedInPhase);
  const remainingTools = analyses.filter(t => !t.updatedInPhase);

  console.log(`✅ Already updated (Phases 1-4): ${updatedTools.length} tools`);
  console.log(`📝 Remaining to update: ${remainingTools.length} tools\n`);

  console.log("=" * 80);
  console.log("📋 REMAINING TOOLS FOR PHASE 5");
  console.log("=" * 80 + "\n");

  // Categorize remaining tools
  const byCategory = groupBy(remainingTools, 'category');
  const byStatus = groupBy(remainingTools, 'status');

  console.log("📊 CATEGORY BREAKDOWN:");
  Object.entries(byCategory).forEach(([category, tools]) => {
    console.log(`  ${category}: ${tools.length} tools`);
  });
  console.log();

  console.log("📊 STATUS BREAKDOWN:");
  Object.entries(byStatus).forEach(([status, tools]) => {
    console.log(`  ${status}: ${tools.length} tools`);
  });
  console.log();

  console.log("📊 CONTENT COMPLETENESS:");
  const avgCompleteness = remainingTools.reduce((sum, t) => sum + t.contentCompleteness, 0) / remainingTools.length;
  console.log(`  Average: ${avgCompleteness.toFixed(1)}%`);

  const needsWork = remainingTools.filter(t => t.contentCompleteness < 50);
  console.log(`  Tools needing work (<50%): ${needsWork.length}`);
  console.log();

  console.log("=" * 80);
  console.log("🎯 DETAILED TOOL LIST");
  console.log("=" * 80 + "\n");

  remainingTools
    .sort((a, b) => b.contentCompleteness - a.contentCompleteness)
    .forEach((tool, index) => {
      const statusEmoji = getStatusEmoji(tool.status);
      const completenessBar = getCompletenessBar(tool.contentCompleteness);

      console.log(`${index + 1}. ${tool.name} (${tool.slug})`);
      console.log(`   Status: ${statusEmoji} ${tool.status}`);
      console.log(`   Category: ${tool.category}`);
      console.log(`   Content: ${completenessBar} ${tool.contentCompleteness.toFixed(0)}%`);
      console.log(`   Missing: ${getMissingContent(tool).join(', ')}`);
      console.log();
    });

  console.log("=" * 80);
  console.log("💡 PHASE 5 RECOMMENDATIONS");
  console.log("=" * 80 + "\n");

  // Generate recommendations
  generateRecommendations(remainingTools);

  return {
    total: allTools.length,
    updated: updatedTools.length,
    remaining: remainingTools.length,
    remainingTools,
  };
}

function getPhaseForTool(slug: string): string {
  if (["github-copilot", "cursor", "replit-agent", "claude-code", "devin"].includes(slug)) {
    return "Phase 1";
  }
  if (["jetbrains-ai", "amazon-q", "gemini-code-assist", "sourcegraph-cody", "tabnine", "windsurf"].includes(slug)) {
    return "Phase 2";
  }
  if (["aider", "google-gemini-cli", "qwen-code"].includes(slug)) {
    return "Phase 3";
  }
  return "Phase 4";
}

function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((acc, item) => {
    const group = String(item[key]);
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

function getStatusEmoji(status: string): string {
  const emojiMap: Record<string, string> = {
    active: "🟢",
    inactive: "🟡",
    deprecated: "🔴",
    discontinued: "⚫",
  };
  return emojiMap[status] || "⚪";
}

function getCompletenessBar(percentage: number): string {
  const filled = Math.floor(percentage / 10);
  const empty = 10 - filled;
  return "█".repeat(filled) + "░".repeat(empty);
}

function getMissingContent(tool: ToolAnalysis): string[] {
  const missing: string[] = [];
  if (!tool.hasCompany) missing.push("company");
  if (!tool.hasOverview) missing.push("overview");
  if (!tool.hasPricing) missing.push("pricing");
  if (!tool.hasFeatures) missing.push("features");
  if (!tool.hasKeyFeatures) missing.push("keyFeatures");
  return missing.length > 0 ? missing : ["none"];
}

function generateRecommendations(remainingTools: ToolAnalysis[]) {
  // Filter active tools with reasonable content
  const activeTools = remainingTools.filter(t => t.status === "active");

  // Prioritize by completeness and category diversity
  const prioritized = activeTools.sort((a, b) => {
    // First by content completeness (higher is better - easier to complete)
    if (Math.abs(b.contentCompleteness - a.contentCompleteness) > 10) {
      return b.contentCompleteness - a.contentCompleteness;
    }
    // Then by category (prefer code-assistant and code-review)
    const categoryPriority: Record<string, number> = {
      "code-assistant": 3,
      "code-review": 2,
      "testing-tool": 1,
    };
    return (categoryPriority[b.category] || 0) - (categoryPriority[a.category] || 0);
  });

  console.log("🎯 RECOMMENDED PHASE 5 SCOPE: 10 tools\n");
  console.log("Strategy: Focus on active tools with existing content foundation\n");

  const phase5Tools = prioritized.slice(0, 10);

  phase5Tools.forEach((tool, index) => {
    console.log(`${index + 1}. ${tool.name}`);
    console.log(`   Slug: ${tool.slug}`);
    console.log(`   Category: ${tool.category}`);
    console.log(`   Current completeness: ${tool.contentCompleteness.toFixed(0)}%`);
    console.log(`   Priority: ${getPriorityReason(tool, index)}`);
    console.log();
  });

  console.log("\n📋 GROUPING THEME: Mixed Category Enhancement");
  console.log("This phase focuses on strengthening existing content across");
  console.log("code assistants, review tools, and testing platforms.\n");

  console.log("📊 PHASE 5 BREAKDOWN:");
  const phase5ByCategory = groupBy(phase5Tools, 'category');
  Object.entries(phase5ByCategory).forEach(([category, tools]) => {
    console.log(`  ${category}: ${tools.length} tools`);
  });
}

function getPriorityReason(tool: ToolAnalysis, index: number): string {
  if (index < 3) return "High - Good content foundation, quick wins";
  if (index < 6) return "Medium - Solid base, moderate effort";
  return "Standard - Active tool, worth completing";
}

// Run the analysis
analyzeTools()
  .then(() => {
    console.log("\n✅ Analysis complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
