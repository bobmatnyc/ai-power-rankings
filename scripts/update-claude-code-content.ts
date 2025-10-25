#!/usr/bin/env tsx

/**
 * Update Claude Code Tool with Comprehensive Content
 *
 * This script updates the Claude Code tool with:
 * - Complete 2025 pricing information (Pro, Max, Team, Enterprise)
 * - Comprehensive autonomous coding features powered by Sonnet 4.5
 * - Terminal and web interface capabilities
 * - Complete metadata including target audience and use cases
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const CLAUDE_CODE_SLUG = "claude-code";

const claudeCodeUpdateData = {
  company: "Anthropic",
  website: "https://claude.com/product/claude-code",
  overview: "Claude Code is Anthropic's terminal-first AI coding assistant powered by Sonnet 4.5, the best model in the world for agents, coding, and computer use. Launched initially as a CLI tool and expanded to web and iOS in October 2025, Claude Code delivers deep autonomous coding capabilities with extended runtime (up to 30 hours of continuous operation), checkpoint-based version control, and the ability to search million-line codebases instantly. With 10x user growth since its May 2025 broader launch and contributing over $500M to Anthropic's annualized revenue, Claude Code excels at test-driven development, complex debugging, and large-scale refactoring. Available through Pro ($20/month), Max ($100-$200/month), Team ($25-$30/user/month), and Enterprise (custom pricing) plans, Claude Code brings sophisticated AI assistance directly to developers' workflows through terminal, VS Code extension, web browser, and mobile interfaces.",
  pricing: {
    model: "Subscription-Based with API Access",
    tiers: [
      {
        name: "Free",
        price: "$0/month",
        features: [
          "Limited Claude access (not Code-specific)",
          "Basic chat interface",
          "No Claude Code access"
        ],
        note: "Claude Code requires a paid subscription"
      },
      {
        name: "Pro",
        price: "$20/month (or $18/month billed annually)",
        features: [
          "Access to Claude Code CLI, web, and iOS app",
          "Extended usage limits",
          "Sonnet 4.5 model access",
          "Terminal integration",
          "VS Code extension (beta)",
          "Checkpoint version control",
          "Codebase search and analysis"
        ],
        recommended: true
      },
      {
        name: "Max (Standard)",
        price: "$100/month",
        features: [
          "Everything in Pro",
          "5x expanded usage vs Pro",
          "Extended autonomous runtime",
          "Priority access to new features",
          "Higher rate limits"
        ]
      },
      {
        name: "Max (Ultimate)",
        price: "$200/month",
        features: [
          "Everything in Pro",
          "20x expanded usage vs Pro",
          "Maximum autonomous operation capacity",
          "Highest priority access",
          "Professional-grade limits"
        ]
      },
      {
        name: "Team",
        price: "$30/user/month (or $25/user/month billed annually, min 5 members)",
        features: [
          "Everything in Pro",
          "Centralized team billing",
          "Usage analytics",
          "Shared knowledge bases",
          "Collaborative features",
          "Admin controls"
        ]
      },
      {
        name: "Enterprise",
        price: "Custom pricing (estimated $60/user/month, min 70 users)",
        features: [
          "Everything in Team",
          "Advanced security controls",
          "SSO/SAML integration",
          "Custom data retention policies",
          "Dedicated support",
          "SLA guarantees",
          "Custom model fine-tuning options"
        ]
      }
    ],
    api_pricing: {
      model: "Claude Sonnet 4",
      input_tokens: "$3 per million tokens",
      output_tokens: "$15 per million tokens (includes thinking tokens)",
      features: ["Prompt caching discounts", "Batch processing discounts"]
    }
  },
  features: [
    "Powered by Sonnet 4.5 - best model for coding and agents",
    "Extended autonomous operation (up to 30 hours continuous)",
    "Checkpoint system with instant version rewind (/rewind command)",
    "Million-line codebase search and analysis",
    "Terminal CLI with searchable prompt history (Ctrl+r)",
    "Native VS Code extension (beta) with real-time inline diffs",
    "Web interface at claude.ai/code for browser-based coding",
    "iOS app integration for mobile development",
    "Subagents for parallel development workflows",
    "Test-driven development (TDD) automation",
    "Complex debugging across entire project structure",
    "Large-scale refactoring with safety checks",
    "GitHub integration for commits and pull requests",
    "CI/CD pipeline interaction and log analysis"
  ],
  target_audience: "Professional developers, software engineering teams, DevOps engineers, technical leads, backend/frontend specialists, companies seeking AI-assisted coding with strong reasoning capabilities and extended autonomous operation",
  use_cases: [
    "Autonomous multi-step feature development",
    "Complex debugging across large codebases",
    "Test-driven development automation",
    "Large-scale code refactoring and modernization",
    "CI/CD pipeline debugging and optimization",
    "Technical documentation generation",
    "Code review and security analysis",
    "Learning and exploring unfamiliar codebases"
  ],
  integrations: [
    "Terminal/CLI (Node.js 18+)",
    "VS Code extension (beta)",
    "Web browser (claude.ai/code)",
    "iOS app",
    "GitHub",
    "Git version control",
    "CI/CD pipelines",
    "Amazon Bedrock",
    "Google Cloud Vertex AI",
    "Anthropic API"
  ],
  launch_year: 2024,
  updated_2025: true,
  recent_updates_2025: [
    "Web app launched October 2025 for browser-based coding",
    "Native VS Code extension released (beta)",
    "Sonnet 4.5 model upgrade (best for coding and agents)",
    "Checkpoint system v2.0 with improved version control",
    "Extended autonomous runtime (up to 30 hours)",
    "Subagent capabilities for parallel development",
    "10x user growth since May 2025 broader launch",
    "Contributing $500M+ to Anthropic's annualized revenue"
  ],
  technical_specs: {
    autonomous_runtime: "Up to 30 hours continuous operation",
    codebase_capacity: "Million+ lines of code",
    checkpoint_system: "Instant rewind with code/conversation state",
    model: "Claude Sonnet 4.5",
    platforms: ["CLI", "Web", "VS Code", "iOS"],
    requirements: "Node.js 18+ (for CLI)"
  }
};

async function checkExistingTool() {
  const db = getDb();
  const result = await db.select().from(tools).where(eq(tools.slug, CLAUDE_CODE_SLUG));
  return result.length > 0 ? result[0] : null;
}

async function updateClaudeCodeTool() {
  const db = getDb();

  console.log(`\n📝 Updating ${CLAUDE_CODE_SLUG}...`);
  console.log("=".repeat(80));

  // Check if tool exists
  const existingTool = await checkExistingTool();

  if (!existingTool) {
    console.log(`  ❌ Tool not found: ${CLAUDE_CODE_SLUG}`);
    return { success: false, message: "Tool not found" };
  }

  console.log(`  ✓ Found tool: ${existingTool.name}`);
  console.log(`  Current category: ${existingTool.category}`);

  // Get existing data
  const existingData = existingTool.data as Record<string, any>;

  console.log(`\n📊 BEFORE UPDATE:`);
  console.log(`  Company: ${existingData.company || 'MISSING'}`);
  console.log(`  Website: ${existingData.website || 'MISSING'}`);
  console.log(`  Overview: ${existingData.overview ? existingData.overview.substring(0, 80) + '...' : 'MISSING'}`);

  // Update the tool data - merge with existing data
  const updatedData = {
    ...existingData,
    ...claudeCodeUpdateData,
    // Keep existing description if it's good
    description: existingData.description || claudeCodeUpdateData.overview.substring(0, 200),
  };

  // Perform the update
  const result = await db
    .update(tools)
    .set({
      data: updatedData,
      updatedAt: new Date(),
    })
    .where(eq(tools.slug, CLAUDE_CODE_SLUG))
    .returning();

  if (result.length > 0) {
    const updatedTool = result[0];
    const updatedToolData = updatedTool.data as Record<string, any>;

    console.log(`\n📊 AFTER UPDATE:`);
    console.log(`  Company: ${updatedToolData.company}`);
    console.log(`  Website: ${updatedToolData.website}`);
    console.log(`  Overview: ${updatedToolData.overview.substring(0, 100)}...`);
    console.log(`  Features: ${updatedToolData.features.length} features added`);
    console.log(`  Pricing tiers: ${updatedToolData.pricing.tiers.length} tiers configured`);
    console.log(`  Target audience: ${updatedToolData.target_audience.substring(0, 80)}...`);
    console.log(`  Technical specs: ${JSON.stringify(updatedToolData.technical_specs)}`);

    console.log(`\n✅ Successfully updated ${CLAUDE_CODE_SLUG}`);
    return { success: true, data: result[0] };
  } else {
    console.log(`  ❌ Failed to update ${CLAUDE_CODE_SLUG}`);
    return { success: false, message: "Update failed" };
  }
}

async function main() {
  console.log("🚀 Starting Claude Code tool content update...\n");
  console.log("=".repeat(80));
  console.log("Tool: Claude Code");
  console.log("Slug: claude-code");
  console.log("Category: coding-assistant");
  console.log("Website: https://claude.com/product/claude-code");
  console.log("=".repeat(80));

  try {
    const result = await updateClaudeCodeTool();

    console.log("\n" + "=".repeat(80));
    if (result.success) {
      console.log("\n✨ Update completed successfully!");
      console.log("\n🎯 Claude Code tool now has:");
      console.log("  ✅ Company: Anthropic");
      console.log("  ✅ Website: https://claude.com/product/claude-code");
      console.log("  ✅ Comprehensive overview (~150 words)");
      console.log("  ✅ 14 key features");
      console.log("  ✅ 6 pricing tiers (Free, Pro, Max x2, Team, Enterprise)");
      console.log("  ✅ API pricing details");
      console.log("  ✅ Target audience defined");
      console.log("  ✅ 8 use cases listed");
      console.log("  ✅ 10 integrations documented");
      console.log("  ✅ Technical specifications (30hr runtime, million+ LOC)");
      console.log("  ✅ 2025 recent updates (web app, VS Code extension)");
    } else {
      console.log("\n❌ Update failed!");
      console.log(`  Reason: ${result.message}`);
    }
    console.log("\n" + "=".repeat(80));
  } catch (error) {
    console.error("  ❌ Error updating Claude Code tool:", error);
    process.exit(1);
  }
}

// Run the script
main()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(() => {
    closeDb();
  });
