#!/usr/bin/env tsx

/**
 * Update Replit Agent Tool with Comprehensive Content
 *
 * This script updates the Replit Agent tool with:
 * - Complete 2025 pricing information (effort-based model)
 * - Agent 3 autonomous capabilities (200-minute runtime)
 * - $150M ARR milestone achievement
 * - Complete metadata including target audience and use cases
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const REPLIT_AGENT_SLUG = "replit-agent";

const replitAgentUpdateData = {
  company: "Replit, Inc.",
  website: "https://replit.com/agent3",
  overview: "Replit Agent represents a breakthrough in autonomous AI coding, achieving $150M in annualized revenue (up from $2.8M in less than a year—a 50x increase) following a $250M funding round at $3B valuation in September 2025. Agent 3, the latest iteration, can work autonomously for up to 200 minutes compared to just 2 minutes in version 1, delivering 10x more autonomy with self-testing, debugging, and even the ability to build other agents. Using an innovative effort-based pricing model starting at $0.06 for simple tasks, Replit Agent transforms natural language prompts into fully functional applications with its proprietary testing system that's 3x faster and 10x cheaper than computer-use models. Integrated directly into Replit's cloud-based development platform with $25-$40 monthly credits included in subscriptions, Agent 3 enables developers, startups, and non-technical founders to build, test, and deploy software at unprecedented speed and scale.",
  pricing: {
    model: "Effort-Based Usage Pricing",
    tiers: [
      {
        name: "Starter (Free)",
        price: "$0/month",
        features: [
          "Limited Replit Agent trial access",
          "Up to 10 public apps",
          "Basic cloud development environment",
          "Community support"
        ]
      },
      {
        name: "Core",
        price: "$20/month (billed annually) or $25/month",
        features: [
          "Full access to Replit Agent 3",
          "$25 in monthly AI/cloud credits (≈100 agent checkpoints)",
          "Access to advanced AI models (Claude Sonnet 3.7, GPT-4o)",
          "Private apps and deployments",
          "Effort-based pricing: $0.06-$2+ per task",
          "Extended Thinking and High Power Model options",
          "200-minute autonomous runtime capability"
        ],
        recommended: true
      },
      {
        name: "Teams",
        price: "$40/user/month",
        features: [
          "Everything in Core",
          "$40 per user in monthly credits",
          "Centralized team billing",
          "Role-based access control",
          "Private deployments",
          "Collaborative workspace",
          "Usage analytics",
          "Additional ACUs at $2.00 per ACU"
        ]
      },
      {
        name: "Enterprise",
        price: "Custom pricing",
        features: [
          "Everything in Teams",
          "Custom credit allocation",
          "SSO/SAML authentication",
          "Dedicated support",
          "Advanced security controls",
          "Custom SLA",
          "Invoice/PO billing",
          "Priority access to new features"
        ]
      }
    ],
    usage_details: {
      model: "Effort-Based Checkpoints",
      description: "Pricing scales with task complexity. Simple changes cost as little as $0.06, while complex multi-step tasks may cost several dollars. Each checkpoint represents concrete units of work based on computing resources consumed.",
      examples: [
        "Simple UI change: ~$0.06-$0.25",
        "Feature addition: ~$0.50-$2.00",
        "Complex refactoring: ~$2.00-$10.00",
        "Full app build: varies based on scope"
      ],
      acu_definition: "15 minutes of active Agent work ≈ 1 ACU (Agent Compute Unit)"
    }
  },
  features: [
    "Autonomous coding for up to 200 minutes (10x more than Agent 2)",
    "Self-testing and debugging with proprietary system (3x faster, 10x cheaper)",
    "Agent Generation: builds other specialized agents and automations",
    "Natural language to full application development",
    "Extended Thinking mode for complex architectural decisions",
    "High Power Model upgrade for superior problem-solving",
    "Integrated cloud development environment with instant deployments",
    "Real-time code execution and testing",
    "Automatic bug detection and fixing",
    "Multi-file editing and complex refactoring",
    "Database and API integration",
    "Support for 50+ programming languages and frameworks"
  ],
  target_audience: "Individual developers, software engineering teams, startups building MVPs, non-technical founders, educators, students, freelancers, and companies seeking rapid application development with autonomous AI agents",
  use_cases: [
    "Building full-stack applications from natural language descriptions",
    "Rapid MVP and prototype development",
    "Autonomous debugging and testing workflows",
    "Creating specialized automation bots and scheduled tasks",
    "Complex code refactoring and modernization",
    "Learning programming through AI-assisted development",
    "Building internal tools and automation systems",
    "Scaling development capacity for startups and small teams"
  ],
  integrations: [
    "Replit cloud development platform",
    "Claude Sonnet 3.7 (Anthropic)",
    "GPT-4o (OpenAI)",
    "Git version control",
    "PostgreSQL and other databases",
    "REST and GraphQL APIs",
    "Deployment platforms",
    "50+ programming languages and frameworks",
    "Package managers (npm, pip, cargo, etc.)"
  ],
  launch_year: 2024,
  updated_2025: true,
  recent_updates_2025: [
    "Agent 3 launched with 200-minute autonomous runtime",
    "Reached $150M ARR (50x growth from $2.8M in under a year)",
    "Raised $250M at $3B valuation (September 2025)",
    "Introduced effort-based pricing model",
    "Added Agent Generation capability (agents building agents)",
    "Proprietary testing system: 3x faster, 10x cheaper",
    "Extended Thinking and High Power Model features added"
  ],
  growth_metrics: {
    arr: "$150M (2025)",
    growth_rate: "50x in under 12 months",
    valuation: "$3B",
    funding: "$250M Series C",
    autonomy_improvement: "10x (2 min → 200 min runtime)"
  }
};

async function checkExistingTool() {
  const db = getDb();
  const result = await db.select().from(tools).where(eq(tools.slug, REPLIT_AGENT_SLUG));
  return result.length > 0 ? result[0] : null;
}

async function updateReplitAgentTool() {
  const db = getDb();

  console.log(`\n📝 Updating ${REPLIT_AGENT_SLUG}...`);
  console.log("=".repeat(80));

  // Check if tool exists
  const existingTool = await checkExistingTool();

  if (!existingTool) {
    console.log(`  ❌ Tool not found: ${REPLIT_AGENT_SLUG}`);
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
    ...replitAgentUpdateData,
    // Keep existing description if it's good
    description: existingData.description || replitAgentUpdateData.overview.substring(0, 200),
  };

  // Perform the update
  const result = await db
    .update(tools)
    .set({
      data: updatedData,
      updatedAt: new Date(),
    })
    .where(eq(tools.slug, REPLIT_AGENT_SLUG))
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

    console.log(`\n✅ Successfully updated ${REPLIT_AGENT_SLUG}`);
    return { success: true, data: result[0] };
  } else {
    console.log(`  ❌ Failed to update ${REPLIT_AGENT_SLUG}`);
    return { success: false, message: "Update failed" };
  }
}

async function main() {
  console.log("🚀 Starting Replit Agent tool content update...\n");
  console.log("=".repeat(80));
  console.log("Tool: Replit Agent");
  console.log("Slug: replit-agent");
  console.log("Category: autonomous-coding");
  console.log("Website: https://replit.com/agent3");
  console.log("=".repeat(80));

  try {
    const result = await updateReplitAgentTool();

    console.log("\n" + "=".repeat(80));
    if (result.success) {
      console.log("\n✨ Update completed successfully!");
      console.log("\n🎯 Replit Agent tool now has:");
      console.log("  ✅ Company: Replit, Inc.");
      console.log("  ✅ Website: https://replit.com/agent3");
      console.log("  ✅ Comprehensive overview (~150 words)");
      console.log("  ✅ 12 key features");
      console.log("  ✅ 4 pricing tiers with effort-based model");
      console.log("  ✅ Target audience defined");
      console.log("  ✅ 8 use cases listed");
      console.log("  ✅ 9 integrations documented");
      console.log("  ✅ 2025 growth metrics ($150M ARR, 50x growth)");
      console.log("  ✅ Agent 3 capabilities (200-min runtime)");
    } else {
      console.log("\n❌ Update failed!");
      console.log(`  Reason: ${result.message}`);
    }
    console.log("\n" + "=".repeat(80));
  } catch (error) {
    console.error("  ❌ Error updating Replit Agent tool:", error);
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
