#!/usr/bin/env tsx

/**
 * Enhance Greptile Content
 *
 * Adds comprehensive information including technical specs, customers,
 * metrics, funding, and detailed features.
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function enhanceGreptileContent() {
  const db = getDb();
  const slug = "greptile";

  console.log("🔧 Enhancing Greptile Content\n");
  console.log("=".repeat(80));

  const result = await db.select().from(tools).where(eq(tools.slug, slug));

  if (result.length === 0) {
    console.log("❌ Greptile tool not found!");
    return { success: false, error: "Tool not found" };
  }

  const existingTool = result[0];
  const existingData = existingTool.data as Record<string, any>;

  console.log("\n📋 Current Feature Count:", existingData.features?.length || 0);

  // Comprehensive updated data
  const updatedData = {
    ...existingData,
    summary: "AI-powered code review platform that catches 3x more bugs and merges PRs 4x faster with complete codebase context, serving 2,000+ software teams including top YC companies.",
    description: "Greptile is a codebase-aware AI code reviewer that provides comprehensive pull request reviews with full context understanding. Founded in 2023 and backed by Y Combinator, Greptile uses advanced AI to analyze entire codebases, offering inline comments, precise line-level suggestions, auto-generated sequence diagrams, and intelligent learning capabilities. The platform has helped teams reduce median merge time from 20 hours to 1.8 hours while catching significantly more bugs. With SOC2 Type II compliance and enterprise-grade security, Greptile serves over 2,000 teams including Brex, PostHog, Substack, Raycast, and Mintlify.",

    // Enhanced features
    features: [
      "Automated PR reviews with 100% codebase context",
      "Catches 3x more bugs compared to traditional reviews",
      "Merges PRs 4x faster (median time reduced from 20h to 1.8h)",
      "Inline comments with precise line-level suggestions",
      "Auto-generated Mermaid sequence diagrams showing call flows",
      "Context-aware suggestions analyzing related files, APIs, configs, tests, docs, and history",
      "Long-term memory learning company-specific idiosyncrasies",
      "Custom rule sets and highly scoped logic application",
      "Reinforcement learning from user feedback (thumbs up/down)",
      "Integration with Jira, Google Docs, and Notion via MCP",
      "Supports 30+ programming languages (Python, JavaScript, TypeScript, Go, Java, Ruby, Elixir, Rust, PHP, C++, etc.)",
      "Click-to-accept code suggestions",
      "File-by-file PR breakdowns with confidence scores",
      "Comprehensive codebase graph (functions, variables, classes, files, directories)",
      "Self-hosting option in air-gapped VPC",
      "API access for custom integrations",
    ],

    // Technical specifications
    technical: {
      languages_supported: ["Python", "JavaScript", "TypeScript", "Go", "Java", "Ruby", "Elixir", "Rust", "PHP", "C++", "C", "C#", "Swift"],
      total_languages: "30+",
      deployment_options: ["Cloud", "Self-hosted (air-gapped VPC)"],
      security: {
        compliance: "SOC2 Type II",
        encryption: "Data encrypted at rest and in transit",
        self_hosting: true,
      },
      integrations: ["GitHub", "GitLab", "Zapier", "Jira", "Google Docs", "Notion"],
      api_available: true,
      architecture: "Generates detailed graph of functions, variables, classes, files, and directories",
    },

    // Business information
    business: {
      ...existingData.business,
      pricing_model: "subscription",
      base_price: 30,
      pricing_details: {
        standard: "$30 per developer per month",
        enterprise: "Custom pricing for self-hosting",
        savings: "Up to 40% cheaper for high-velocity teams",
        trial: "Free trial available, no credit card needed",
      },
      founded: "2023",
      founders: ["Soohoon Choi", "Daksh Gupta", "Vaishant Kameswaran"],
      headquarters: "San Francisco, CA, USA",
      team_size: 12,
      funding: "$25M (2025)",
      backing: "Y Combinator",
    },

    // Metrics and performance
    metrics: {
      users: "2,000+ software teams",
      merge_time_reduction: "20 hours → 1.8 hours (median)",
      bug_detection_improvement: "3x more bugs caught",
      speed_improvement: "50-80% faster merging",
      code_review_volume: "500M+ lines of code reviewed monthly",
    },

    // Notable customers
    customers: [
      "PostHog",
      "Brex",
      "Substack",
      "Raycast",
      "Mintlify",
      "Vouch",
      "Podium",
      "Y Combinator internal team",
    ],

    // Use cases
    use_cases: [
      "Automated pull request reviews",
      "Bug detection and prevention",
      "Code quality enforcement",
      "Team onboarding and knowledge transfer",
      "Security vulnerability detection",
      "Performance optimization recommendations",
      "Documentation consistency",
      "Codebase navigation and understanding",
    ],

    // Competitive advantages
    differentiators: [
      "Complete codebase context understanding",
      "Long-term learning of team patterns",
      "Integration with team knowledge bases (Jira, Docs, Notion)",
      "Highly customizable rule sets",
      "Enterprise-grade security with self-hosting",
      "Proven performance metrics (3x bugs, 4x faster)",
      "Reinforcement learning from team feedback",
    ],
  };

  // Update database
  const updateResult = await db
    .update(tools)
    .set({
      data: updatedData,
      updatedAt: new Date(),
    })
    .where(eq(tools.slug, slug))
    .returning();

  console.log("\n✅ Enhanced Data:");
  console.log(`  Features: ${updatedData.features.length}`);
  console.log(`  Languages Supported: ${updatedData.technical.total_languages}`);
  console.log(`  Customers: ${updatedData.customers.length}`);
  console.log(`  Use Cases: ${updatedData.use_cases.length}`);
  console.log(`  Pricing: $${updatedData.business.base_price}/developer/month`);
  console.log(`  Users: ${updatedData.metrics.users}`);
  console.log(`  Funding: ${updatedData.business.funding}`);

  console.log("\n" + "=".repeat(80));
  console.log("✅ Greptile content enhanced successfully!\n");

  return { success: true, data: updateResult[0] };
}

async function main() {
  try {
    await enhanceGreptileContent();
  } catch (error) {
    console.error("\n❌ Error enhancing Greptile content:", error);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

main();
