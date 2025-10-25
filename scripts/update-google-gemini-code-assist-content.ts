#!/usr/bin/env tsx

/**
 * Update Google Gemini Code Assist Tool with Comprehensive Enterprise Content
 *
 * This script updates the Google Gemini Code Assist tool with:
 * - Complete 2025 pricing information (Standard and Enterprise tiers)
 * - Comprehensive Google Cloud integration features
 * - Enterprise customization and security capabilities
 * - Complete metadata including target audience and use cases
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const GEMINI_CODE_ASSIST_SLUG = "gemini-code-assist";

const geminiCodeAssistUpdateData = {
  company: "Google Cloud",
  parent_company: "Google (Alphabet Inc.)",
  website: "https://cloud.google.com/gemini/docs/codeassist/overview",
  overview: "Gemini Code Assist is Google Cloud's enterprise-grade AI-powered collaborator that accelerates the entire software development lifecycle with deep Google Cloud Platform integration. Available in both Standard and Enterprise editions, Gemini Code Assist transforms how development teams build, deploy, and operate applications through intelligent code completion, generation, chat assistance, and comprehensive cloud service integration. The Enterprise edition, launched at an introductory price of $19/user/month (regularly $45/month), offers unique code customization capabilities based on private repositories, delivering higher quality, tailored responses that understand organizational coding patterns and standards. With native integration across Apigee, Application Integration, BigQuery, Cloud Run, Firebase, and Colab Enterprise, plus enterprise-grade security, indemnification, and the powerful Gemini CLI, Code Assist empowers cloud-native development teams to build faster while maintaining security and compliance. The competitive $19/month Standard pricing matches GitHub Copilot while offering superior Google Cloud integration for enterprises invested in the GCP ecosystem.",
  pricing: {
    model: "Subscription-based with Standard and Enterprise tiers",
    tiers: [
      {
        name: "Free (Individual)",
        price: "$0/month",
        features: [
          "Basic code completion and generation",
          "Limited chat assistance",
          "IDE integration for individual developers",
          "No Google Cloud services required",
          "Community support"
        ]
      },
      {
        name: "Standard",
        price: "$19/user/month (yearly or monthly commitment)",
        features: [
          "AI-powered code completion, generation, and chat",
          "Local codebase awareness for context",
          "Code transformation capabilities",
          "Gemini in Colab Enterprise",
          "Database development assistance",
          "Enterprise-grade security",
          "IDE integrations (VS Code, JetBrains, Cloud Code)",
          "Support for 20+ programming languages"
        ],
        recommended: true
      },
      {
        name: "Enterprise",
        price: "$19/user/month (1-year subscription, intro pricing until March 31, 2025)",
        regular_price: "$45/user/month",
        minimum_seats: "10 licenses minimum",
        features: [
          "Everything in Standard edition",
          "Code customization with private repository training",
          "Higher quality, tailored responses based on organizational code",
          "Gemini in Apigee for API management",
          "Gemini in Application Integration",
          "Advanced Gemini Cloud Assist features",
          "BigQuery data insights and query generation",
          "Code completion in Cloud Run",
          "Agent mode for autonomous tasks",
          "Gemini CLI for command-line operations",
          "Enterprise indemnification",
          "Priority support and SLA"
        ]
      }
    ]
  },
  features: [
    "AI-powered code completion with multi-line suggestions",
    "Intelligent code generation from natural language",
    "Context-aware chat assistance for development questions",
    "Code transformation and modernization",
    "Private repository customization for Enterprise customers",
    "BigQuery query generation and data insights",
    "Database development assistance across Cloud SQL and BigQuery",
    "Gemini in Colab Enterprise for data science workflows",
    "Code completion in Cloud Run for serverless development",
    "Gemini CLI for command-line productivity",
    "Agent mode for multi-step autonomous coding tasks",
    "Integration with Apigee for API development",
    "Application Integration workflow assistance",
    "Support for 20+ languages including Python, Java, JavaScript, Go, TypeScript"
  ],
  target_audience: "Google Cloud Platform developers, enterprise engineering teams, cloud-native application builders, data scientists using BigQuery and Colab, API developers using Apigee, serverless teams using Cloud Run, organizations requiring GCP-integrated development tools, and teams needing private codebase customization",
  use_cases: [
    "Google Cloud Platform application development",
    "BigQuery query generation and data analysis",
    "API development and management with Apigee",
    "Serverless application development on Cloud Run",
    "Data science and ML workflows in Colab Enterprise",
    "Application integration and workflow automation",
    "Multi-cloud and hybrid cloud development",
    "Legacy code modernization and transformation",
    "Enterprise development with private codebase patterns",
    "Database-driven application development"
  ],
  integrations: [
    "Visual Studio Code",
    "JetBrains IDEs (IntelliJ IDEA, PyCharm, WebStorm, GoLand)",
    "Cloud Code IDE extensions",
    "Google Colab Enterprise",
    "BigQuery",
    "Cloud Run",
    "Apigee API Management",
    "Google Cloud Application Integration",
    "Firebase",
    "Cloud SQL",
    "Google Cloud Console",
    "Gemini CLI",
    "GitHub, GitLab, Bitbucket (for code customization)"
  ],
  launch_year: 2024,
  updated_2025: true,
  recent_updates_2025: [
    "Launched Enterprise edition with private repository customization",
    "Introduced competitive $19/month Standard pricing",
    "Added promotional Enterprise pricing ($19/month until March 31, 2025)",
    "Enhanced code quality through organizational pattern learning",
    "Expanded Agent mode for autonomous multi-step tasks",
    "Added Gemini CLI for command-line productivity",
    "Improved BigQuery integration with advanced query generation",
    "Enhanced Cloud Run code completion capabilities"
  ],
  enterprise_features: {
    customization: [
      "Private repository code pattern learning",
      "Organization-specific coding standards enforcement",
      "Custom model training on enterprise codebases",
      "Tailored responses based on internal libraries and frameworks",
      "Context-aware suggestions from proprietary code"
    ],
    security: [
      "Enterprise-grade data protection",
      "Code indemnification for Enterprise customers",
      "No training on customer code without permission",
      "Google Cloud security compliance inheritance",
      "SOC 2, ISO 27001 compliance",
      "GDPR and regional compliance support"
    ],
    administration: [
      "Centralized billing and user management",
      "Usage analytics and reporting",
      "Team-wide policy controls",
      "Integration with Google Workspace for SSO",
      "API access for custom integrations",
      "Priority support with SLA guarantees"
    ],
    cloud_integration: [
      "Deep BigQuery integration for data teams",
      "Apigee API management assistance",
      "Cloud Run serverless development support",
      "Application Integration workflow automation",
      "Colab Enterprise data science collaboration",
      "Cross-service context and recommendations"
    ]
  },
  competitive_advantages: [
    "Superior Google Cloud Platform integration vs. generic AI assistants",
    "Private codebase customization in Enterprise tier",
    "Competitive $19/month Standard pricing matching GitHub Copilot",
    "Promotional Enterprise pricing ($19/month) undercutting competitors",
    "Native BigQuery and data science workflow support",
    "Comprehensive GCP service integration (Apigee, Cloud Run, Firebase)"
  ]
};

async function checkExistingTool() {
  const db = getDb();
  const result = await db.select().from(tools).where(eq(tools.slug, GEMINI_CODE_ASSIST_SLUG));
  return result.length > 0 ? result[0] : null;
}

async function updateGeminiCodeAssistTool() {
  const db = getDb();

  console.log(`\n📝 Updating ${GEMINI_CODE_ASSIST_SLUG}...`);
  console.log("=".repeat(80));

  // Check if tool exists
  const existingTool = await checkExistingTool();

  if (!existingTool) {
    console.log(`  ❌ Tool not found: ${GEMINI_CODE_ASSIST_SLUG}`);
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
    ...geminiCodeAssistUpdateData,
    // Keep existing description if it's good
    description: existingData.description || geminiCodeAssistUpdateData.overview.substring(0, 200),
  };

  // Perform the update
  const result = await db
    .update(tools)
    .set({
      data: updatedData,
      updatedAt: new Date(),
    })
    .where(eq(tools.slug, GEMINI_CODE_ASSIST_SLUG))
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

    console.log(`\n✅ Successfully updated ${GEMINI_CODE_ASSIST_SLUG}`);
    return { success: true, data: result[0] };
  } else {
    console.log(`  ❌ Failed to update ${GEMINI_CODE_ASSIST_SLUG}`);
    return { success: false, message: "Update failed" };
  }
}

async function main() {
  console.log("🚀 Starting Google Gemini Code Assist tool content update...\n");
  console.log("=".repeat(80));
  console.log("Tool: Google Gemini Code Assist");
  console.log("Slug: google-gemini-code-assist");
  console.log("Category: Enterprise AI Coding Assistant (GCP)");
  console.log("Website: https://cloud.google.com/gemini/docs/codeassist/overview");
  console.log("=".repeat(80));

  try {
    const result = await updateGeminiCodeAssistTool();

    console.log("\n" + "=".repeat(80));
    if (result.success) {
      console.log("\n✨ Update completed successfully!");
      console.log("\n🎯 Google Gemini Code Assist tool now has:");
      console.log("  ✅ Company: Google Cloud");
      console.log("  ✅ Website: https://cloud.google.com/gemini/docs/codeassist/overview");
      console.log("  ✅ Comprehensive overview (~150 words)");
      console.log("  ✅ 14 key features");
      console.log("  ✅ 3 pricing tiers (Free, Standard, Enterprise)");
      console.log("  ✅ Enterprise features detailed (4 categories)");
      console.log("  ✅ Competitive advantages (6 listed)");
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
    console.error("  ❌ Error updating Google Gemini Code Assist tool:", error);
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
