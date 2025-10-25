#!/usr/bin/env tsx

/**
 * Update Aider Tool with Comprehensive Open Source Content
 *
 * This script updates the Aider tool with:
 * - Complete 2025 GitHub metrics (38.1k stars, Apache 2.0)
 * - Terminal-first AI pair programming features
 * - Multi-model support (cloud and local LLMs)
 * - Git integration and workflow automation
 * - Community adoption and benchmarks
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const AIDER_SLUG = "aider";

const aiderUpdateData = {
  company: "Paul Gauthier (Independent Developer)",
  website: "https://aider.chat",
  github_url: "https://github.com/Aider-AI/aider",
  license: "Apache-2.0",
  overview: "Aider is the leading open-source AI pair programming tool that runs directly in your terminal, with 38,100+ GitHub stars and over 162 contributors. Built by Paul Gauthier and released in 2023, Aider revolutionizes command-line coding workflows by enabling developers to collaborate with AI models (Claude Sonnet 4, GPT-4, DeepSeek, or local models) to edit code in local git repositories. With an impressive 84.9% correctness score on the 225-example polyglot benchmark using OpenAI o3-pro, Aider excels at multi-file edits, automatic commit messages, and voice-controlled coding. The tool supports 100+ programming languages, automatically fixes errors using tree-sitter AST analysis, and allows developers to add images and web pages for visual context. Unlike IDE-based tools, Aider brings enterprise-grade AI coding to terminal workflows, making it the go-to choice for developers who prefer command-line interfaces, DevOps engineers, and power users seeking maximum control and customization.",
  pricing: {
    model: "Free Open Source (Pay for LLM APIs)",
    tiers: [
      {
        name: "Open Source (Free)",
        price: "$0 (Apache 2.0 License)",
        features: [
          "Complete source code access on GitHub",
          "Unlimited usage and modifications",
          "Self-hosted deployment",
          "Community support via GitHub",
          "All features included",
          "No subscription fees ever"
        ],
        recommended: true
      },
      {
        name: "LLM API Costs",
        price: "~$0.007 per file processed",
        features: [
          "Pay only for AI model API usage",
          "OpenAI API (GPT-4, o1, o3-mini)",
          "Anthropic Claude API (Sonnet 4, Opus)",
          "Google Gemini API",
          "DeepSeek API (cost-effective option)",
          "Local models via Ollama (free)"
        ]
      },
      {
        name: "Local Models (Free)",
        price: "$0 (No API costs)",
        features: [
          "Run completely offline",
          "Use Ollama for local LLMs",
          "No data sent to cloud services",
          "Full privacy and control",
          "Ideal for sensitive codebases",
          "Zero ongoing costs"
        ]
      }
    ]
  },
  features: [
    "Terminal-native AI pair programming interface",
    "Multi-model support: Claude Sonnet 4, GPT-4, o1, o3-mini, DeepSeek, Gemini, local models",
    "Git integration with automatic commit messages and diffs",
    "Multi-file editing with intelligent code understanding",
    "Voice-controlled coding via speech input",
    "Image and webpage context for visual references",
    "Automatic code linting and error fixing with tree-sitter AST",
    "100+ programming language support (Python, JavaScript, Rust, Go, etc.)",
    "Codebase-wide refactoring and feature additions",
    "Works with local LLMs via Ollama for complete privacy",
    "Benchmark leader: 84.9% on polyglot test suite with o3-pro",
    "Command-line workflow integration (pipeable, scriptable)"
  ],
  target_audience: "Terminal power users, DevOps engineers, command-line enthusiasts, open source developers, privacy-focused teams, developers preferring keyboard-driven workflows, Linux/Unix system administrators, and software engineers seeking customizable AI pair programming without IDE dependency",
  use_cases: [
    "Terminal-based AI pair programming",
    "Automated code refactoring across multiple files",
    "Git-aware code changes with automatic commits",
    "Voice-controlled coding sessions",
    "Private coding with local LLM models",
    "DevOps automation and script generation",
    "Command-line workflow enhancement",
    "Open source project contributions",
    "Learning and exploring new codebases",
    "Rapid prototyping in terminal environments"
  ],
  integrations: [
    "Git version control (native integration)",
    "OpenAI API (GPT-4, o1, o3-mini)",
    "Anthropic Claude API (Sonnet 4, Opus)",
    "Google Gemini API",
    "DeepSeek API",
    "Ollama (local LLM hosting)",
    "Tree-sitter (code parsing)",
    "Any terminal environment (bash, zsh, fish)",
    "VS Code (via extensions, community-built)"
  ],
  launch_year: 2023,
  updated_2025: true,
  recent_updates_2025: [
    "Released v0.86.0 (August 2025) with enhanced features",
    "Achieved 38,100+ GitHub stars (top 0.1% of repositories)",
    "Reached 162 contributors from global community",
    "Added automatic linting and error fixing with tree-sitter",
    "Expanded to 100+ programming language support",
    "Achieved 84.9% correctness on polyglot benchmark with o3-pro",
    "Added voice coding support for hands-free development"
  ],
  github_metrics: {
    stars: "38,100+",
    forks: "3,600+",
    contributors: "162",
    commits: "3,000+",
    license: "Apache-2.0",
    primary_language: "Python (80%)",
    latest_release: "v0.86.0 (Aug 2025)"
  },
  open_source_benefits: [
    "Complete transparency and code auditing",
    "Community-driven feature development",
    "No vendor lock-in or proprietary restrictions",
    "Extensible architecture for customization",
    "Active issue tracking and rapid bug fixes",
    "Freedom to self-host and modify",
    "Growing ecosystem of community extensions"
  ],
  testimonials: [
    {
      author: "Eric S. Raymond (Open Source Pioneer)",
      quote: "My life has changed... Aider... It's going to rock your world."
    },
    {
      author: "SOLAR_FIELDS",
      quote: "Aider ... has easily quadrupled my coding productivity."
    },
    {
      author: "rappster",
      quote: "It's really like having your senior developer live right in your Git repo."
    }
  ]
};

async function checkExistingTool() {
  const db = getDb();
  const result = await db.select().from(tools).where(eq(tools.slug, AIDER_SLUG));
  return result.length > 0 ? result[0] : null;
}

async function updateAiderTool() {
  const db = getDb();

  console.log(`\n📝 Updating ${AIDER_SLUG}...`);
  console.log("=".repeat(80));

  // Check if tool exists
  const existingTool = await checkExistingTool();

  if (!existingTool) {
    console.log(`  ❌ Tool not found: ${AIDER_SLUG}`);
    return { success: false, message: "Tool not found" };
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
    ...aiderUpdateData,
    // Keep existing description if it's good
    description: existingData.description || aiderUpdateData.overview.substring(0, 200),
  };

  // Perform the update
  const result = await db
    .update(tools)
    .set({
      data: updatedData,
      updatedAt: new Date(),
    })
    .where(eq(tools.slug, AIDER_SLUG))
    .returning();

  if (result.length > 0) {
    const updatedTool = result[0];
    const updatedToolData = updatedTool.data as Record<string, any>;

    console.log(`\n📊 AFTER UPDATE:`);
    console.log(`  Company: ${updatedToolData.company}`);
    console.log(`  Website: ${updatedToolData.website}`);
    console.log(`  GitHub: ${updatedToolData.github_url}`);
    console.log(`  License: ${updatedToolData.license}`);
    console.log(`  Overview: ${updatedToolData.overview.substring(0, 100)}...`);
    console.log(`  Features: ${updatedToolData.features.length} features added`);
    console.log(`  Pricing tiers: ${updatedToolData.pricing.tiers.length} tiers configured`);
    console.log(`  GitHub stars: ${updatedToolData.github_metrics.stars}`);
    console.log(`  Target audience: ${updatedToolData.target_audience.substring(0, 80)}...`);

    console.log(`\n✅ Successfully updated ${AIDER_SLUG}`);
    return { success: true, data: result[0] };
  } else {
    console.log(`  ❌ Failed to update ${AIDER_SLUG}`);
    return { success: false, message: "Update failed" };
  }
}

async function main() {
  console.log("🚀 Starting Aider tool content update...\n");
  console.log("=".repeat(80));
  console.log("Tool: Aider");
  console.log("Slug: aider");
  console.log("Category: open-source-framework");
  console.log("Website: https://aider.chat");
  console.log("GitHub: https://github.com/Aider-AI/aider");
  console.log("Stars: 38,100+");
  console.log("License: Apache-2.0");
  console.log("=".repeat(80));

  try {
    const result = await updateAiderTool();

    console.log("\n" + "=".repeat(80));
    if (result.success) {
      console.log("\n✨ Update completed successfully!");
      console.log("\n🎯 Aider tool now has:");
      console.log("  ✅ Company: Paul Gauthier (Independent Developer)");
      console.log("  ✅ Website: https://aider.chat");
      console.log("  ✅ GitHub: 38.1k stars, 162 contributors");
      console.log("  ✅ License: Apache-2.0 (open source)");
      console.log("  ✅ Comprehensive overview (~150 words)");
      console.log("  ✅ 12 key features (terminal-first, multi-model)");
      console.log("  ✅ 3 pricing tiers (free open source + API costs)");
      console.log("  ✅ Target audience: terminal power users, DevOps");
      console.log("  ✅ 10 use cases (terminal workflows, git automation)");
      console.log("  ✅ 9 integrations (Git, OpenAI, Claude, local models)");
      console.log("  ✅ GitHub metrics (stars, forks, contributors)");
      console.log("  ✅ 2025 updates (v0.86.0, voice coding)");
      console.log("  ✅ Open source benefits highlighted");
      console.log("  ✅ Developer testimonials included");
    } else {
      console.log("\n❌ Update failed!");
      console.log(`  Reason: ${result.message}`);
    }
    console.log("\n" + "=".repeat(80));
  } catch (error) {
    console.error("  ❌ Error updating Aider tool:", error);
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
