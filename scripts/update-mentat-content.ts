#!/usr/bin/env tsx

/**
 * Update Mentat Tool with Comprehensive Content
 *
 * This script updates the Mentat tool with:
 * - GitHub metrics from archived CLI (2.6k stars, Apache 2.0)
 * - Evolution to Mentat.ai GitHub bot
 * - Historical context and community contributions
 * - RAG-based codebase understanding
 * - Multi-file coordination capabilities
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const MENTAT_SLUG = "mentat";

const mentatUpdateData = {
  company: "Abante AI (formerly community-driven CLI)",
  website: "https://mentat.ai",
  github_url: "https://github.com/AbanteAI/archive-old-cli-mentat",
  license: "Apache-2.0",
  overview: "Mentat is an AI coding assistant that evolved from a popular open-source command-line tool (2,600+ GitHub stars, archived January 2025) into a powerful AI-powered GitHub bot for code generation and review. Originally created as a context-aware CLI tool that used retrieval-augmented generation (RAG) to understand entire codebases, Mentat distinguished itself by coordinating edits across multiple files and locations—going beyond simple code completion. Built by the Abante AI team with 22 contributors and reaching version 1.0.18 before the CLI was archived, the original tool supported OpenAI, Azure, and Ollama models with native git integration. The project has now transitioned to Mentat.ai, a GitHub bot that writes and reviews code directly in pull requests, bringing the same intelligent multi-file coordination to team workflows. While the CLI is archived, its legacy lives on through the lessons learned about RAG-based code understanding, context management beyond LLM limits, and the importance of multi-file coordination in real-world software development. Mentat represents the evolution of AI coding from local tools to collaborative platforms.",
  pricing: {
    model: "Evolved Product (CLI Archived)",
    tiers: [
      {
        name: "CLI (Archived - Free)",
        price: "$0 (Apache 2.0)",
        features: [
          "Source code available (archived)",
          "Historical reference for developers",
          "No longer actively maintained",
          "Version 1.0.18 final release (Apr 2024)",
          "Educational value for RAG implementation",
          "Community forks may exist"
        ]
      },
      {
        name: "Mentat.ai GitHub Bot",
        price: "See mentat.ai for current pricing",
        features: [
          "AI-powered code generation in PRs",
          "Code review automation",
          "GitHub integration",
          "Team collaboration features",
          "Evolution of CLI concepts",
          "Current actively-maintained product"
        ],
        recommended: true
      },
      {
        name: "LLM API Costs (CLI)",
        price: "Pay for OpenAI/Azure/Ollama",
        features: [
          "Used your own API keys",
          "OpenAI GPT-3.5/GPT-4",
          "Azure OpenAI Service",
          "Ollama for local models",
          "No Mentat subscription fees",
          "Historical context only"
        ]
      }
    ]
  },
  features: [
    "Multi-file editing with intelligent coordination",
    "RAG-based codebase understanding (original CLI innovation)",
    "Context-aware code suggestions using project knowledge",
    "Git integration for version control",
    "Supported OpenAI, Azure, and Ollama models",
    "Beyond copy-paste: direct codebase manipulation",
    "Handle large codebases exceeding LLM context limits",
    "Command-line interface for developer workflows",
    "Evolution to GitHub bot for PR automation",
    "Code review and generation in team environments",
    "Open source legacy (2.6k stars before archive)",
    "Educational resource for RAG implementation"
  ],
  target_audience: "Developers interested in AI coding history, teams using Mentat.ai GitHub bot, researchers studying RAG-based code tools, open source contributors learning from archived projects, and engineers seeking alternatives that evolved from CLI to collaborative platforms",
  use_cases: [
    "Historical reference for RAG-based coding tools",
    "Learning multi-file coordination techniques",
    "Understanding evolution from CLI to bot platforms",
    "Team code review automation (Mentat.ai bot)",
    "PR generation with AI assistance (current product)",
    "Studying context management beyond LLM limits",
    "Educational resource for AI tool development",
    "Community forks for specific use cases",
    "Research on AI coding assistant architectures",
    "Alternative approaches to code intelligence"
  ],
  integrations: [
    "Git version control (CLI version)",
    "OpenAI API (GPT-3.5, GPT-4)",
    "Azure OpenAI Service",
    "Ollama (local LLM hosting)",
    "GitHub (current bot version)",
    "Python ecosystem (87.9% of CLI code)",
    "TypeScript (8.4% of CLI code)",
    "Terminal environments (original CLI)",
    "Pull request workflows (Mentat.ai)",
    "Team collaboration platforms"
  ],
  launch_year: 2023,
  archived_date: "January 7, 2025",
  updated_2025: true,
  recent_updates_2025: [
    "CLI archived January 7, 2025 (version 1.0.18)",
    "Transitioned to Mentat.ai GitHub bot",
    "2,600 stars achieved before archival",
    "22 contributors participated in CLI development",
    "Evolution from CLI to collaborative platform",
    "Legacy code remains available for learning",
    "Community continues with Mentat.ai bot"
  ],
  github_metrics: {
    stars: "2,600 (archived CLI)",
    forks: "241",
    contributors: "22",
    commits: "1,500+",
    license: "Apache-2.0",
    primary_languages: "Python (87.9%), TypeScript (8.4%)",
    latest_release: "v1.0.18 (Apr 23, 2024)",
    status: "Archived (Jan 7, 2025)"
  },
  historical_significance: [
    "Pioneered multi-file coordination in CLI tools",
    "Early adoption of RAG for codebase understanding",
    "Demonstrated context management beyond LLM limits",
    "Influenced design of collaborative AI coding platforms",
    "Showed path from individual tools to team platforms",
    "Open source contribution model with 22 developers"
  ],
  evolution: {
    cli_era: "Command-line tool with RAG and multi-file editing",
    transition: "Archived January 2025 after reaching goals",
    current: "Mentat.ai GitHub bot for team collaboration",
    lessons: "Multi-file coordination, RAG implementation, context management"
  }
};

async function checkExistingTool() {
  const db = getDb();
  const result = await db.select().from(tools).where(eq(tools.slug, MENTAT_SLUG));
  return result.length > 0 ? result[0] : null;
}

async function updateMentatTool() {
  const db = getDb();

  console.log(`\n📝 Updating ${MENTAT_SLUG}...`);
  console.log("=".repeat(80));

  // Check if tool exists
  const existingTool = await checkExistingTool();

  if (!existingTool) {
    console.log(`  ❌ Tool not found: ${MENTAT_SLUG}`);
    console.log(`  ℹ️  This tool needs to be added to the database first`);
    return { success: false, message: "Tool not found - needs to be created" };
  }

  console.log(`  ✓ Found tool: ${existingTool.name}`);
  console.log(`  Current category: ${existingTool.category}`);

  // Get existing data
  const existingData = existingTool.data as Record<string, any>;

  console.log(`\n📊 BEFORE UPDATE:`);
  console.log(`  Company: ${existingData.company || 'MISSING'}`);
  console.log(`  Website: ${existingData.website || 'MISSING'}`);
  console.log(`  GitHub: ${existingData.github_url || 'MISSING'}`);
  console.log(`  Overview: ${existingData.overview ? existingData.overview.substring(0, 80) + '...' : 'MISSING'}`);

  // Update the tool data - merge with existing data
  const updatedData = {
    ...existingData,
    ...mentatUpdateData,
    // Keep existing description if it's good
    description: existingData.description || mentatUpdateData.overview.substring(0, 200),
  };

  // Perform the update
  const result = await db
    .update(tools)
    .set({
      data: updatedData,
      updatedAt: new Date(),
    })
    .where(eq(tools.slug, MENTAT_SLUG))
    .returning();

  if (result.length > 0) {
    const updatedTool = result[0];
    const updatedToolData = updatedTool.data as Record<string, any>;

    console.log(`\n📊 AFTER UPDATE:`);
    console.log(`  Company: ${updatedToolData.company}`);
    console.log(`  Website: ${updatedToolData.website}`);
    console.log(`  GitHub: ${updatedToolData.github_url}`);
    console.log(`  License: ${updatedToolData.license}`);
    console.log(`  Status: ${updatedToolData.github_metrics.status}`);
    console.log(`  Overview: ${updatedToolData.overview.substring(0, 100)}...`);
    console.log(`  Features: ${updatedToolData.features.length} features documented`);
    console.log(`  Pricing tiers: ${updatedToolData.pricing.tiers.length} tiers configured`);

    console.log(`\n✅ Successfully updated ${MENTAT_SLUG}`);
    return { success: true, data: result[0] };
  } else {
    console.log(`  ❌ Failed to update ${MENTAT_SLUG}`);
    return { success: false, message: "Update failed" };
  }
}

async function main() {
  console.log("🚀 Starting Mentat tool content update...\n");
  console.log("=".repeat(80));
  console.log("Tool: Mentat");
  console.log("Slug: mentat");
  console.log("Category: open-source-framework");
  console.log("Website: https://mentat.ai");
  console.log("GitHub: https://github.com/AbanteAI/archive-old-cli-mentat");
  console.log("Stars: 2,600 (archived)");
  console.log("License: Apache-2.0");
  console.log("Status: CLI archived Jan 2025, evolved to Mentat.ai bot");
  console.log("=".repeat(80));

  try {
    const result = await updateMentatTool();

    console.log("\n" + "=".repeat(80));
    if (result.success) {
      console.log("\n✨ Update completed successfully!");
      console.log("\n🎯 Mentat tool now has:");
      console.log("  ✅ Company: Abante AI");
      console.log("  ✅ Website: https://mentat.ai");
      console.log("  ✅ GitHub: 2.6k stars (archived CLI)");
      console.log("  ✅ License: Apache-2.0");
      console.log("  ✅ Status: Evolved from CLI to GitHub bot");
      console.log("  ✅ Comprehensive overview (~150 words)");
      console.log("  ✅ 12 features (RAG, multi-file coordination)");
      console.log("  ✅ 3 pricing tiers (archived CLI + current bot)");
      console.log("  ✅ Target audience: developers, researchers");
      console.log("  ✅ 10 use cases (historical + current)");
      console.log("  ✅ 10 integrations (CLI + bot platforms)");
      console.log("  ✅ GitHub metrics (2.6k stars, 22 contributors)");
      console.log("  ✅ Historical significance documented");
      console.log("  ✅ Evolution story (CLI → Bot)");
    } else {
      console.log("\n❌ Update failed!");
      console.log(`  Reason: ${result.message}`);
      if (result.message.includes("not found")) {
        console.log("\n📋 Next steps:");
        console.log("  1. Add Mentat to database first");
        console.log("  2. Then run this update script");
      }
    }
    console.log("\n" + "=".repeat(80));
  } catch (error) {
    console.error("  ❌ Error updating Mentat tool:", error);
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
