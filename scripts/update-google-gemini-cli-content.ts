#!/usr/bin/env tsx

/**
 * Update Google Gemini CLI Tool with Comprehensive Content
 *
 * This script updates the Google Gemini CLI tool with:
 * - Complete 2025 GitHub metrics (80.3k stars, Apache 2.0)
 * - Official Google AI terminal integration
 * - Extensions system (announced October 2025)
 * - Free tier with generous usage limits
 * - Enterprise partnerships and adoption
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const GEMINI_CLI_SLUG = "google-gemini-cli";

const geminiCliUpdateData = {
  company: "Google (Alphabet Inc.)",
  website: "https://cloud.google.com/gemini/docs/codeassist/gemini-cli",
  github_url: "https://github.com/google-gemini/gemini-cli",
  license: "Apache-2.0",
  overview: "Google Gemini CLI is the official open-source AI agent from Google that brings Gemini 2.5 Pro directly into developers' terminals, with an impressive 80,300+ GitHub stars making it one of the most popular AI coding tools on GitHub. Launched in June 2025, Gemini CLI offers free access to Gemini 2.5 Pro with a massive 1M token context window, enabling developers to understand entire codebases, generate code, debug issues, and automate workflows using natural language. With over 1 million developers building with Gemini CLI in just three months since launch, Google announced a game-changing extensions system in October 2025 that connects Gemini CLI to industry-leading tools from Dynatrace, Elastic, Figma, Harness, Postman, Shopify, Snyk, and Stripe. The tool provides unmatched free usage limits (60 requests/minute, 1,000 requests/day) with built-in Google Search grounding, file operations, shell commands, and MCP (Model Context Protocol) support for custom integrations. As an official Google product backed by cutting-edge AI research, Gemini CLI represents the future of AI-powered command-line development.",
  pricing: {
    model: "Free with Generous Limits (Enterprise Options Available)",
    tiers: [
      {
        name: "Personal (Free)",
        price: "$0 with Google Account",
        features: [
          "Access to Gemini 2.5 Pro model",
          "1M token context window",
          "60 requests per minute",
          "1,000 requests per day",
          "Google Search grounding included",
          "All built-in tools and extensions"
        ],
        recommended: true
      },
      {
        name: "API Key (Pay-per-use)",
        price: "Pay only for what you use",
        features: [
          "Higher usage limits available",
          "Gemini API pricing applies",
          "Programmatic access",
          "Production workload support",
          "No daily request limits",
          "Enterprise billing options"
        ]
      },
      {
        name: "Vertex AI (Enterprise)",
        price: "Custom pricing",
        features: [
          "Enterprise SLA guarantees",
          "Private deployment options",
          "Advanced security and compliance",
          "Dedicated support",
          "Custom model fine-tuning",
          "Organization-wide policies"
        ]
      }
    ]
  },
  features: [
    "Gemini 2.5 Pro with 1M token context window",
    "Built-in Google Search grounding for up-to-date information",
    "File operations (read, write, edit across your codebase)",
    "Shell command execution for automation",
    "Web fetching to pull documentation and resources",
    "MCP (Model Context Protocol) for custom tool integrations",
    "Extensions ecosystem: Dynatrace, Elastic, Figma, Postman, Shopify, Snyk, Stripe",
    "Interactive shell support (vim, top, git rebase)",
    "Multiple authentication methods (Google login, API key, Vertex AI)",
    "Code understanding and generation across all languages",
    "Dynamic troubleshooting and debugging",
    "Open source with community contributions"
  ],
  target_audience: "Professional developers seeking official Google AI tools, DevOps engineers automating workflows, cloud developers using Google Cloud Platform, enterprise teams requiring reliable AI coding support, terminal power users, and organizations leveraging Google's AI ecosystem",
  use_cases: [
    "AI-powered command-line development with Google's latest models",
    "Codebase understanding with 1M token context",
    "Automated debugging and troubleshooting",
    "Integration with enterprise tools (Postman, Stripe, Snyk)",
    "Cloud development on Google Cloud Platform",
    "Documentation and API exploration with web fetching",
    "Custom workflow automation with MCP extensions",
    "Interactive command execution (vim, git, monitoring)",
    "Team collaboration with shared extensions",
    "Free high-capacity AI coding for individuals and startups"
  ],
  integrations: [
    "Google Cloud Platform (Vertex AI)",
    "Dynatrace (monitoring and observability)",
    "Elastic (search and analytics)",
    "Figma (design integration)",
    "Harness (CI/CD automation)",
    "Postman (API development)",
    "Shopify (e-commerce development)",
    "Snyk (security scanning)",
    "Stripe (payment processing)",
    "MCP (Model Context Protocol) for custom tools"
  ],
  launch_year: 2025,
  updated_2025: true,
  recent_updates_2025: [
    "Launched June 2025 with Gemini 2.5 Pro access",
    "Reached 1M+ developers in first 3 months",
    "Announced extensions system (October 2025)",
    "Achieved 80,300+ GitHub stars",
    "Added interactive shell support for vim, top, git",
    "Partnered with 8+ industry-leading platforms",
    "Expanded to 3,034+ commits and active development"
  ],
  github_metrics: {
    stars: "80,300+",
    forks: "8,800+",
    contributors: "Google AI team + community",
    commits: "3,034+",
    license: "Apache-2.0",
    primary_language: "TypeScript",
    latest_release: "Weekly preview and stable releases"
  },
  open_source_benefits: [
    "Official Google backing ensures long-term support",
    "Transparent code auditing for security",
    "Community contributions welcome",
    "Free tier extremely generous (1,000 requests/day)",
    "Extensions ecosystem growing rapidly",
    "Integration with Google's research advancements",
    "No vendor lock-in despite Google backing"
  ],
  enterprise_adoption: [
    "Used by 1M+ developers globally",
    "Partnerships with Dynatrace, Elastic, Figma, Harness",
    "Integration with Postman, Shopify, Snyk, Stripe",
    "Google Cloud Platform native support",
    "Rapid growth: 1M users in 3 months"
  ]
};

async function checkExistingTool() {
  const db = getDb();
  const result = await db.select().from(tools).where(eq(tools.slug, GEMINI_CLI_SLUG));
  return result.length > 0 ? result[0] : null;
}

async function updateGeminiCliTool() {
  const db = getDb();

  console.log(`\n📝 Updating ${GEMINI_CLI_SLUG}...`);
  console.log("=".repeat(80));

  // Check if tool exists
  const existingTool = await checkExistingTool();

  if (!existingTool) {
    console.log(`  ❌ Tool not found: ${GEMINI_CLI_SLUG}`);
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
    ...geminiCliUpdateData,
    // Keep existing description if it's good
    description: existingData.description || geminiCliUpdateData.overview.substring(0, 200),
  };

  // Perform the update
  const result = await db
    .update(tools)
    .set({
      data: updatedData,
      updatedAt: new Date(),
    })
    .where(eq(tools.slug, GEMINI_CLI_SLUG))
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

    console.log(`\n✅ Successfully updated ${GEMINI_CLI_SLUG}`);
    return { success: true, data: result[0] };
  } else {
    console.log(`  ❌ Failed to update ${GEMINI_CLI_SLUG}`);
    return { success: false, message: "Update failed" };
  }
}

async function main() {
  console.log("🚀 Starting Google Gemini CLI tool content update...\n");
  console.log("=".repeat(80));
  console.log("Tool: Google Gemini CLI");
  console.log("Slug: google-gemini-cli");
  console.log("Category: open-source-framework");
  console.log("Website: https://cloud.google.com/gemini/docs/codeassist/gemini-cli");
  console.log("GitHub: https://github.com/google-gemini/gemini-cli");
  console.log("Stars: 80,300+");
  console.log("License: Apache-2.0");
  console.log("=".repeat(80));

  try {
    const result = await updateGeminiCliTool();

    console.log("\n" + "=".repeat(80));
    if (result.success) {
      console.log("\n✨ Update completed successfully!");
      console.log("\n🎯 Google Gemini CLI tool now has:");
      console.log("  ✅ Company: Google (Alphabet Inc.)");
      console.log("  ✅ Website: Official Google Cloud docs");
      console.log("  ✅ GitHub: 80.3k stars (top AI CLI tool)");
      console.log("  ✅ License: Apache-2.0 (open source)");
      console.log("  ✅ Comprehensive overview (~150 words)");
      console.log("  ✅ 12 key features (1M context, extensions)");
      console.log("  ✅ 3 pricing tiers (free + enterprise)");
      console.log("  ✅ Target audience: Google Cloud developers");
      console.log("  ✅ 10 use cases (enterprise integrations)");
      console.log("  ✅ 10 integrations (Stripe, Postman, Snyk, etc.)");
      console.log("  ✅ GitHub metrics (80k+ stars)");
      console.log("  ✅ 2025 updates (extensions, 1M users)");
      console.log("  ✅ Enterprise adoption metrics");
      console.log("  ✅ Official Google backing highlighted");
    } else {
      console.log("\n❌ Update failed!");
      console.log(`  Reason: ${result.message}`);
    }
    console.log("\n" + "=".repeat(80));
  } catch (error) {
    console.error("  ❌ Error updating Google Gemini CLI tool:", error);
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
