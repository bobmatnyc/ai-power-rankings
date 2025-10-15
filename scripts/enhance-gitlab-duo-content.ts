#!/usr/bin/env tsx

/**
 * Enhance GitLab Duo Content
 *
 * Adds comprehensive information including all features across SDLC,
 * technical specs, enterprise capabilities, and detailed pricing.
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function enhanceGitLabDuoContent() {
  const db = getDb();
  const slug = "gitlab-duo";

  console.log("🔧 Enhancing GitLab Duo Content\n");
  console.log("=".repeat(80));

  const result = await db.select().from(tools).where(eq(tools.slug, slug));

  if (result.length === 0) {
    console.log("❌ GitLab Duo tool not found!");
    return { success: false, error: "Tool not found" };
  }

  const existingTool = result[0];
  const existingData = existingTool.data as Record<string, any>;

  console.log("\n📋 Current Feature Count:", existingData.features?.length || 0);

  // Comprehensive updated data
  const updatedData = {
    ...existingData,
    summary: "Comprehensive AI-native assistant suite integrated across the entire software development lifecycle, now included with GitLab Premium and Ultimate as of version 18.0, offering AI-powered code generation, review, testing, and security analysis for DevSecOps teams.",
    description: "GitLab Duo is a comprehensive suite of AI-native features seamlessly integrated into the GitLab platform to accelerate software development velocity and enhance productivity across planning, coding, reviewing, and deploying phases. Announced as part of GitLab Premium and Ultimate tiers in May 2025 (v18.0), GitLab Duo includes powerful capabilities like Code Suggestions, AI Chat, vulnerability detection, test generation, root cause analysis, and the new GitLab Duo Agent Platform with specialized AI agents for testing and security. The platform features an AI Impact Dashboard for tracking effectiveness across DORA metrics, prompt caching for reduced latency, and deep integration with IDEs and the GitLab UI. Available across multi-tenant SaaS, single-tenant SaaS, and self-managed deployments, GitLab Duo serves enterprise teams looking to modernize their DevSecOps practices with AI-powered automation.",

    // Comprehensive features organized by SDLC phase
    features: [
      // Planning Work
      "AI-powered issue description generation",
      "Automated discussion summarization",

      // Authoring Code
      "Intelligent code suggestions and completions",
      "Multi-language code explanation (IDE, files, merge requests)",
      "Automated test generation with coverage optimization",
      "AI-driven code refactoring recommendations",
      "Automatic code quality fixes",
      "GitLab CLI command discovery and suggestions",

      // Reviewing Code
      "AI-generated merge request summaries",
      "Context-aware code review assistance",
      "Automated review comment summarization",
      "Intelligent commit message generation",
      "CI/CD job failure root cause analysis",

      // Advanced Capabilities
      "Agentic Chat with natural language interface",
      "Workflow automation across DevSecOps lifecycle",
      "AI Impact Analytics with DORA metrics tracking",
      "Vulnerability explanation with remediation guidance",
      "AI-powered vulnerability resolution",

      // GitLab Duo Enterprise (Ultimate)
      "AI Impact Dashboard for organization-wide metrics",
      "Specialized AI agents for testing and security (Agent Platform)",
      "Prompt caching for reduced latency and improved performance",
      "Custom AI model integration capabilities",

      // Integration & Deployment
      "Deep IDE integration (VS Code, JetBrains, Visual Studio)",
      "GitLab UI native integration",
      "CLI support for terminal workflows",
      "Self-managed and SaaS deployment options",
      "Multi-tenant and single-tenant SaaS options",
    ],

    // Technical specifications
    technical: {
      deployment_options: [
        "Multi-tenant SaaS",
        "Single-tenant SaaS",
        "Self-managed (on-premises)",
      ],
      ide_integrations: [
        "VS Code",
        "JetBrains IDEs (IntelliJ, PyCharm, WebStorm, etc.)",
        "Visual Studio",
        "GitLab Web IDE",
      ],
      platforms: ["Web UI", "IDE Extensions", "CLI"],
      performance_features: {
        prompt_caching: "Available across SaaS and Self-Managed deployments",
        latency_optimization: "Prompt caching reduces response times by reusing processed input",
      },
      ai_capabilities: {
        natural_language_processing: true,
        code_understanding: "Multi-language support",
        context_awareness: "Full repository context",
        learning_capabilities: "Organizational pattern recognition",
      },
      metrics_tracking: {
        dora_metrics: true,
        cycle_time: true,
        deployment_frequency: true,
        ai_adoption_tracking: true,
        team_performance_comparison: true,
      },
    },

    // Business information
    business: {
      ...existingData.business,
      pricing_model: "tiered_subscription",
      base_price: 29,
      pricing_details: {
        premium: "$29/user/month - includes Duo Code Suggestions and Chat (as of GitLab 18.0)",
        ultimate: "$99/user/month - includes Duo Code Suggestions, Chat, and Enterprise features",
        duo_pro_addon: "$19/month - additional Duo Pro capabilities",
        duo_enterprise_addon: "Custom pricing - full Enterprise feature set with AI Impact Dashboard",
        included_in_base: "Code Suggestions and Chat now included in Premium/Ultimate (June 2025)",
        deployment_flexibility: "Same pricing across multi-tenant, single-tenant, and self-managed",
      },
      company: "GitLab Inc.",
      founded: "2011",
      headquarters: "San Francisco, CA, USA",
      publicly_traded: true,
      stock_symbol: "GTLB (NASDAQ)",
    },

    // Metrics and adoption
    metrics: {
      launch_date: "GitLab 18.0 (May 2025)",
      included_with_premium_ultimate: "June 2025",
      platform_users: "30M+ registered users (GitLab platform)",
      enterprise_customers: "Thousands of organizations",
      deployment_options: 3,
      supported_ides: "4+ major IDEs",
    },

    // Enterprise features
    enterprise_features: [
      "AI Impact Dashboard with organization-wide analytics",
      "DORA metrics integration and tracking",
      "Team performance comparison (AI-enabled vs traditional)",
      "AI adoption progress monitoring",
      "Specialized AI agents for testing and security scanning",
      "GitLab Duo Agent Platform access",
      "Custom model integration capabilities",
      "Advanced security and compliance features",
      "Self-managed deployment options",
      "Dedicated support and SLAs",
    ],

    // Use cases organized by team role
    use_cases: [
      // Developers
      "Accelerating code writing with intelligent suggestions",
      "Understanding complex codebases quickly",
      "Generating comprehensive test coverage automatically",
      "Refactoring legacy code with AI guidance",
      "Debugging CI/CD pipeline failures faster",

      // Code Reviewers
      "Streamlining merge request reviews with AI summaries",
      "Identifying potential issues before human review",
      "Generating meaningful commit messages automatically",
      "Providing consistent review feedback",

      // Security Teams
      "Identifying and explaining vulnerabilities",
      "Getting AI-powered remediation recommendations",
      "Automating security scanning with AI agents",
      "Tracking security posture across projects",

      // Engineering Managers
      "Measuring AI impact on team productivity",
      "Tracking DORA metrics across teams",
      "Comparing AI-enabled vs traditional team performance",
      "Optimizing development workflows with data-driven insights",

      // Organizations
      "Modernizing DevSecOps practices with AI",
      "Reducing time-to-market for features",
      "Improving code quality and security posture",
      "Standardizing development practices across teams",
    ],

    // Competitive advantages
    differentiators: [
      "Only AI assistant fully integrated across entire DevSecOps lifecycle",
      "Included with Premium/Ultimate tiers (no separate AI subscription needed)",
      "AI Impact Dashboard for measuring organizational effectiveness",
      "Deployment flexibility (SaaS, single-tenant, self-managed)",
      "DORA metrics integration for quantifiable impact measurement",
      "Specialized AI agents for testing and security (Agent Platform)",
      "Platform vendor advantage (tight integration with GitLab ecosystem)",
      "Enterprise-grade security and compliance",
      "No data egress for self-managed deployments",
      "Backed by GitLab's public company resources and roadmap",
    ],

    // Integration highlights
    integrations: {
      version_control: "Native GitLab integration",
      ci_cd: "GitLab CI/CD pipelines",
      issue_tracking: "GitLab Issues",
      security: "GitLab Security Dashboard",
      ides: ["VS Code", "JetBrains", "Visual Studio"],
      chat_platforms: "GitLab UI, IDE extensions",
    },
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
  console.log(`  Enterprise Features: ${updatedData.enterprise_features.length}`);
  console.log(`  Use Cases: ${updatedData.use_cases.length}`);
  console.log(`  Deployment Options: ${updatedData.technical.deployment_options.length}`);
  console.log(`  IDE Integrations: ${updatedData.technical.ide_integrations.length}`);
  console.log(`  Base Pricing: $${updatedData.business.base_price}/user/month (Premium)`);

  console.log("\n" + "=".repeat(80));
  console.log("✅ GitLab Duo content enhanced successfully!\n");

  return { success: true, data: updateResult[0] };
}

async function main() {
  try {
    await enhanceGitLabDuoContent();
  } catch (error) {
    console.error("\n❌ Error enhancing GitLab Duo content:", error);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

main();
