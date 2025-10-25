#!/usr/bin/env tsx

/**
 * Update GitHub Copilot Tool with Comprehensive Content
 *
 * This script updates the GitHub Copilot tool with:
 * - Complete 2025 pricing information (5 tiers)
 * - Comprehensive feature list
 * - Market leader positioning and recent updates
 * - Complete metadata including target audience and use cases
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const GITHUB_COPILOT_SLUG = "github-copilot";

const githubCopilotUpdateData = {
  company: "Microsoft (GitHub)",
  website: "https://github.com/features/copilot",
  overview: "GitHub Copilot is the world's most widely adopted AI coding assistant, transforming developer productivity by providing AI-powered code completions, chat assistance, and autonomous agent capabilities directly within IDEs. Owned by Microsoft and deeply integrated with GitHub's ecosystem, Copilot leverages advanced AI models including Claude Sonnet 4, GPT-5, and Gemini 2.5 Pro to deliver contextualized code suggestions, test generation, and code review. With over 55% productivity gains reported by developers, GitHub Copilot serves individual developers, enterprises, and educational institutions through five flexible pricing tiers. Recent 2025 updates introduced GitHub Spark for rapid app development, Agent mode for autonomous multi-step tasks, and enhanced organizational context features for Enterprise customers, solidifying its position as the market leader in AI-assisted software development.",
  pricing: {
    model: "Freemium with Premium Tiers",
    tiers: [
      {
        name: "Free",
        price: "$0/month",
        features: [
          "Limited to 2,000 code completions per month",
          "50 chat requests per month",
          "Basic code suggestions",
          "Access to GitHub Mobile",
          "Single AI model access"
        ]
      },
      {
        name: "Pro",
        price: "$10/month or $100/year",
        features: [
          "Unlimited code completions",
          "Up to 300 premium requests per month",
          "Access to multiple AI models (Claude Sonnet 4, GPT-5, Gemini 2.5 Pro)",
          "Code review capabilities",
          "Chat-based assistance",
          "Free for verified students, teachers, and open source maintainers"
        ],
        recommended: true
      },
      {
        name: "Pro+",
        price: "$39/month or $390/year",
        features: [
          "Everything in Pro",
          "Up to 1,500 premium requests per month",
          "Maximum model flexibility",
          "Access to GitHub Spark for rapid app development",
          "Priority access to new features"
        ]
      },
      {
        name: "Business",
        price: "$19/user/month",
        features: [
          "300 premium requests per user per month",
          "Centralized team billing",
          "User management dashboard",
          "Usage metrics and analytics",
          "Organizational context features",
          "Security and compliance controls"
        ]
      },
      {
        name: "Enterprise",
        price: "$39/user/month",
        features: [
          "Up to 1,000 premium requests per user per month",
          "All available AI models",
          "Advanced management and policy controls",
          "GitHub Enterprise Cloud integration",
          "Custom models trained on organization codebase",
          "Fine-tuned private models for code completion",
          "GitHub.com chat integration with knowledge bases",
          "Priority support"
        ]
      }
    ]
  },
  features: [
    "AI-powered code completions with multi-line suggestions",
    "Contextual chat assistance for coding questions and debugging",
    "Agent mode for autonomous multi-step task execution",
    "Code review and pull request assistance",
    "Test generation and code documentation",
    "Support for 80+ programming languages",
    "IDE integration (VS Code, Visual Studio, JetBrains, Neovim)",
    "GitHub Spark for rapid application prototyping",
    "Multiple AI model support (Claude, GPT, Gemini)",
    "Organizational codebase indexing for Enterprise",
    "Custom fine-tuned models for Enterprise customers",
    "Security vulnerability detection and remediation suggestions"
  ],
  target_audience: "Professional developers, software engineering teams, enterprises, students, educators, open source maintainers, individual programmers, and organizations seeking to accelerate software development with AI assistance",
  use_cases: [
    "Accelerating code writing with intelligent completions",
    "Debugging and troubleshooting code issues",
    "Learning new programming languages and frameworks",
    "Generating unit tests and documentation",
    "Code refactoring and modernization",
    "Pull request reviews and suggestions",
    "Rapid prototyping with GitHub Spark",
    "Security vulnerability identification and fixes"
  ],
  integrations: [
    "Visual Studio Code",
    "Visual Studio",
    "JetBrains IDEs (IntelliJ, PyCharm, WebStorm, etc.)",
    "Neovim",
    "GitHub.com",
    "GitHub Enterprise Cloud",
    "GitHub Mobile",
    "Azure OpenAI",
    "CI/CD pipelines"
  ],
  launch_year: 2021,
  updated_2025: true,
  recent_updates_2025: [
    "Added GitHub Spark for rapid app development",
    "Introduced Agent mode for autonomous coding tasks",
    "Expanded to 5 pricing tiers with new Free and Pro+ options",
    "Enhanced Enterprise features with custom model fine-tuning",
    "Added support for Claude Sonnet 4, GPT-5, and Gemini 2.5 Pro",
    "Improved organizational context for better code suggestions"
  ]
};

async function checkExistingTool() {
  const db = getDb();
  const result = await db.select().from(tools).where(eq(tools.slug, GITHUB_COPILOT_SLUG));
  return result.length > 0 ? result[0] : null;
}

async function updateGitHubCopilotTool() {
  const db = getDb();

  console.log(`\n📝 Updating ${GITHUB_COPILOT_SLUG}...`);
  console.log("=".repeat(80));

  // Check if tool exists
  const existingTool = await checkExistingTool();

  if (!existingTool) {
    console.log(`  ❌ Tool not found: ${GITHUB_COPILOT_SLUG}`);
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
    ...githubCopilotUpdateData,
    // Keep existing description if it's good
    description: existingData.description || githubCopilotUpdateData.overview.substring(0, 200),
  };

  // Perform the update
  const result = await db
    .update(tools)
    .set({
      data: updatedData,
      updatedAt: new Date(),
    })
    .where(eq(tools.slug, GITHUB_COPILOT_SLUG))
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

    console.log(`\n✅ Successfully updated ${GITHUB_COPILOT_SLUG}`);
    return { success: true, data: result[0] };
  } else {
    console.log(`  ❌ Failed to update ${GITHUB_COPILOT_SLUG}`);
    return { success: false, message: "Update failed" };
  }
}

async function main() {
  console.log("🚀 Starting GitHub Copilot tool content update...\n");
  console.log("=".repeat(80));
  console.log("Tool: GitHub Copilot");
  console.log("Slug: github-copilot");
  console.log("Category: code-completion");
  console.log("Website: https://github.com/features/copilot");
  console.log("=".repeat(80));

  try {
    const result = await updateGitHubCopilotTool();

    console.log("\n" + "=".repeat(80));
    if (result.success) {
      console.log("\n✨ Update completed successfully!");
      console.log("\n🎯 GitHub Copilot tool now has:");
      console.log("  ✅ Company: Microsoft (GitHub)");
      console.log("  ✅ Website: https://github.com/features/copilot");
      console.log("  ✅ Comprehensive overview (~150 words)");
      console.log("  ✅ 12 key features");
      console.log("  ✅ 5 pricing tiers (Free, Pro, Pro+, Business, Enterprise)");
      console.log("  ✅ Target audience defined");
      console.log("  ✅ 8 use cases listed");
      console.log("  ✅ 9 integrations documented");
      console.log("  ✅ 2025 recent updates included");
    } else {
      console.log("\n❌ Update failed!");
      console.log(`  Reason: ${result.message}`);
    }
    console.log("\n" + "=".repeat(80));
  } catch (error) {
    console.error("  ❌ Error updating GitHub Copilot tool:", error);
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
