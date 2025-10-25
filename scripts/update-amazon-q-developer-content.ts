#!/usr/bin/env tsx

/**
 * Update Amazon Q Developer Tool with Comprehensive Enterprise Content
 *
 * This script updates the Amazon Q Developer tool with:
 * - Complete 2025 pricing information (Free and Pro tiers)
 * - Comprehensive AWS-integrated feature list
 * - Enterprise security and compliance capabilities
 * - Complete metadata including target audience and use cases
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const AMAZON_Q_SLUG = "amazon-q-developer";

const amazonQUpdateData = {
  company: "Amazon Web Services (AWS)",
  parent_company: "Amazon",
  website: "https://aws.amazon.com/q/developer/",
  overview: "Amazon Q Developer is AWS's enterprise-grade AI coding assistant that reimagines the entire software development lifecycle with deep AWS cloud integration. Launched in 2024 and significantly enhanced in 2025, Amazon Q transforms how developers build, secure, manage, and optimize applications on or off AWS infrastructure. Unlike generic AI assistants, Q Developer features unique autonomous agents capable of multi-step implementation tasks, legacy code transformation (Java and .NET upgrades with up to 4,000 lines/month on Pro), and comprehensive AWS resource management through natural language queries. The Pro tier provides enterprise customers with unlimited chat interactions, unlimited agent invocations, customization based on organizational codebases, IP indemnification, automatic opt-out from training data collection, and integration with IAM Identity Center for centralized user management. With built-in security scanning, SOC/ISO/HIPAA/PCI compliance eligibility, and native integration across AWS services, Amazon Q Developer is the definitive AI assistant for cloud-native enterprise development teams.",
  pricing: {
    model: "Freemium with Professional tier",
    tiers: [
      {
        name: "Free",
        price: "$0/month",
        features: [
          "50 chat interactions per month",
          "10 agent invocations per month",
          "Up to 1,000 lines of code transformation",
          "Basic IDE integration (VS Code, JetBrains, Visual Studio)",
          "CLI integration for AWS operations",
          "Reference tracking for code suggestions",
          "Option to suppress public code suggestions",
          "Security scanning for vulnerabilities"
        ]
      },
      {
        name: "Pro",
        price: "$19/user/month",
        features: [
          "Unlimited chat interactions",
          "Unlimited Amazon Q Developer Agent invocations",
          "Up to 4,000 lines of code transformation per month",
          "Additional transformation at $0.003 per line",
          "Customization to organizational codebase",
          "Unlimited AWS resource queries via CLI and chat",
          "Generative SQL capabilities",
          "IP indemnification for generated code",
          "Automatic opt-out from training and data retention",
          "Enterprise access controls and user management",
          "Analytics dashboard for usage tracking",
          "IAM Identity Center integration",
          "Priority support"
        ],
        recommended: true
      }
    ]
  },
  features: [
    "Autonomous AI agents for multi-step development tasks",
    "Feature implementation from natural language descriptions",
    "Automated code refactoring and modernization",
    "Legacy code transformation (Java 8/11 to 17, .NET Framework to .NET Core)",
    "AWS resource management via natural language queries",
    "Built-in security scanning and vulnerability detection",
    "Generative SQL for database operations",
    "Context-aware code completions and suggestions",
    "Conversational chat interface for coding assistance",
    "CLI integration for AWS infrastructure operations",
    "Customization based on private organizational codebases",
    "Reference tracking with open-source attribution",
    "IP indemnification for enterprise customers",
    "SOC, ISO, HIPAA, and PCI compliance eligibility"
  ],
  target_audience: "AWS cloud developers, enterprise engineering teams, cloud-native application builders, DevOps professionals, organizations migrating to AWS, software architects, teams requiring SOC/HIPAA/PCI compliance, and enterprises seeking AWS-integrated development tools",
  use_cases: [
    "AWS cloud-native application development",
    "Legacy application modernization (Java and .NET upgrades)",
    "Multi-step feature implementation with autonomous agents",
    "Infrastructure-as-code generation and management",
    "Security vulnerability scanning and remediation",
    "Database query generation and optimization",
    "AWS resource provisioning via natural language",
    "Codebase-aware development for large enterprises",
    "Compliant development in regulated industries (healthcare, finance)"
  ],
  integrations: [
    "Visual Studio Code",
    "JetBrains IDEs (IntelliJ IDEA, PyCharm, WebStorm, etc.)",
    "Visual Studio",
    "AWS CLI",
    "AWS Console",
    "AWS Lambda",
    "Amazon RDS and database services",
    "AWS CodeCommit, CodeBuild, CodeDeploy",
    "IAM Identity Center",
    "Amazon S3, EC2, ECS, EKS",
    "AWS CloudFormation",
    "GitHub, GitLab, Bitbucket (via AWS integrations)"
  ],
  launch_year: 2024,
  updated_2025: true,
  recent_updates_2025: [
    "Enhanced autonomous agent capabilities for complex tasks",
    "Expanded code transformation to .NET Framework migration",
    "Increased Pro tier transformation quota to 4,000 lines/month",
    "Added codebase customization for enterprise customers",
    "Improved AWS resource query natural language interface",
    "Enhanced security scanning with automated remediation",
    "Added IP indemnification for Pro tier customers",
    "Integrated usage analytics dashboard for organizations"
  ],
  enterprise_features: {
    security: [
      "SOC, ISO, HIPAA, PCI compliance eligibility",
      "Built-in security vulnerability scanning",
      "Automatic training data opt-out",
      "No code retention on AWS servers",
      "IP indemnification for generated code",
      "Enterprise-grade access controls"
    ],
    administration: [
      "IAM Identity Center integration for SSO",
      "Centralized user management and provisioning",
      "Usage analytics and reporting dashboard",
      "Policy-based code suggestion controls",
      "Block suggestions from open-source code",
      "Organization-wide settings management"
    ],
    customization: [
      "Codebase-aware suggestions from private repositories",
      "Organization-specific context and patterns",
      "Custom code transformation rules",
      "Tailored AWS infrastructure recommendations",
      "Private model training on enterprise codebases"
    ]
  },
  compliance: [
    "SOC 1, 2, and 3 certified",
    "ISO 27001, 27017, 27018 compliant",
    "HIPAA eligible for healthcare applications",
    "PCI DSS compliant for payment processing",
    "GDPR compliant for European operations",
    "AWS shared responsibility model"
  ]
};

async function checkExistingTool() {
  const db = getDb();
  const result = await db.select().from(tools).where(eq(tools.slug, AMAZON_Q_SLUG));
  return result.length > 0 ? result[0] : null;
}

async function updateAmazonQTool() {
  const db = getDb();

  console.log(`\n📝 Updating ${AMAZON_Q_SLUG}...`);
  console.log("=".repeat(80));

  // Check if tool exists
  const existingTool = await checkExistingTool();

  if (!existingTool) {
    console.log(`  ❌ Tool not found: ${AMAZON_Q_SLUG}`);
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
    ...amazonQUpdateData,
    // Keep existing description if it's good
    description: existingData.description || amazonQUpdateData.overview.substring(0, 200),
  };

  // Perform the update
  const result = await db
    .update(tools)
    .set({
      data: updatedData,
      updatedAt: new Date(),
    })
    .where(eq(tools.slug, AMAZON_Q_SLUG))
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
    console.log(`  Compliance: ${updatedToolData.compliance.length} standards`);

    console.log(`\n✅ Successfully updated ${AMAZON_Q_SLUG}`);
    return { success: true, data: result[0] };
  } else {
    console.log(`  ❌ Failed to update ${AMAZON_Q_SLUG}`);
    return { success: false, message: "Update failed" };
  }
}

async function main() {
  console.log("🚀 Starting Amazon Q Developer tool content update...\n");
  console.log("=".repeat(80));
  console.log("Tool: Amazon Q Developer");
  console.log("Slug: amazon-q-developer");
  console.log("Category: Enterprise AI Coding Assistant (AWS)");
  console.log("Website: https://aws.amazon.com/q/developer/");
  console.log("=".repeat(80));

  try {
    const result = await updateAmazonQTool();

    console.log("\n" + "=".repeat(80));
    if (result.success) {
      console.log("\n✨ Update completed successfully!");
      console.log("\n🎯 Amazon Q Developer tool now has:");
      console.log("  ✅ Company: Amazon Web Services (AWS)");
      console.log("  ✅ Website: https://aws.amazon.com/q/developer/");
      console.log("  ✅ Comprehensive overview (~150 words)");
      console.log("  ✅ 14 key features");
      console.log("  ✅ 2 pricing tiers (Free, Pro)");
      console.log("  ✅ Enterprise features detailed (3 categories)");
      console.log("  ✅ Compliance standards (6 listed)");
      console.log("  ✅ Target audience defined");
      console.log("  ✅ 9 use cases listed");
      console.log("  ✅ 12 integrations documented");
      console.log("  ✅ 2025 recent updates included");
    } else {
      console.log("\n❌ Update failed!");
      console.log(`  Reason: ${result.message}`);
    }
    console.log("\n" + "=".repeat(80));
  } catch (error) {
    console.error("  ❌ Error updating Amazon Q Developer tool:", error);
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
