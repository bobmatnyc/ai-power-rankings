#!/usr/bin/env tsx

/**
 * Enhance Graphite Content
 *
 * Adds comprehensive information including technical specs, customers,
 * metrics, funding, and detailed features.
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function enhanceGraphiteContent() {
  const db = getDb();
  const slug = "graphite";

  console.log("🔧 Enhancing Graphite Content\n");
  console.log("=".repeat(80));

  const result = await db.select().from(tools).where(eq(tools.slug, slug));

  if (result.length === 0) {
    console.log("❌ Graphite tool not found!");
    return { success: false, error: "Tool not found" };
  }

  const existingTool = result[0];
  const existingData = existingTool.data as Record<string, any>;

  console.log("\n📋 Current Feature Count:", existingData.features?.length || 0);

  // Comprehensive updated data
  const updatedData = {
    ...existingData,
    summary: "AI-powered code review platform that accelerates development velocity by 40x, backed by $81M in funding from Anthropic, Accel, and a16z, serving tens of thousands of engineers at 500+ companies including Shopify, Snowflake, and Figma.",
    description: "Graphite (formerly featuring Diamond AI) is a comprehensive code review platform that revolutionizes how engineering teams ship code. Built with Anthropic's Claude and leveraging both Claude and OpenAI models, Graphite provides instant AI-powered code reviews with industry-leading accuracy and the lowest false-positive rates. The platform combines stacked PRs, intelligent merge queues, PR inbox management, and AI code review capabilities to help teams ship higher quality code faster. With $81M in total funding ($52M Series B in 2025) and 20x revenue growth in 2024, Graphite serves enterprise customers including Shopify, Snowflake, Figma, Perplexity, Semgrep, Ramp, and Asana, processing reviews 40x faster than traditional methods.",

    // Enhanced features
    features: [
      "AI-powered code review (Graphite Agent, formerly Diamond)",
      "Reviews code 40x faster than traditional methods",
      "Sub-3% false-positive rates (industry-leading accuracy)",
      "90-second average review cycles",
      "Stacked PRs for sequential, dependent code changes",
      "Intelligent merge queue with stack-aware processing",
      "Unified PR inbox for centralized review management",
      "Automatic PR summarization",
      "Actionable code suggestions with one-click accept",
      "Self-healing CI for failing builds",
      "Developer metrics dashboard",
      "CLI and VS Code extension",
      "Slack notifications and integrations",
      "CI optimization and acceleration",
      "Bug detection and security vulnerability scanning",
      "Style inconsistency identification",
      "Performance issue detection",
      "Documentation gap analysis",
      "Customizable review rules and guidelines",
      "Complete codebase context awareness",
      "GitHub deep integration",
    ],

    // Technical specifications
    technical: {
      ai_models: ["Anthropic Claude (primary)", "OpenAI models (supplementary)"],
      model_selection_reasoning: "Claude chosen for deep code understanding and lowest false-positive rate",
      integrations: ["GitHub", "VS Code", "Git", "Slack"],
      deployment_options: ["Cloud (SaaS)"],
      platforms: ["Web", "CLI", "VS Code Extension"],
      performance: {
        review_speed: "40x faster than traditional reviews",
        average_cycle_time: "90 seconds",
        false_positive_rate: "<3%",
        accuracy_improvement: "Highest among tested LLMs",
      },
      github_exclusive: true,
      vs_code_extension: true,
    },

    // Business information
    business: {
      ...existingData.business,
      pricing_model: "subscription",
      base_price: 15,
      pricing_details: {
        with_graphite_subscription: "$15 per active contributor per month (Diamond/Agent add-on)",
        without_subscription: "$20 per active committer per month",
        base_platform: "Free for 30 days, no credit card required",
        enterprise: "Custom pricing available",
        note: "Graphite Agent (formerly Diamond) is an add-on to the base platform",
      },
      founded: "2020",
      headquarters: "San Francisco, CA, USA",
      total_funding: "$81M",
      latest_funding: "$52M Series B (2025)",
      investors: [
        "Accel (Series B lead)",
        "Andreessen Horowitz (a16z)",
        "Menlo Ventures (Anthology Fund with Anthropic)",
        "Shopify Ventures",
        "Figma Ventures",
        "The General Partnership",
      ],
      revenue_growth: "20x growth in 2024",
    },

    // Metrics and performance
    metrics: {
      companies: "500+",
      engineers: "Tens of thousands",
      revenue_growth_2024: "20x",
      review_speed_multiplier: "40x faster",
      review_cycle_average: "90 seconds",
      false_positive_rate: "<3%",
      customer_satisfaction: "96% positive feedback rate",
    },

    // Notable customers
    customers: [
      "Shopify",
      "Snowflake",
      "Figma",
      "Perplexity",
      "Semgrep",
      "Ramp",
      "Asana",
      "Tecton",
    ],

    // Use cases
    use_cases: [
      "Accelerating code review cycles",
      "Maintaining code quality at scale",
      "Managing complex dependency chains with stacked PRs",
      "Reducing merge conflicts and bottlenecks",
      "Improving developer productivity and velocity",
      "Catching bugs and security vulnerabilities early",
      "Enforcing coding standards and style guides",
      "Streamlining CI/CD pipelines",
      "Onboarding new team members faster",
      "Reducing code review burnout",
    ],

    // Competitive advantages
    differentiators: [
      "Backed and built with Anthropic's Claude AI",
      "Industry-leading false-positive rate (<3%)",
      "40x faster review cycles than traditional methods",
      "Unique stacked PR workflow for dependent changes",
      "Stack-aware intelligent merge queue",
      "Comprehensive platform combining multiple dev tools",
      "Enterprise-grade customers (Shopify, Snowflake, Figma)",
      "Proven revenue growth (20x in 2024)",
      "Deep GitHub integration with Git compatibility",
      "Free 30-day trial with no credit card required",
    ],

    // Awards and recognition
    recognition: [
      "Featured in Anthropic customer case studies",
      "TechCrunch coverage for $52M Series B",
      "$81M total funding from top-tier VCs",
      "Trusted by Fortune 500 companies",
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
  console.log(`  AI Models: ${updatedData.technical.ai_models.join(", ")}`);
  console.log(`  Customers: ${updatedData.customers.length}`);
  console.log(`  Use Cases: ${updatedData.use_cases.length}`);
  console.log(`  Companies Served: ${updatedData.metrics.companies}`);
  console.log(`  Total Funding: ${updatedData.business.total_funding}`);
  console.log(`  Revenue Growth 2024: ${updatedData.metrics.revenue_growth_2024}`);

  console.log("\n" + "=".repeat(80));
  console.log("✅ Graphite content enhanced successfully!\n");

  return { success: true, data: updateResult[0] };
}

async function main() {
  try {
    await enhanceGraphiteContent();
  } catch (error) {
    console.error("\n❌ Error enhancing Graphite content:", error);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

main();
