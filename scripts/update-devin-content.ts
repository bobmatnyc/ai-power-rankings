#!/usr/bin/env tsx

/**
 * Update Devin Tool with Comprehensive Content
 *
 * This script updates the Devin tool with:
 * - Complete 2025 pricing information (Core, Team, Enterprise)
 * - Autonomous software engineering capabilities and SWE-bench scores
 * - Devin 2.0 features with 96% price reduction
 * - Complete metadata including target audience and use cases
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const DEVIN_SLUG = "devin";

const devinUpdateData = {
  company: "Cognition Labs (Cognition AI)",
  website: "https://devin.ai",
  overview: "Devin is the world's first autonomous AI software engineer from Cognition Labs, achieving breakthrough performance on the SWE-bench with 13.86% resolution rate (nearly 7x better than previous state-of-the-art). Launched in April 2025, Devin 2.0 revolutionized the market with a dramatic 96% price cut from $500 to just $20/month, introducing an agent-native IDE experience and multi-agent operation capabilities. With 83% more task completion per Agent Compute Unit (ACU) compared to version 1, Devin autonomously plans, codes, tests, debugs, and deploys applications using its integrated command line, code editor, and browser. Proven at enterprise scale with case studies like Nubank achieving 8-12x engineering efficiency gains and 20x cost savings, Devin serves developers, engineering teams, and enterprises seeking to augment their development capacity with AI that can work independently for hours while maintaining quality and reliability.",
  pricing: {
    model: "Usage-Based with Agent Compute Units (ACUs)",
    tiers: [
      {
        name: "Core",
        price: "$20/month minimum",
        features: [
          "Pay-as-you-go model at $2.25 per ACU",
          "Initial $20 includes ~9 ACUs (≈2.25 hours of Agent work)",
          "Agent-native IDE experience",
          "Multi-agent operation capability",
          "Self-assessed confidence evaluation",
          "Autonomous coding, testing, and debugging",
          "Integrated CLI, code editor, and browser",
          "Access to Devin 2.0 features"
        ],
        recommended: true
      },
      {
        name: "Team",
        price: "$500/month",
        features: [
          "Includes 250 ACUs for $2.00 per ACU",
          "Additional ACUs at $2.00 each (vs $2.25 in Core)",
          "API access for automation",
          "Team collaboration features",
          "Centralized billing",
          "Usage analytics and monitoring",
          "Priority support"
        ]
      },
      {
        name: "Enterprise",
        price: "Custom pricing",
        features: [
          "Custom ACU allocations and pricing",
          "Devin Enterprise with enhanced capabilities",
          "Custom Devins fine-tuned for specific use cases",
          "Advanced security controls",
          "SSO/SAML integration",
          "Dedicated support team",
          "SLA guarantees",
          "Invoice and PO billing",
          "On-premises deployment options"
        ]
      }
    ],
    acu_details: {
      definition: "Agent Compute Unit (ACU) = normalized measure of computing resources (VM time, model inference, networking)",
      conversion: "15 minutes of active Devin work ≈ 1 ACU",
      core_pricing: "$2.25 per ACU",
      team_pricing: "$2.00 per ACU",
      efficiency: "Devin 2.0 completes 83% more tasks per ACU vs version 1"
    }
  },
  features: [
    "Autonomous end-to-end software development (plan, code, test, deploy)",
    "Multi-agent operation: run multiple Devins in parallel workspaces",
    "Agent-native IDE resembling Visual Studio Code",
    "Self-assessed confidence evaluation with clarification requests",
    "Integrated command line interface, code editor, and browser",
    "Autonomous bug identification and fixing",
    "Code migration and refactoring at enterprise scale",
    "Data engineering and ETL pipeline development",
    "Technical documentation generation",
    "Real-time collaboration with human engineers",
    "Integration with GitHub, Slack, Linear, Jira",
    "SWE-bench verified: 13.86% unassisted resolution (7x better than competitors)",
    "Learns and adapts to specific codebases over time"
  ],
  target_audience: "Software development teams, engineering managers, enterprise companies, startups scaling engineering capacity, CTOs and technical leaders, DevOps teams, and organizations seeking autonomous AI software engineers for complex development tasks",
  use_cases: [
    "Autonomous feature development and implementation",
    "Large-scale code migration and modernization (e.g., 6M+ lines)",
    "Complex debugging and issue resolution",
    "Data engineering and ETL pipeline creation",
    "Technical documentation and code commenting",
    "Scaling development capacity without hiring",
    "Reducing repetitive engineering work",
    "Enterprise application development and maintenance"
  ],
  integrations: [
    "GitHub",
    "Slack",
    "Linear",
    "Jira",
    "Git version control",
    "CI/CD pipelines",
    "Cloud deployment platforms",
    "Databases and data warehouses",
    "API services and microservices",
    "Development tools and IDEs"
  ],
  launch_year: 2024,
  updated_2025: true,
  recent_updates_2025: [
    "Devin 2.0 launched April 2025 with 96% price reduction ($500→$20)",
    "Agent-native IDE experience introduced",
    "Multi-agent operation capability added",
    "83% improvement in task completion per ACU",
    "Self-assessed confidence evaluation system",
    "Pay-as-you-go usage-based pricing model",
    "Enterprise case study: Nubank 8-12x efficiency gains"
  ],
  benchmarks: {
    swe_bench: {
      score: "13.86%",
      methodology: "Unassisted end-to-end resolution",
      comparison: "7x better than previous SOTA (1.96%)",
      note: "Resolves real-world GitHub issues in Django, scikit-learn, etc."
    },
    enterprise_performance: {
      case_study: "Nubank",
      efficiency_gain: "8-12x",
      cost_savings: "20x",
      example: "Migration task: 40 minutes → 10 minutes",
      scale: "6 million lines of code migrated"
    }
  },
  technical_specs: {
    autonomous_capability: "Hours of independent operation",
    efficiency_improvement: "83% more tasks per ACU (v2.0 vs v1.0)",
    workspace: "Agent-native IDE environment",
    parallel_operation: "Multiple Devin agents simultaneously",
    learning: "Adapts to specific codebases over time"
  }
};

async function checkExistingTool() {
  const db = getDb();
  const result = await db.select().from(tools).where(eq(tools.slug, DEVIN_SLUG));
  return result.length > 0 ? result[0] : null;
}

async function updateDevinTool() {
  const db = getDb();

  console.log(`\n📝 Updating ${DEVIN_SLUG}...`);
  console.log("=".repeat(80));

  // Check if tool exists
  const existingTool = await checkExistingTool();

  if (!existingTool) {
    console.log(`  ❌ Tool not found: ${DEVIN_SLUG}`);
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
    ...devinUpdateData,
    // Keep existing description if it's good
    description: existingData.description || devinUpdateData.overview.substring(0, 200),
  };

  // Perform the update
  const result = await db
    .update(tools)
    .set({
      data: updatedData,
      updatedAt: new Date(),
    })
    .where(eq(tools.slug, DEVIN_SLUG))
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
    console.log(`  SWE-bench score: ${updatedToolData.benchmarks.swe_bench.score}`);

    console.log(`\n✅ Successfully updated ${DEVIN_SLUG}`);
    return { success: true, data: result[0] };
  } else {
    console.log(`  ❌ Failed to update ${DEVIN_SLUG}`);
    return { success: false, message: "Update failed" };
  }
}

async function main() {
  console.log("🚀 Starting Devin tool content update...\n");
  console.log("=".repeat(80));
  console.log("Tool: Devin");
  console.log("Slug: devin");
  console.log("Category: autonomous-software-engineer");
  console.log("Website: https://devin.ai");
  console.log("=".repeat(80));

  try {
    const result = await updateDevinTool();

    console.log("\n" + "=".repeat(80));
    if (result.success) {
      console.log("\n✨ Update completed successfully!");
      console.log("\n🎯 Devin tool now has:");
      console.log("  ✅ Company: Cognition Labs");
      console.log("  ✅ Website: https://devin.ai");
      console.log("  ✅ Comprehensive overview (~150 words)");
      console.log("  ✅ 13 key features");
      console.log("  ✅ 3 pricing tiers (Core, Team, Enterprise) with ACU model");
      console.log("  ✅ Target audience defined");
      console.log("  ✅ 8 use cases listed");
      console.log("  ✅ 10 integrations documented");
      console.log("  ✅ SWE-bench benchmark (13.86%, 7x better than SOTA)");
      console.log("  ✅ Enterprise case study (Nubank: 8-12x efficiency)");
      console.log("  ✅ Devin 2.0 updates (96% price reduction)");
    } else {
      console.log("\n❌ Update failed!");
      console.log(`  Reason: ${result.message}`);
    }
    console.log("\n" + "=".repeat(80));
  } catch (error) {
    console.error("  ❌ Error updating Devin tool:", error);
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
