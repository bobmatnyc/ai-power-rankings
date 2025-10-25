#!/usr/bin/env tsx

/**
 * Update Cursor Tool with Comprehensive Content
 *
 * This script updates the Cursor tool with:
 * - Complete 2025 pricing information (6 tiers)
 * - Comprehensive feature list including Agent and Tab features
 * - Rapid growth metrics ($500M ARR, fastest-growing SaaS)
 * - Complete metadata including target audience and use cases
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const CURSOR_SLUG = "cursor";

const cursorUpdateData = {
  company: "Anysphere, Inc.",
  website: "https://www.cursor.com",
  overview: "Cursor is the fastest-growing AI code editor in history, reaching $500M in annualized recurring revenue in May 2025 with 9,900% year-over-year growth. Built by Anysphere and valued at $9.9 billion after a $900M Series C funding round, Cursor transforms the coding experience with its AI-first approach featuring intelligent autocomplete, autonomous Agent mode, and multi-model support (OpenAI, Anthropic Claude, Gemini, xAI). Used by over half of the Fortune 500 including NVIDIA, Uber, and Adobe, Cursor offers a familiar VS Code-like interface enhanced with breakthrough AI capabilities like Tab (predicting your next coding action), Agent (autonomous multi-step task execution), and codebase understanding at scale. With pricing from a free Hobby plan to a $200/month Ultra plan offering 20x usage, Cursor has redefined developer productivity and become the go-to AI code editor for professional developers seeking maximum efficiency.",
  pricing: {
    model: "Freemium with Premium Tiers",
    tiers: [
      {
        name: "Hobby (Free)",
        price: "$0/month",
        features: [
          "One-week Pro trial",
          "Limited Agent requests",
          "Limited Tab completions",
          "Access to basic AI features",
          "VS Code-compatible interface"
        ]
      },
      {
        name: "Pro",
        price: "$20/month",
        features: [
          "Everything in Hobby",
          "Extended Agent limits",
          "Unlimited Tab completions",
          "Background Agents for autonomous work",
          "Maximum context windows",
          "Priority model access"
        ],
        recommended: true
      },
      {
        name: "Pro+",
        price: "$60/month",
        features: [
          "Everything in Pro",
          "3x usage on OpenAI, Claude, and Gemini models",
          "Extended rate limits",
          "Enhanced performance"
        ]
      },
      {
        name: "Ultra",
        price: "$200/month",
        features: [
          "Everything in Pro",
          "20x usage on OpenAI, Claude, and Gemini models",
          "Priority access to new features",
          "Maximum AI capacity",
          "Professional-grade limits"
        ]
      },
      {
        name: "Teams",
        price: "$40/user/month",
        features: [
          "Everything in Pro",
          "Centralized team billing",
          "Usage analytics dashboard",
          "Organization-wide privacy controls",
          "Role-based access control (RBAC)",
          "SAML/OIDC Single Sign-On (SSO)"
        ]
      },
      {
        name: "Enterprise",
        price: "Custom pricing",
        features: [
          "Everything in Teams",
          "Pooled usage across organization",
          "Invoice and Purchase Order billing",
          "SCIM seat management",
          "AI code tracking API",
          "Granular admin controls",
          "Priority support",
          "Custom SLA and security options"
        ]
      }
    ]
  },
  features: [
    "AI Agent mode for autonomous multi-step coding tasks",
    "Tab autocomplete that predicts next coding actions",
    "Multi-model support (GPT-4, Claude Sonnet 4, Gemini, xAI)",
    "Codebase understanding across millions of lines of code",
    "Background Agents for parallel autonomous work",
    "VS Code compatibility with enhanced AI features",
    "Embedded AI chatbot for code generation and explanations",
    "Real-time code analysis and bug detection",
    "Maximum context windows for complex projects",
    "Plan Mode for strategic code changes",
    "Browser Controls for web development",
    "Integration with GitHub, Slack, and development tools"
  ],
  target_audience: "Professional software developers, engineering teams, Fortune 500 companies, startups, freelance developers, and organizations seeking cutting-edge AI-powered coding productivity tools with enterprise-grade features",
  use_cases: [
    "Accelerating software development with AI autocomplete",
    "Autonomous code generation and refactoring",
    "Complex debugging and error resolution",
    "Learning new codebases and frameworks quickly",
    "Building features with AI Agent assistance",
    "Code review and quality improvement",
    "Rapid prototyping and MVP development",
    "Enterprise-scale development with team collaboration"
  ],
  integrations: [
    "GitHub",
    "Slack",
    "OpenAI GPT-4 and GPT-4 Turbo",
    "Anthropic Claude (Sonnet 4, Opus)",
    "Google Gemini",
    "xAI Grok",
    "VS Code extensions ecosystem",
    "Git version control",
    "SAML/OIDC identity providers"
  ],
  launch_year: 2023,
  updated_2025: true,
  recent_updates_2025: [
    "Reached $500M ARR in May 2025 (fastest-growing SaaS ever)",
    "Raised $900M Series C at $9.9B valuation",
    "Launched Version 1.7 with Plan Mode and Browser Controls",
    "Achieved over 1 million daily active users",
    "Used by over half of Fortune 500 companies",
    "Introduced Ultra plan with 20x usage limits",
    "Added background agents for parallel autonomous work"
  ],
  growth_metrics: {
    arr: "$500M (May 2025)",
    yoy_growth: "9,900%",
    dau: "1M+",
    valuation: "$9.9B",
    funding: "$900M Series C",
    enterprise_adoption: "50%+ of Fortune 500"
  }
};

async function checkExistingTool() {
  const db = getDb();
  const result = await db.select().from(tools).where(eq(tools.slug, CURSOR_SLUG));
  return result.length > 0 ? result[0] : null;
}

async function updateCursorTool() {
  const db = getDb();

  console.log(`\n📝 Updating ${CURSOR_SLUG}...`);
  console.log("=".repeat(80));

  // Check if tool exists
  const existingTool = await checkExistingTool();

  if (!existingTool) {
    console.log(`  ❌ Tool not found: ${CURSOR_SLUG}`);
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
    ...cursorUpdateData,
    // Keep existing description if it's good
    description: existingData.description || cursorUpdateData.overview.substring(0, 200),
  };

  // Perform the update
  const result = await db
    .update(tools)
    .set({
      data: updatedData,
      updatedAt: new Date(),
    })
    .where(eq(tools.slug, CURSOR_SLUG))
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
    console.log(`  Growth metrics: ${JSON.stringify(updatedToolData.growth_metrics)}`);

    console.log(`\n✅ Successfully updated ${CURSOR_SLUG}`);
    return { success: true, data: result[0] };
  } else {
    console.log(`  ❌ Failed to update ${CURSOR_SLUG}`);
    return { success: false, message: "Update failed" };
  }
}

async function main() {
  console.log("🚀 Starting Cursor tool content update...\n");
  console.log("=".repeat(80));
  console.log("Tool: Cursor");
  console.log("Slug: cursor");
  console.log("Category: code-editor");
  console.log("Website: https://www.cursor.com");
  console.log("=".repeat(80));

  try {
    const result = await updateCursorTool();

    console.log("\n" + "=".repeat(80));
    if (result.success) {
      console.log("\n✨ Update completed successfully!");
      console.log("\n🎯 Cursor tool now has:");
      console.log("  ✅ Company: Anysphere, Inc.");
      console.log("  ✅ Website: https://www.cursor.com");
      console.log("  ✅ Comprehensive overview (~150 words)");
      console.log("  ✅ 12 key features");
      console.log("  ✅ 6 pricing tiers (Hobby, Pro, Pro+, Ultra, Teams, Enterprise)");
      console.log("  ✅ Target audience defined");
      console.log("  ✅ 8 use cases listed");
      console.log("  ✅ 9 integrations documented");
      console.log("  ✅ 2025 growth metrics ($500M ARR, 9,900% YoY growth)");
      console.log("  ✅ Recent updates included");
    } else {
      console.log("\n❌ Update failed!");
      console.log(`  Reason: ${result.message}`);
    }
    console.log("\n" + "=".repeat(80));
  } catch (error) {
    console.error("  ❌ Error updating Cursor tool:", error);
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
