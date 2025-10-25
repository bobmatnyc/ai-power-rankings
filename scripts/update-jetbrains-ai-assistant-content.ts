#!/usr/bin/env tsx

/**
 * Update JetBrains AI Assistant Tool with Comprehensive Enterprise Content
 *
 * This script updates the JetBrains AI Assistant tool with:
 * - Complete 2025 pricing information (4 tiers including Enterprise)
 * - Comprehensive feature list with enterprise capabilities
 * - JetBrains ecosystem integration and IDE support
 * - Complete metadata including target audience and use cases
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const JETBRAINS_AI_SLUG = "jetbrains-ai";

const jetbrainsAIUpdateData = {
  company: "JetBrains",
  website: "https://www.jetbrains.com/ai/",
  overview: "JetBrains AI Assistant is an enterprise-grade AI coding companion deeply integrated across the entire JetBrains IDE ecosystem, including IntelliJ IDEA, PyCharm, WebStorm, GoLand, and ReSharper. Launched in 2023 and enhanced throughout 2025, JetBrains AI empowers developers with context-aware code completions, intelligent refactoring, comprehensive chat assistance, and the innovative Junie AI agent for complex multi-step tasks. Unlike generic AI tools, JetBrains AI leverages deep IDE integration and understands project structure, build systems, and language-specific contexts. The Enterprise tier offers unique capabilities including BYOLLM (bring your own LLM) support, on-premises deployment options, integration with OpenAI, Anthropic Claude, Google Gemini, and Azure OpenAI, plus enterprise-grade security with SSO, audit logs, and centralized administration. With transparent credit-based pricing and support for local/self-hosted models, JetBrains AI Assistant is the premier choice for enterprises prioritizing security, flexibility, and deep IDE integration.",
  pricing: {
    model: "Credit-based subscription with Enterprise options",
    tiers: [
      {
        name: "AI Free",
        price: "$0/month",
        features: [
          "Limited AI features in IDEs 2025.1+",
          "30-day AI Pro trial included",
          "Basic cloud quota for exploration",
          "Access to Junie AI agent (limited)",
          "Available in select JetBrains IDEs"
        ]
      },
      {
        name: "AI Pro (Personal)",
        price: "$8.33/month (billed yearly) or $10/month",
        commercial_price: "$16.67/month (billed yearly) or $20/month",
        features: [
          "Extended cloud quota with third-party AI models",
          "Full Junie AI agent capabilities",
          "AI chat powered by multiple LLMs",
          "Context-aware code completions",
          "Intelligent refactoring suggestions",
          "Available in all JetBrains IDEs, ReSharper, Android Studio"
        ],
        recommended: true
      },
      {
        name: "AI Ultimate (Personal)",
        price: "$25/month (billed yearly) or $30/month",
        commercial_price: "$50/month (billed yearly) or $60/month",
        features: [
          "Everything in AI Pro",
          "Highest cloud quota allocation",
          "Maximum AI Credits ($1 = 1 credit)",
          "Priority access to new AI features",
          "Enhanced model selection and flexibility",
          "30-day credit quota reset cycle"
        ]
      },
      {
        name: "AI Enterprise",
        price: "Part of JetBrains IDE Services On-Premises ($720/year base)",
        features: [
          "BYOLLM - Connect approved external LLM providers",
          "OpenAI, Anthropic Claude, Google Gemini, Azure OpenAI support",
          "On-premises and local LLM deployment via Hugging Face",
          "Centralized administration and policy controls",
          "SSO provisioning and authentication",
          "Comprehensive audit logs and compliance tracking",
          "Provider choice with multi-cloud support",
          "Enterprise-grade security and data governance",
          "Dedicated support and SLA guarantees"
        ]
      }
    ]
  },
  features: [
    "Deep IDE integration across entire JetBrains ecosystem",
    "Context-aware code completions with project understanding",
    "Junie AI agent for complex multi-step coding tasks",
    "Intelligent code refactoring and modernization",
    "AI-powered chat for coding questions and debugging",
    "Support for IntelliJ IDEA, PyCharm, WebStorm, GoLand, PhpStorm, RubyMine, RustRover",
    "ReSharper and Android Studio compatibility",
    "Multiple LLM provider support (OpenAI, Claude, Gemini, Azure)",
    "On-premises and air-gapped deployment options for Enterprise",
    "BYOLLM - bring your own LLM keys and endpoints",
    "Enterprise SSO, audit logs, and centralized policy management",
    "Credit-based transparent pricing model",
    "Local model support via Hugging Face integration",
    "Language-agnostic support across 50+ programming languages"
  ],
  target_audience: "Enterprise development teams, JetBrains IDE users, professional software engineers, organizations requiring on-premises AI, security-conscious enterprises, polyglot developers, teams using IntelliJ IDEA/PyCharm/WebStorm/GoLand, and companies needing BYOLLM flexibility",
  use_cases: [
    "Enterprise software development with security requirements",
    "Multi-language project development (Java, Python, JavaScript, Go, PHP, Ruby, Rust)",
    "On-premises and air-gapped environment coding assistance",
    "Large-scale refactoring and code modernization",
    "Complex debugging and troubleshooting with AI assistance",
    "Team collaboration with centralized AI policy management",
    "Custom LLM integration for specialized domains",
    "Educational coding assistance in academic institutions using JetBrains IDEs"
  ],
  integrations: [
    "IntelliJ IDEA Ultimate",
    "PyCharm (Professional and Community with Pro subscription)",
    "WebStorm",
    "GoLand",
    "PhpStorm",
    "RubyMine",
    "RustRover",
    "ReSharper",
    "Android Studio",
    "OpenAI API",
    "Anthropic Claude API",
    "Google Gemini via Vertex AI",
    "Azure OpenAI",
    "Hugging Face (on-premises models)",
    "AWS Bedrock (for Claude models)"
  ],
  launch_year: 2023,
  updated_2025: true,
  recent_updates_2025: [
    "Introduced simpler credit-based pricing model (August 2025)",
    "Added AI Free tier for IDEs 2025.1+",
    "Enhanced Enterprise tier with BYOLLM and on-premises options",
    "Expanded Junie AI agent capabilities across more IDEs",
    "Added support for Google Gemini via Vertex AI",
    "Improved organizational visibility and admin controls",
    "Introduced credit top-ups for flexible quota management",
    "Enhanced on-premises LLM support via Hugging Face"
  ],
  enterprise_features: {
    security: [
      "SSO and SAML authentication",
      "Comprehensive audit logging",
      "On-premises deployment options",
      "Air-gapped environment support",
      "Enterprise data governance controls"
    ],
    administration: [
      "Centralized policy management",
      "User provisioning and management",
      "Usage analytics and reporting",
      "Provider and model access controls",
      "Credit allocation and monitoring"
    ],
    flexibility: [
      "BYOLLM - bring your own LLM provider",
      "Multi-cloud LLM support (OpenAI, Anthropic, Google, Azure)",
      "On-premises model deployment",
      "Custom model integration via Hugging Face",
      "Self-hosted infrastructure options"
    ]
  }
};

async function checkExistingTool() {
  const db = getDb();
  const result = await db.select().from(tools).where(eq(tools.slug, JETBRAINS_AI_SLUG));
  return result.length > 0 ? result[0] : null;
}

async function updateJetBrainsAITool() {
  const db = getDb();

  console.log(`\n📝 Updating ${JETBRAINS_AI_SLUG}...`);
  console.log("=".repeat(80));

  // Check if tool exists
  const existingTool = await checkExistingTool();

  if (!existingTool) {
    console.log(`  ❌ Tool not found: ${JETBRAINS_AI_SLUG}`);
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
    ...jetbrainsAIUpdateData,
    // Keep existing description if it's good
    description: existingData.description || jetbrainsAIUpdateData.overview.substring(0, 200),
  };

  // Perform the update
  const result = await db
    .update(tools)
    .set({
      data: updatedData,
      updatedAt: new Date(),
    })
    .where(eq(tools.slug, JETBRAINS_AI_SLUG))
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
    console.log(`  Enterprise features: ${Object.keys(updatedToolData.enterprise_features).length} categories`);

    console.log(`\n✅ Successfully updated ${JETBRAINS_AI_SLUG}`);
    return { success: true, data: result[0] };
  } else {
    console.log(`  ❌ Failed to update ${JETBRAINS_AI_SLUG}`);
    return { success: false, message: "Update failed" };
  }
}

async function main() {
  console.log("🚀 Starting JetBrains AI Assistant tool content update...\n");
  console.log("=".repeat(80));
  console.log("Tool: JetBrains AI Assistant");
  console.log("Slug: jetbrains-ai-assistant");
  console.log("Category: Enterprise AI Coding Assistant");
  console.log("Website: https://www.jetbrains.com/ai/");
  console.log("=".repeat(80));

  try {
    const result = await updateJetBrainsAITool();

    console.log("\n" + "=".repeat(80));
    if (result.success) {
      console.log("\n✨ Update completed successfully!");
      console.log("\n🎯 JetBrains AI Assistant tool now has:");
      console.log("  ✅ Company: JetBrains");
      console.log("  ✅ Website: https://www.jetbrains.com/ai/");
      console.log("  ✅ Comprehensive overview (~150 words)");
      console.log("  ✅ 14 key features");
      console.log("  ✅ 4 pricing tiers (Free, Pro, Ultimate, Enterprise)");
      console.log("  ✅ Enterprise features detailed");
      console.log("  ✅ Target audience defined");
      console.log("  ✅ 8 use cases listed");
      console.log("  ✅ 15 integrations documented");
      console.log("  ✅ 2025 recent updates included");
    } else {
      console.log("\n❌ Update failed!");
      console.log(`  Reason: ${result.message}`);
    }
    console.log("\n" + "=".repeat(80));
  } catch (error) {
    console.error("  ❌ Error updating JetBrains AI Assistant tool:", error);
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
