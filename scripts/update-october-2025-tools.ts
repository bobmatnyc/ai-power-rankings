#!/usr/bin/env tsx

/**
 * Update October 2025 Tools with Complete Data
 *
 * Updates ClackyAI, Flint, and DFINITY Caffeine with comprehensive metadata and scores
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ToolScoreFactors } from "@/lib/services/tool-scoring.service";

/**
 * Generate factor scores based on overall score
 * Uses scoring algorithm v7.2 pattern
 */
function generateFactorScores(overallScore: number): ToolScoreFactors {
  return {
    overallScore,
    marketTraction: Math.round(overallScore * 0.75),
    technicalCapability: Math.round(overallScore * 0.90),
    developerAdoption: Math.round(overallScore * 0.78),
    developmentVelocity: Math.round(overallScore * 0.70),
    platformResilience: Math.round(overallScore * 0.72),
    communitySentiment: Math.round(overallScore * 0.85),
  };
}

/**
 * Tool update definitions with complete metadata
 */
const toolUpdates = [
  {
    slug: "clacky-ai",
    name: "ClackyAI",
    overallScore: 85,
    data: {
      id: "clacky-ai",
      name: "ClackyAI",
      category: "other",
      subcategory: "Agentic Cloud Development Environment",
      summary: "Autonomous AI-powered cloud development environment that transforms issue descriptions directly into pull requests through multi-agent collaboration.",
      description: "ClackyAI is an agentic cloud development environment that transforms issue descriptions directly into pull requests through autonomous AI agents. The platform provides full-stack development capabilities with multi-threaded task execution, structured progress tracking, and collaborative async workflows entirely in the cloud. Features include full codebase awareness with real-time diagnostics, Task Time Machine for tracking AI-generated code changes, and support for multiple languages and databases.",
      website: "https://clacky.ai/",
      launchDate: "2025-08",

      features: [
        "Autonomous issue-to-PR transformation",
        "Full codebase awareness with real-time diagnostics",
        "Task Time Machine for tracking AI-generated code changes",
        "Multi-agent collaboration and task coordination",
        "Cloud-based development environment",
        "Multi-threaded task execution",
        "Structured progress tracking",
        "Collaborative async workflows",
      ],

      technical: {
        languages_supported: ["Python", "Node.js", "Golang", "Ruby", "Java"],
        databases_supported: ["MySQL", "Redis", "PostgreSQL", "MongoDB"],
        deployment: "Cloud-based",
        capabilities: {
          codebase_awareness: true,
          real_time_diagnostics: true,
          task_tracking: "Time Machine feature",
          multi_agent: true,
        },
      },

      business: {
        company: "ClackyAI",
        founder: "Yafei Lee",
        founded: "2025",
        pricing_model: "freemium",
        pricing_details: {
          free_trial: "Available",
          details: "Free trial available with paid tiers",
        },
      },

      metrics: {
        launch_date: "August 2025",
        status: "active",
        adoption: "Early stage",
      },

      use_cases: [
        "Automated PR generation from issue descriptions",
        "Full-stack cloud development",
        "Multi-agent collaborative coding",
        "Async development workflows",
        "Real-time code diagnostics and tracking",
      ],

      differentiators: [
        "Issue-to-PR autonomous transformation",
        "Multi-agent collaboration system",
        "Task Time Machine for change tracking",
        "Full codebase awareness",
        "Cloud-native development platform",
      ],
    },
  },
  {
    slug: "flint",
    name: "Flint",
    overallScore: 87,
    data: {
      id: "flint",
      name: "Flint",
      category: "other",
      subcategory: "Autonomous Website Development",
      summary: "AI platform that creates autonomous websites that continuously build, optimize, and update themselves with automatic A/B testing and conversion optimization.",
      description: "Flint creates autonomous websites that continuously build, optimize, and update themselves using AI. The platform enables companies to launch on-brand landing pages that automatically adapt to market trends, perform A/B tests, and optimize conversion rates without human intervention. Backed by $5M seed funding led by Accel, Flint has demonstrated 50% higher Google Ads conversion rates and serves customers including Cognition, Modal, and Graphite.",
      website: "https://www.tryflint.com/",
      launchDate: "2025-10",

      features: [
        "Autonomous website generation and updates",
        "Self-optimizing pages with automatic A/B testing",
        "Dynamic content adaptation based on visitor behavior",
        "Automatic competitor response",
        "AI SEO optimization",
        "On-brand landing page generation",
        "Continuous conversion rate optimization",
        "Market trend adaptation",
      ],

      technical: {
        deployment: "SaaS Platform",
        capabilities: {
          autonomous_updates: true,
          ab_testing: "Automatic",
          seo_optimization: true,
          dynamic_adaptation: true,
          competitor_tracking: true,
        },
        performance: {
          conversion_improvement: "50% higher Google Ads conversion rates",
        },
      },

      business: {
        company: "Flint",
        founders: ["Michelle Lim", "Max Levenson"],
        founded: "2025",
        funding: "$5M seed (October 2025)",
        investors: ["Accel (lead)"],
        pricing_model: "custom",
        pricing_details: {
          availability: "Closed beta",
          details: "Custom pricing",
        },
        customers: ["Cognition", "Modal", "Graphite"],
      },

      metrics: {
        launch_date: "October 2025",
        funding_total: "$5M",
        funding_round: "Seed",
        status: "active",
        adoption: "Early customers include Cognition, Modal, Graphite",
        performance_metrics: {
          conversion_rate_improvement: "50% higher",
        },
      },

      use_cases: [
        "Autonomous landing page creation and optimization",
        "Dynamic marketing website management",
        "Conversion rate optimization automation",
        "Competitive market response",
        "Self-updating product pages",
      ],

      differentiators: [
        "Fully autonomous website updates",
        "50% higher Google Ads conversion rates",
        "Automatic A/B testing without human intervention",
        "Dynamic visitor behavior adaptation",
        "Automatic competitor tracking and response",
        "Continuous self-optimization",
      ],
    },
  },
  {
    slug: "dfinity-caffeine",
    name: "Caffeine",
    overallScore: 88,
    data: {
      id: "dfinity-caffeine",
      name: "Caffeine",
      category: "other",
      subcategory: "AI Full-Stack Application Platform",
      summary: "Revolutionary AI platform running on blockchain that builds, deploys, and continuously updates production-grade full-stack web applications from natural language prompts at 'chat speed'.",
      description: "Caffeine is a revolutionary AI platform that builds, deploys, and continuously updates production-grade full-stack web applications directly from natural language prompts. Running entirely on the Internet Computer Protocol blockchain, it enables anyone to create secure, data-protected apps without coding experience, using conversational AI to develop at 'chat speed'. Powered by Anthropic Claude Sonnet and developed by DFINITY Foundation, Caffeine has attracted over 15,000 alpha users and features an App Market with clonable templates and native Web3 integration.",
      website: "https://caffeine.ai/",
      launchDate: "2025-07",

      features: [
        "Natural language to full-stack app generation",
        "Blockchain-based deployment (Internet Computer Protocol)",
        "Mathematical data protection guarantees",
        "Self-updating applications",
        "App Market with clonable templates",
        "Native Web3 integration (tokens, NFTs, DAOs)",
        "Conversational AI development interface",
        "Production-grade application deployment",
      ],

      technical: {
        ai_model: "Anthropic Claude Sonnet",
        blockchain: "Internet Computer Protocol (ICP)",
        deployment: "Blockchain-based",
        pricing_model_technical: "Reverse gas model on ICP",
        capabilities: {
          natural_language_dev: true,
          blockchain_deployment: true,
          data_protection: "Mathematical guarantees",
          self_updating: true,
          web3_integration: true,
          template_cloning: true,
        },
        security: {
          data_protection: "Blockchain-based mathematical guarantees",
          deployment: "Decentralized on ICP",
        },
      },

      business: {
        company: "DFINITY Foundation",
        founder: "Dominic Williams",
        founded: "Platform launched 2025",
        pricing_model: "blockchain_based",
        pricing_details: {
          model: "Reverse gas model on Internet Computer Protocol",
          details: "Blockchain-based pricing",
        },
      },

      metrics: {
        launch_date: "July 2025",
        alpha_users: "15,000+",
        status: "active",
        adoption: "15,000+ alpha users",
        platform: "Internet Computer Protocol blockchain",
      },

      use_cases: [
        "No-code full-stack web application development",
        "Rapid prototype to production deployment",
        "Blockchain-secured application hosting",
        "Web3-enabled application creation",
        "Self-updating application management",
        "Template-based app cloning and customization",
      ],

      differentiators: [
        "Natural language development at 'chat speed'",
        "Full blockchain deployment on Internet Computer Protocol",
        "Mathematical data protection guarantees",
        "Self-updating application capabilities",
        "No coding experience required",
        "Native Web3 integration (tokens, NFTs, DAOs)",
        "15,000+ alpha users",
        "Powered by Anthropic Claude Sonnet",
        "App Market with clonable templates",
      ],

      integrations: {
        ai_model: "Anthropic Claude Sonnet",
        blockchain: "Internet Computer Protocol",
        web3_features: ["Tokens", "NFTs", "DAOs"],
      },
    },
  },
];

async function updateTools() {
  const db = getDb();
  console.log("🚀 Updating October 2025 Tools with Complete Data\n");
  console.log("=".repeat(80));

  let updatedCount = 0;
  let notFoundCount = 0;
  let errorCount = 0;

  for (const update of toolUpdates) {
    try {
      console.log(`\n📦 Processing: ${update.name}`);

      // Check if tool exists
      const existing = await db
        .select()
        .from(tools)
        .where(eq(tools.slug, update.slug))
        .limit(1);

      if (existing.length === 0) {
        console.log(`❌ Tool not found: ${update.name}`);
        notFoundCount++;
        continue;
      }

      // Generate baseline scores
      const baselineScore = generateFactorScores(update.overallScore);
      const deltaScore: ToolScoreFactors = {}; // No delta initially
      const currentScore = baselineScore;

      // Update the tool
      await db
        .update(tools)
        .set({
          name: update.name, // Update name in case it changed
          data: update.data,
          baselineScore,
          deltaScore,
          currentScore,
          scoreUpdatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(tools.slug, update.slug));

      console.log(`✅ Updated: ${update.name}`);
      console.log(`   Overall Score: ${update.overallScore}/100`);
      console.log(`   Website: ${update.data.website}`);
      console.log(`   Launch: ${update.data.launchDate}`);
      console.log(`   Features: ${update.data.features.length}`);
      console.log(`   Use Cases: ${update.data.use_cases.length}`);
      console.log(`   Differentiators: ${update.data.differentiators.length}`);

      updatedCount++;
    } catch (error) {
      console.error(`❌ Error updating ${update.name}:`, error);
      errorCount++;
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("\n📊 Summary:");
  console.log(`   ✅ Updated: ${updatedCount} tools`);
  console.log(`   ❌ Not found: ${notFoundCount} tools`);
  console.log(`   ❌ Errors: ${errorCount} tools`);
  console.log(`   📦 Total processed: ${toolUpdates.length} tools`);

  return {
    updated: updatedCount,
    notFound: notFoundCount,
    errors: errorCount,
    total: toolUpdates.length,
  };
}

async function main() {
  try {
    const result = await updateTools();

    if (result.errors > 0 || result.notFound > 0) {
      console.error(`\n⚠️  Completed with issues`);
      process.exit(1);
    }

    console.log("\n=".repeat(80));
    console.log("✨ Update completed successfully!\n");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

main();
