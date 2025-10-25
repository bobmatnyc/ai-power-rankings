#!/usr/bin/env tsx

/**
 * Update Windsurf Tool with Comprehensive Enterprise Content
 *
 * This script updates the Windsurf (Codeium) tool with:
 * - Complete 2025 pricing information (Free, Pro, Teams, Enterprise)
 * - Comprehensive AI-native IDE and Flows features
 * - Enterprise self-hosted deployment capabilities
 * - Complete metadata including target audience and use cases
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const WINDSURF_SLUG = "windsurf";

const windsurfUpdateData = {
  company: "Codeium",
  website: "https://windsurf.com/",
  overview: "Windsurf is the world's first truly AI-native IDE from Codeium, redefining software development through the revolutionary AI Flows paradigm that seamlessly blends collaborative Copilot capabilities with autonomous Agent intelligence. Launched in late 2024 and rapidly enhanced through 2025, Windsurf features Cascade, an advanced AI agent that understands entire codebases beyond single files, enabling context-aware development at scale. The Flows architecture provides AI access to knowledge, tools, and uniquely human actions, creating a development experience where AI acts as both collaborative partner and independent executor. With generous free tier credits (25 prompts/month equivalent to 100 premium model interactions), Windsurf democratizes access to cutting-edge AI including GPT-4.1 and o4-mini. The Enterprise tier, trusted by over 1,000 businesses including Zillow, Dell, and Anduril, offers self-hosted deployments, enhanced security features, custom integrations across 40+ development environments, and comprehensive admin controls. Windsurf's innovative Workflows automate repetitive tasks via natural language, in-editor live previews accelerate frontend development, and one-click deployments streamline DevOps - all within a unified, AI-first development environment.",
  pricing: {
    model: "Freemium with Pro, Teams, and Enterprise tiers",
    tiers: [
      {
        name: "Free",
        price: "$0/month",
        features: [
          "25 prompt credits per month (equivalent to 100 GPT-4.1/o4-mini prompts)",
          "Increased from 5 credits in early 2025",
          "Cascade AI agent with basic context",
          "Code completions and chat",
          "Access to premium AI models",
          "IDE for all major operating systems",
          "Community support"
        ]
      },
      {
        name: "Pro",
        price: "$15/month",
        features: [
          "Unlimited prompt credits for premium models",
          "Enhanced Cascade AI agent capabilities",
          "Advanced Flows for complex workflows",
          "Unlimited code completions",
          "Full access to GPT-4.1, o4-mini, and other premium LLMs",
          "Priority model access",
          "In-editor live previews for frontend development",
          "Workflows for task automation",
          "Priority support"
        ],
        recommended: true
      },
      {
        name: "Teams",
        price: "$30/user/month",
        features: [
          "Everything in Pro",
          "Team collaboration features",
          "Shared codebase context",
          "Team usage analytics",
          "Centralized billing",
          "Team admin controls",
          "Enhanced support"
        ]
      },
      {
        name: "Enterprise",
        price: "$60/user/month",
        features: [
          "Everything in Teams",
          "Self-hosted deployment options",
          "Enhanced enterprise security features",
          "Custom integrations across 40+ development environments",
          "Advanced admin and policy controls",
          "SSO and SAML authentication",
          "Audit logs and compliance reporting",
          "Dedicated customer success manager",
          "24/7 enterprise support",
          "SLA guarantees",
          "Custom onboarding and training"
        ]
      }
    ]
  },
  features: [
    "AI-native IDE built from ground up for AI-first development",
    "Cascade AI agent with comprehensive codebase understanding",
    "AI Flows paradigm combining Copilot and Agent capabilities",
    "Context-aware code generation beyond single files",
    "Workflows for automating repetitive tasks via natural language",
    "In-editor live previews for frontend development",
    "One-click deployment integration",
    "Windsurf Tab with auto-import and package suggestions",
    "Support for GPT-4.1, o4-mini, and premium AI models",
    "Multi-environment integration (40+ supported)",
    "Self-hosted deployment for enterprise security",
    "Enhanced security features and compliance controls",
    "Team collaboration with shared context",
    "Advanced codebase indexing and search"
  ],
  target_audience: "Forward-thinking development teams, AI-first software engineers, startups seeking rapid development velocity, enterprises requiring self-hosted AI solutions (Zillow, Dell, Anduril), frontend developers needing live previews, DevOps teams automating workflows, and organizations transitioning to AI-native development practices",
  use_cases: [
    "AI-native greenfield project development",
    "Rapid prototyping with AI Flows and Workflows",
    "Frontend development with live preview feedback",
    "Complex refactoring across large codebases with Cascade",
    "Automated workflow creation via natural language",
    "One-click deployment pipelines",
    "Enterprise self-hosted AI development environments",
    "Team collaboration on AI-assisted projects",
    "Legacy codebase modernization with comprehensive context",
    "Multi-step feature implementation with autonomous agents"
  ],
  integrations: [
    "40+ development environment integrations",
    "VS Code migration support",
    "JetBrains IDE compatibility",
    "GitHub integration",
    "GitLab integration",
    "Bitbucket support",
    "CI/CD pipeline integrations",
    "Cloud deployment platforms",
    "Package managers and dependency tools",
    "Self-hosted infrastructure (Enterprise)"
  ],
  launch_year: 2024,
  updated_2025: true,
  recent_updates_2025: [
    "Increased free tier credits from 5 to 25 prompts/month",
    "Enhanced Cascade AI agent with deeper codebase understanding",
    "Expanded AI Flows capabilities for complex workflows",
    "Added support for GPT-4.1 and o4-mini models",
    "Improved Workflows for natural language task automation",
    "Enhanced in-editor live preview features",
    "Expanded enterprise integrations to 40+ environments",
    "Improved self-hosted deployment options"
  ],
  enterprise_features: {
    deployment: [
      "Self-hosted on-premises deployment",
      "Private cloud deployment options",
      "Air-gapped environment support",
      "Custom infrastructure integration",
      "Hybrid deployment architectures",
      "Multi-region deployment support"
    ],
    security_compliance: [
      "Enhanced enterprise security controls",
      "SSO and SAML authentication",
      "Audit logs for compliance",
      "Data residency controls",
      "Custom security policies",
      "Compliance reporting (SOC 2, ISO support)",
      "Code never leaves enterprise environment"
    ],
    customization: [
      "Custom integrations across 40+ environments",
      "Tailored AI model configurations",
      "Organization-specific workflows",
      "Custom deployment pipelines",
      "Branded developer experience",
      "Flexible licensing models"
    ],
    administration: [
      "Advanced admin and policy controls",
      "Centralized user management",
      "Team usage analytics and insights",
      "License allocation and tracking",
      "Custom onboarding programs",
      "Dedicated customer success manager",
      "24/7 enterprise support with SLA",
      "Regular business reviews"
    ]
  },
  innovative_features: {
    flows: "Revolutionary paradigm combining Copilot collaboration with Agent autonomy, giving AI access to knowledge, tools, and human-in-the-loop actions",
    cascade: "Advanced AI agent that understands entire codebases, not just single files, enabling context-aware suggestions and autonomous multi-file refactoring",
    workflows: "Natural language automation of repetitive development tasks, reducing manual work and accelerating delivery",
    live_previews: "In-editor real-time frontend preview eliminating context switching and speeding up UI development",
    one_click_deploy: "Streamlined deployment process integrated directly into IDE workflow"
  },
  competitive_advantages: [
    "Only truly AI-native IDE built from ground up (vs. AI bolted onto existing IDEs)",
    "Revolutionary Flows paradigm unique to Windsurf",
    "Cascade agent with comprehensive codebase understanding beyond competitors",
    "Generous free tier (25 credits = 100 premium prompts vs. competitors' limits)",
    "Self-hosted enterprise deployment (rare among AI IDEs)",
    "Trusted by 1,000+ businesses including Fortune 500 companies",
    "Proven enterprise integration across 40+ development environments"
  ],
  customer_showcase: [
    "Zillow - Real estate technology leader",
    "Dell - Enterprise technology solutions",
    "Anduril - Defense technology innovator",
    "1,000+ businesses worldwide"
  ]
};

async function checkExistingTool() {
  const db = getDb();
  const result = await db.select().from(tools).where(eq(tools.slug, WINDSURF_SLUG));
  return result.length > 0 ? result[0] : null;
}

async function updateWindsurfTool() {
  const db = getDb();

  console.log(`\n📝 Updating ${WINDSURF_SLUG}...`);
  console.log("=".repeat(80));

  // Check if tool exists
  const existingTool = await checkExistingTool();

  if (!existingTool) {
    console.log(`  ❌ Tool not found: ${WINDSURF_SLUG}`);
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
    ...windsurfUpdateData,
    // Keep existing description if it's good
    description: existingData.description || windsurfUpdateData.overview.substring(0, 200),
  };

  // Perform the update
  const result = await db
    .update(tools)
    .set({
      data: updatedData,
      updatedAt: new Date(),
    })
    .where(eq(tools.slug, WINDSURF_SLUG))
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
    console.log(`  Innovative features: ${Object.keys(updatedToolData.innovative_features).length} highlighted`);
    console.log(`  Competitive advantages: ${updatedToolData.competitive_advantages.length} listed`);

    console.log(`\n✅ Successfully updated ${WINDSURF_SLUG}`);
    return { success: true, data: result[0] };
  } else {
    console.log(`  ❌ Failed to update ${WINDSURF_SLUG}`);
    return { success: false, message: "Update failed" };
  }
}

async function main() {
  console.log("🚀 Starting Windsurf tool content update...\n");
  console.log("=".repeat(80));
  console.log("Tool: Windsurf");
  console.log("Slug: windsurf");
  console.log("Category: AI-Native IDE");
  console.log("Website: https://windsurf.com/");
  console.log("Company: Codeium");
  console.log("=".repeat(80));

  try {
    const result = await updateWindsurfTool();

    console.log("\n" + "=".repeat(80));
    if (result.success) {
      console.log("\n✨ Update completed successfully!");
      console.log("\n🎯 Windsurf tool now has:");
      console.log("  ✅ Company: Codeium");
      console.log("  ✅ Website: https://windsurf.com/");
      console.log("  ✅ Comprehensive overview (~150 words)");
      console.log("  ✅ 14 key features");
      console.log("  ✅ 4 pricing tiers (Free, Pro, Teams, Enterprise)");
      console.log("  ✅ Enterprise features detailed (4 categories)");
      console.log("  ✅ Innovative features (5 highlighted)");
      console.log("  ✅ Competitive advantages (7 listed)");
      console.log("  ✅ Customer showcase (4 notable companies)");
      console.log("  ✅ Target audience defined");
      console.log("  ✅ 10 use cases listed");
      console.log("  ✅ 10 integrations documented");
      console.log("  ✅ 2025 recent updates included");
    } else {
      console.log("\n❌ Update failed!");
      console.log(`  Reason: ${result.message}`);
    }
    console.log("\n" + "=".repeat(80));
  } catch (error) {
    console.error("  ❌ Error updating Windsurf tool:", error);
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
