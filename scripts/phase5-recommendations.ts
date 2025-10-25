/**
 * Phase 5 Tool Prioritization
 * Identifies the best tools to update based on market impact, user base, and content gaps
 */

import { db } from "../lib/db";
import { tools } from "../lib/db/schema";

// Tools already updated in Phases 1-4 (corrected slug)
const UPDATED_TOOLS = [
  // Phase 1: Market Leaders
  "github-copilot",
  "cursor",
  "replit-agent",
  "claude-code",
  "devin",

  // Phase 2: Enterprise Tools
  "jetbrains-ai",
  "amazon-q-developer", // Corrected from "amazon-q"
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

// High-value tools based on market presence, user base, and industry impact
const HIGH_VALUE_TOOLS: Record<string, { priority: 'critical' | 'high' | 'medium', reason: string }> = {
  // Critical - Major market players with significant user bases
  'bolt-new': { priority: 'critical', reason: 'StackBlitz\'s viral app builder, 1M+ projects created' },
  'v0-vercel': { priority: 'critical', reason: 'Vercel\'s AI UI generator, widely adopted in Next.js ecosystem' },
  'claude-artifacts': { priority: 'critical', reason: 'Anthropic\'s interactive coding feature, core Claude capability' },
  'chatgpt-canvas': { priority: 'critical', reason: 'OpenAI\'s code editor, massive ChatGPT user base' },
  'lovable': { priority: 'critical', reason: 'GPT Engineer rebrand, popular app builder' },
  'cline': { priority: 'critical', reason: 'Top VS Code extension for autonomous coding, 500K+ installs' },
  'continue-dev': { priority: 'critical', reason: 'Leading open-source IDE assistant, 100K+ GitHub stars' },

  // High - Established tools with growing adoption
  'microsoft-intellicode': { priority: 'high', reason: 'Built into Visual Studio, millions of VS users' },
  'augment-code': { priority: 'high', reason: 'Well-funded ($227M) code assistant, enterprise focus' },
  'warp': { priority: 'high', reason: 'Modern AI-powered terminal, developer favorite' },
  'refact-ai': { priority: 'high', reason: 'Self-hosted code assistant, privacy-focused alternative' },
  'openhands': { priority: 'high', reason: 'Open-source Devin alternative, All-Hands.dev project' },
  'zed': { priority: 'high', reason: 'High-performance editor with AI, from Atom creators' },

  // Medium - Emerging or niche tools worth covering
  'jules': { priority: 'medium', reason: 'Google\'s AI coding agent, part of Gemini ecosystem' },
  'roocode': { priority: 'medium', reason: 'VS Code fork with integrated AI capabilities' },
  'openai-codex': { priority: 'medium', reason: 'Foundation model for GitHub Copilot, historical importance' },
};

interface EnhancedToolAnalysis {
  name: string;
  slug: string;
  category: string;
  contentCompleteness: number;
  marketPriority: 'critical' | 'high' | 'medium' | 'low';
  priorityReason: string;
  missingContent: string[];
  estimatedEffort: 'low' | 'medium' | 'high';
}

async function generatePhase5Plan() {
  console.log("🎯 PHASE 5 TOOL PRIORITIZATION");
  console.log("=".repeat(80) + "\n");

  const allTools = await db
    .select({
      name: tools.name,
      slug: tools.slug,
      category: tools.category,
      status: tools.status,
      data: tools.data,
    })
    .from(tools)
    .orderBy(tools.name);

  const remainingTools = allTools
    .filter(t => t.status === 'active' && !UPDATED_TOOLS.includes(t.slug))
    .map(tool => {
      const data = tool.data as any;

      // Analyze content completeness
      const hasCompany = !!(data?.company?.name && data?.company?.description);
      const hasOverview = !!(data?.overview && data.overview.length > 100);
      const hasPricing = !!(data?.pricing && Object.keys(data.pricing).length > 0);
      const hasFeatures = !!(data?.features && data.features.length > 0);
      const hasKeyFeatures = !!(data?.keyFeatures && data.keyFeatures.length > 0);

      const checks = [hasCompany, hasOverview, hasPricing, hasFeatures, hasKeyFeatures];
      const contentCompleteness = (checks.filter(Boolean).length / checks.length) * 100;

      const missingContent: string[] = [];
      if (!hasCompany) missingContent.push("company");
      if (!hasOverview) missingContent.push("overview");
      if (!hasPricing) missingContent.push("pricing");
      if (!hasFeatures) missingContent.push("features");
      if (!hasKeyFeatures) missingContent.push("keyFeatures");

      // Estimate effort based on content gaps
      let estimatedEffort: 'low' | 'medium' | 'high' = 'medium';
      if (contentCompleteness >= 50) estimatedEffort = 'low';
      else if (contentCompleteness === 0) estimatedEffort = 'high';

      // Get market priority
      const highValueInfo = HIGH_VALUE_TOOLS[tool.slug];
      const marketPriority = highValueInfo?.priority || 'low';
      const priorityReason = highValueInfo?.reason || 'Standard tool, less market visibility';

      return {
        name: tool.name,
        slug: tool.slug,
        category: tool.category,
        contentCompleteness,
        marketPriority,
        priorityReason,
        missingContent,
        estimatedEffort,
      } as EnhancedToolAnalysis;
    });

  console.log(`📊 Total remaining tools: ${remainingTools.length}\n`);

  // Group by market priority
  const critical = remainingTools.filter(t => t.marketPriority === 'critical');
  const high = remainingTools.filter(t => t.marketPriority === 'high');
  const medium = remainingTools.filter(t => t.marketPriority === 'medium');
  const low = remainingTools.filter(t => t.marketPriority === 'low');

  console.log("📈 MARKET PRIORITY BREAKDOWN:");
  console.log(`  🔴 Critical: ${critical.length} tools (major market players)`);
  console.log(`  🟠 High: ${high.length} tools (established with growing adoption)`);
  console.log(`  🟡 Medium: ${medium.length} tools (emerging/niche)`);
  console.log(`  ⚪ Low: ${low.length} tools (less market visibility)\n`);

  console.log("=".repeat(80));
  console.log("🎯 RECOMMENDED PHASE 5 TOOLS (10 tools)");
  console.log("=".repeat(80) + "\n");

  console.log("Strategy: Prioritize critical market players first, balance effort\n");

  // Prioritize: Critical first, then high-value with low effort, then fill with high priority
  const phase5Selection: EnhancedToolAnalysis[] = [];

  // Add all critical (should be 7)
  phase5Selection.push(...critical);

  // Add high-priority tools with low/medium effort to reach 10
  const highEfficient = high
    .filter(t => t.estimatedEffort !== 'high')
    .sort((a, b) => {
      // Prefer lower effort
      if (a.estimatedEffort !== b.estimatedEffort) {
        return a.estimatedEffort === 'low' ? -1 : 1;
      }
      return b.contentCompleteness - a.contentCompleteness;
    });

  const remainingSlots = 10 - phase5Selection.length;
  phase5Selection.push(...highEfficient.slice(0, remainingSlots));

  // Display Phase 5 recommendations
  phase5Selection.forEach((tool, index) => {
    const priorityEmoji = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '⚪',
    }[tool.marketPriority];

    const effortEmoji = {
      low: '⚡',
      medium: '⚙️',
      high: '🔨',
    }[tool.estimatedEffort];

    console.log(`${index + 1}. ${tool.name} (${tool.slug})`);
    console.log(`   Priority: ${priorityEmoji} ${tool.marketPriority.toUpperCase()}`);
    console.log(`   Reason: ${tool.priorityReason}`);
    console.log(`   Category: ${tool.category}`);
    console.log(`   Current content: ${tool.contentCompleteness.toFixed(0)}%`);
    console.log(`   Effort: ${effortEmoji} ${tool.estimatedEffort}`);
    console.log(`   Missing: ${tool.missingContent.join(', ')}`);
    console.log();
  });

  console.log("=".repeat(80));
  console.log("📊 PHASE 5 ANALYSIS");
  console.log("=".repeat(80) + "\n");

  const phase5ByCategory = groupBy(phase5Selection, 'category');
  console.log("📂 CATEGORY BREAKDOWN:");
  Object.entries(phase5ByCategory)
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([category, tools]) => {
      console.log(`  ${category}: ${tools.length} tools`);
    });

  const phase5ByEffort = groupBy(phase5Selection, 'estimatedEffort');
  console.log("\n⚙️ EFFORT DISTRIBUTION:");
  Object.entries(phase5ByEffort).forEach(([effort, tools]) => {
    console.log(`  ${effort}: ${tools.length} tools`);
  });

  const avgCompleteness = phase5Selection.reduce((sum, t) => sum + t.contentCompleteness, 0) / phase5Selection.length;
  console.log(`\n📈 AVERAGE CURRENT COMPLETENESS: ${avgCompleteness.toFixed(1)}%`);

  console.log("\n🎯 GROUPING THEME: **Critical Market Players**");
  console.log("Focus on high-impact tools with significant user bases and market presence.");
  console.log("This phase covers major app builders, autonomous agents, and essential IDE assistants.\n");

  console.log("=".repeat(80));
  console.log("📋 REMAINING TOOLS FOR FUTURE PHASES");
  console.log("=".repeat(80) + "\n");

  const remainingAfterPhase5 = remainingTools.filter(
    t => !phase5Selection.find(p => p.slug === t.slug)
  );

  console.log(`Tools remaining after Phase 5: ${remainingAfterPhase5.length}\n`);

  // Group remaining by priority
  const criticalRemaining = remainingAfterPhase5.filter(t => t.marketPriority === 'critical');
  const highRemaining = remainingAfterPhase5.filter(t => t.marketPriority === 'high');
  const mediumRemaining = remainingAfterPhase5.filter(t => t.marketPriority === 'medium');
  const lowRemaining = remainingAfterPhase5.filter(t => t.marketPriority === 'low');

  if (criticalRemaining.length > 0) {
    console.log("🔴 CRITICAL (carry over to Phase 6):");
    criticalRemaining.forEach(t => console.log(`  - ${t.name} (${t.slug})`));
    console.log();
  }

  if (highRemaining.length > 0) {
    console.log("🟠 HIGH PRIORITY:");
    highRemaining.forEach(t => console.log(`  - ${t.name} (${t.slug}): ${t.priorityReason}`));
    console.log();
  }

  if (mediumRemaining.length > 0) {
    console.log("🟡 MEDIUM PRIORITY:");
    mediumRemaining.forEach(t => console.log(`  - ${t.name} (${t.slug})`));
    console.log();
  }

  console.log(`⚪ LOW PRIORITY: ${lowRemaining.length} tools`);
  console.log("   (Tools with limited market presence or unclear positioning)\n");

  console.log("=".repeat(80));
  console.log("✅ PHASE 5 PLAN COMPLETE");
  console.log("=".repeat(80));
}

function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((acc, item) => {
    const group = String(item[key]);
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

// Run analysis
generatePhase5Plan()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
