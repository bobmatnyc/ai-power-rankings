#!/usr/bin/env tsx

/**
 * Update Sourcegraph Cody Tool with Comprehensive Enterprise Content
 *
 * This script updates the Sourcegraph Cody tool with:
 * - Complete 2025 pricing information (Free, Pro, Enterprise tiers)
 * - Comprehensive code intelligence features
 * - Enterprise BYOLLM and context engine capabilities
 * - Complete metadata including target audience and use cases
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const SOURCEGRAPH_CODY_SLUG = "sourcegraph-cody";

const sourcegraphCodyUpdateData = {
  company: "Sourcegraph",
  website: "https://sourcegraph.com/cody",
  overview: "Sourcegraph Cody is an enterprise-focused AI coding assistant that combines advanced code intelligence with autonomous agentic capabilities to understand, navigate, and transform large-scale codebases. Unlike generic AI assistants, Cody leverages Sourcegraph's industry-leading Code Graph technology to provide deep contextual understanding across repositories, enabling accurate code generation, comprehensive refactoring, and intelligent code review. The Enterprise tier offers unique BYOLLM (Bring Your Own LLM) capabilities supporting Amazon Bedrock, Azure OpenAI, and custom model deployments, plus single-tenant and self-hosted options for maximum security and compliance. With support for Claude 3.5 Sonnet, GPT-4o, Gemini 1.5 Pro, and Mixtral-8x7B, plus unlimited codebase connections to Bitbucket, GitHub, GitLab, and Perforce, Cody delivers unparalleled context-aware assistance. The Advanced Context Engine, Jira integration, customized AI code validation rules, and 24/5 enhanced support make Cody the premier choice for enterprises managing complex, multi-repository codebases at scale.",
  pricing: {
    model: "Freemium with Pro and Enterprise tiers",
    tiers: [
      {
        name: "Free",
        price: "$0/month",
        features: [
          "Unlimited autocompletion suggestions per month",
          "200 chats and prompts per month",
          "Access to creating custom prompts",
          "Basic code intelligence",
          "IDE integration (VS Code, JetBrains, Neovim)",
          "Community support"
        ]
      },
      {
        name: "Pro",
        price: "$9/user/month",
        features: [
          "Unlimited autocompletion suggestions",
          "Unlimited chat and command executions",
          "Access to Claude 3.5 Sonnet, GPT-4o, Gemini 1.5 Pro",
          "Advanced code completions",
          "Custom prompt creation",
          "Enhanced context awareness",
          "Priority support"
        ],
        recommended: true
      },
      {
        name: "Enterprise Starter",
        price: "$19/user/month",
        features: [
          "Everything in Pro",
          "Advanced AI and search capabilities",
          "Up to 50 developers",
          "Team collaboration features",
          "Basic admin controls",
          "Email support"
        ]
      },
      {
        name: "Enterprise",
        price: "$59/user/month",
        features: [
          "Advanced Code Graph context for deep codebase understanding",
          "Multi-code host context (GitHub, GitLab, Bitbucket, Perforce)",
          "Unlimited codebase connections",
          "BYOLLM - Bring Your Own LLM (Amazon Bedrock, Azure OpenAI)",
          "Single-tenant and self-hosted deployment options",
          "SAML/SSO authentication",
          "Guardrails to enforce coding standards",
          "Jira integration for issue tracking",
          "Customized AI code validation rules",
          "24/5 enhanced support",
          "Advanced analytics and reporting",
          "Seat-based or token-based pricing models"
        ]
      }
    ]
  },
  features: [
    "Advanced Code Graph technology for comprehensive codebase understanding",
    "Autonomous agentic coding for multi-step tasks",
    "Context-aware code completions with multi-repository awareness",
    "Intelligent code generation from natural language",
    "Comprehensive code search across massive codebases",
    "Multi-code host support (GitHub, GitLab, Bitbucket, Perforce)",
    "BYOLLM - Bring Your Own LLM keys and endpoints",
    "Support for Claude 3.5 Sonnet, GPT-4o, Gemini 1.5 Pro, Mixtral-8x7B",
    "Single-tenant and self-hosted deployment options",
    "Custom AI code validation and guardrails",
    "Jira integration for issue-driven development",
    "Advanced code refactoring and modernization",
    "SAML/SSO enterprise authentication",
    "Symbol search and code navigation at scale"
  ],
  target_audience: "Enterprise engineering teams, organizations with large multi-repository codebases, security-conscious enterprises requiring self-hosted solutions, teams needing BYOLLM flexibility, developers managing complex monorepos, financial services and healthcare organizations, and companies requiring advanced code intelligence and compliance",
  use_cases: [
    "Large-scale enterprise codebase navigation and understanding",
    "Multi-repository refactoring and modernization",
    "Code search across thousands of repositories",
    "Compliance-driven development with custom validation rules",
    "On-premises and air-gapped development environments",
    "BYOLLM integration for cost optimization or custom models",
    "Issue-driven development with Jira integration",
    "Code review automation with organizational standards enforcement",
    "Developer onboarding for complex legacy codebases",
    "Technical debt reduction at enterprise scale"
  ],
  integrations: [
    "Visual Studio Code",
    "JetBrains IDEs (IntelliJ IDEA, PyCharm, WebStorm, GoLand, etc.)",
    "Neovim",
    "GitHub Enterprise",
    "GitLab",
    "Bitbucket",
    "Perforce",
    "Jira",
    "Amazon Bedrock (BYOLLM)",
    "Azure OpenAI (BYOLLM)",
    "SAML/SSO providers",
    "Slack (via integrations)",
    "CI/CD pipelines"
  ],
  launch_year: 2023,
  updated_2025: true,
  recent_updates_2025: [
    "Enhanced Advanced Code Graph for better multi-repo context",
    "Expanded BYOLLM support to include Amazon Bedrock and Azure OpenAI",
    "Added customizable AI code validation rules and guardrails",
    "Improved Jira integration for issue-driven development",
    "Enhanced autonomous agent capabilities for complex refactoring",
    "Introduced flexible token-based pricing model for Enterprise",
    "Added support for Claude 3.5 Sonnet and Gemini 1.5 Pro",
    "Improved self-hosted deployment options for compliance"
  ],
  enterprise_features: {
    code_intelligence: [
      "Advanced Code Graph for comprehensive codebase understanding",
      "Multi-repository context across GitHub, GitLab, Bitbucket, Perforce",
      "Unlimited codebase connections",
      "Deep Search for precise code finding",
      "Symbol search and navigation at scale",
      "Batch Changes for large-scale code modifications",
      "Code Insights for analytics and patterns"
    ],
    security_compliance: [
      "Single-tenant cloud deployment",
      "Self-hosted and on-premises options",
      "Air-gapped environment support",
      "SAML/SSO authentication",
      "Custom code validation guardrails",
      "Zero LLM retention policies",
      "SOC 2 Type II compliance",
      "Data residency controls"
    ],
    flexibility: [
      "BYOLLM - bring your own LLM provider",
      "Amazon Bedrock integration",
      "Azure OpenAI integration",
      "Custom model endpoints",
      "Seat-based or token-based pricing",
      "Flexible deployment architectures",
      "Custom integration APIs"
    ],
    administration: [
      "Centralized admin controls",
      "Usage analytics and reporting",
      "Team management and provisioning",
      "Policy-based access controls",
      "Jira integration for workflow management",
      "24/5 enhanced support with SLA",
      "Dedicated customer success manager"
    ]
  },
  competitive_advantages: [
    "Industry-leading Code Graph technology for superior context",
    "BYOLLM flexibility (Amazon Bedrock, Azure OpenAI) vs. vendor lock-in",
    "Self-hosted and air-gapped deployment options for maximum security",
    "Multi-code host support (GitHub, GitLab, Bitbucket, Perforce)",
    "Unlimited codebase connections for large enterprises",
    "Custom code validation rules and organizational guardrails",
    "Proven at scale with enterprises like Uber, Lyft, Dropbox"
  ]
};

async function checkExistingTool() {
  const db = getDb();
  const result = await db.select().from(tools).where(eq(tools.slug, SOURCEGRAPH_CODY_SLUG));
  return result.length > 0 ? result[0] : null;
}

async function updateSourcegraphCodyTool() {
  const db = getDb();

  console.log(`\n📝 Updating ${SOURCEGRAPH_CODY_SLUG}...`);
  console.log("=".repeat(80));

  // Check if tool exists
  const existingTool = await checkExistingTool();

  if (!existingTool) {
    console.log(`  ❌ Tool not found: ${SOURCEGRAPH_CODY_SLUG}`);
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
    ...sourcegraphCodyUpdateData,
    // Keep existing description if it's good
    description: existingData.description || sourcegraphCodyUpdateData.overview.substring(0, 200),
  };

  // Perform the update
  const result = await db
    .update(tools)
    .set({
      data: updatedData,
      updatedAt: new Date(),
    })
    .where(eq(tools.slug, SOURCEGRAPH_CODY_SLUG))
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
    console.log(`  Competitive advantages: ${updatedToolData.competitive_advantages.length} listed`);

    console.log(`\n✅ Successfully updated ${SOURCEGRAPH_CODY_SLUG}`);
    return { success: true, data: result[0] };
  } else {
    console.log(`  ❌ Failed to update ${SOURCEGRAPH_CODY_SLUG}`);
    return { success: false, message: "Update failed" };
  }
}

async function main() {
  console.log("🚀 Starting Sourcegraph Cody tool content update...\n");
  console.log("=".repeat(80));
  console.log("Tool: Sourcegraph Cody");
  console.log("Slug: sourcegraph-cody");
  console.log("Category: Enterprise AI Code Intelligence");
  console.log("Website: https://sourcegraph.com/cody");
  console.log("=".repeat(80));

  try {
    const result = await updateSourcegraphCodyTool();

    console.log("\n" + "=".repeat(80));
    if (result.success) {
      console.log("\n✨ Update completed successfully!");
      console.log("\n🎯 Sourcegraph Cody tool now has:");
      console.log("  ✅ Company: Sourcegraph");
      console.log("  ✅ Website: https://sourcegraph.com/cody");
      console.log("  ✅ Comprehensive overview (~150 words)");
      console.log("  ✅ 14 key features");
      console.log("  ✅ 4 pricing tiers (Free, Pro, Enterprise Starter, Enterprise)");
      console.log("  ✅ Enterprise features detailed (4 categories)");
      console.log("  ✅ Competitive advantages (7 listed)");
      console.log("  ✅ Target audience defined");
      console.log("  ✅ 10 use cases listed");
      console.log("  ✅ 13 integrations documented");
      console.log("  ✅ 2025 recent updates included");
    } else {
      console.log("\n❌ Update failed!");
      console.log(`  Reason: ${result.message}`);
    }
    console.log("\n" + "=".repeat(80));
  } catch (error) {
    console.error("  ❌ Error updating Sourcegraph Cody tool:", error);
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
