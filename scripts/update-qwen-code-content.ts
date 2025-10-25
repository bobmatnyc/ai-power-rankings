#!/usr/bin/env tsx

/**
 * Update Qwen Code Tool with Comprehensive Content
 *
 * This script updates the Qwen Code tool with:
 * - Complete 2025 GitHub metrics (14.7k stars, Apache 2.0)
 * - Alibaba Cloud's advanced Qwen3-Coder integration
 * - Agentic coding capabilities with 480B parameter model
 * - 256K-1M token context window support
 * - Competitive benchmarks vs GPT-4 and Claude
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const QWEN_CODE_SLUG = "qwen-code";

const qwenCodeUpdateData = {
  company: "Alibaba Cloud (Qwen Team)",
  website: "https://qwenlm.github.io/blog/qwen3-coder/",
  github_url: "https://github.com/QwenLM/qwen-code",
  huggingface_url: "https://huggingface.co/Qwen",
  license: "Apache-2.0",
  overview: "Qwen Code is Alibaba Cloud's powerful open-source command-line AI workflow tool with 14,700+ GitHub stars, specifically optimized for the groundbreaking Qwen3-Coder model family. Released in July 2025, Qwen Code brings enterprise-grade agentic coding to the terminal with a 480-billion parameter Mixture-of-Experts model (35B active parameters) that rivals proprietary solutions from OpenAI and Anthropic. Built on a fork of Google's Gemini CLI and enhanced with Qwen-specific optimizations, this tool delivers exceptional performance with native support for 256K token context windows (extendable to 1 million tokens), enabling developers to process entire codebases in a single session. With over 20 million global downloads across the Qwen model family and competitive benchmarks in agentic coding, browser use, and tool use, Qwen Code represents China's answer to Western AI dominance. The tool combines cutting-edge AI research from Alibaba with practical developer workflows, offering free open-source access to one of the world's most powerful coding models.",
  pricing: {
    model: "Free Open Source (Self-Hosted or Alibaba Cloud)",
    tiers: [
      {
        name: "Open Source (Free)",
        price: "$0 (Apache 2.0 License)",
        features: [
          "Full source code access on GitHub",
          "Qwen3-Coder model downloads from Hugging Face",
          "Self-hosted deployment",
          "All features unlocked",
          "Community support",
          "No subscription fees"
        ],
        recommended: true
      },
      {
        name: "Alibaba Cloud API",
        price: "Pay-per-use pricing",
        features: [
          "Hosted Qwen models via API",
          "No infrastructure management",
          "Scalable compute resources",
          "Enterprise SLA options",
          "Alibaba Cloud integration",
          "Cost-effective compared to Western APIs"
        ]
      },
      {
        name: "Self-Hosted MoE Model",
        price: "$0 (Requires GPU infrastructure)",
        features: [
          "480B parameter model (35B active)",
          "Complete data privacy",
          "No API costs",
          "Custom fine-tuning possible",
          "Ideal for enterprise deployments",
          "Requires GPU infrastructure"
        ]
      }
    ]
  },
  features: [
    "Qwen3-Coder 480B MoE model with 35B active parameters",
    "Native 256K token context, extendable to 1M tokens",
    "Agentic coding: autonomous multi-step task execution",
    "Browser use capabilities for web development",
    "Advanced tool use and API integration",
    "Enhanced parser optimized for Qwen models",
    "Multi-language coding support (100+ languages)",
    "Codebase comprehension at massive scale",
    "Workflow automation and code editing",
    "Competitive with GPT-4 and Claude on benchmarks",
    "Fork of Gemini CLI with Qwen-specific enhancements",
    "Free and open source under Apache 2.0"
  ],
  target_audience: "Enterprise developers seeking alternatives to Western AI providers, organizations requiring data sovereignty, open source enthusiasts, researchers working with large language models, Chinese developers and companies, teams needing massive context windows, and developers seeking cost-effective high-performance coding AI",
  use_cases: [
    "Enterprise agentic coding with data sovereignty",
    "Massive codebase analysis (256K-1M token context)",
    "Alternative to GPT-4/Claude for cost savings",
    "Browser automation and web development",
    "Tool integration and API workflow automation",
    "Research and development with open models",
    "Multi-step autonomous coding tasks",
    "Self-hosted AI coding for privacy compliance",
    "Chinese language coding support",
    "Competitive benchmarking against proprietary models"
  ],
  integrations: [
    "Alibaba Cloud (Model Studio, DashScope)",
    "Hugging Face (model downloads)",
    "Terminal environments (bash, zsh, fish)",
    "Git version control",
    "TypeScript/JavaScript ecosystems (built with TS)",
    "npm package manager",
    "Web browsers (for browser use feature)",
    "Custom APIs and tools",
    "Local GPU infrastructure (NVIDIA, AMD)",
    "Compatible with Gemini CLI extensions"
  ],
  launch_year: 2025,
  updated_2025: true,
  recent_updates_2025: [
    "Launched July 23, 2025 with Qwen3-Coder model",
    "Released 480B parameter MoE model (35B active)",
    "Achieved 14,700+ GitHub stars",
    "Reached 20M+ downloads across Qwen model family",
    "Updated October 24, 2025 with latest features",
    "Competitive benchmarks vs GPT-4 and Claude",
    "Added enhanced parser for Qwen model optimization"
  ],
  github_metrics: {
    stars: "14,700+",
    forks: "1,200+",
    contributors: "Alibaba Qwen team + community",
    commits: "2,462+",
    license: "Apache-2.0",
    primary_language: "TypeScript",
    latest_release: "October 2025 updates",
    open_issues: "318",
    open_prs: "51"
  },
  model_metrics: {
    total_downloads: "20M+ (Qwen model family)",
    model_size: "480B parameters (35B active MoE)",
    context_window: "256K tokens (extendable to 1M)",
    benchmark_performance: "Competitive with SOTA models",
    supported_languages: "100+ programming languages"
  },
  open_source_benefits: [
    "Complete independence from Western AI providers",
    "Data sovereignty for Chinese and international enterprises",
    "Transparent model architecture and training",
    "Cost-effective alternative to expensive APIs",
    "Massive context window (256K-1M tokens)",
    "Active development by Alibaba's Qwen team",
    "Growing ecosystem with 20M+ downloads"
  ],
  competitive_position: {
    vs_copilot: "Open source, self-hostable, massive context, no subscription",
    vs_gpt4: "Competitive benchmarks, lower cost, data sovereignty",
    vs_claude: "Larger context window potential (1M vs 200K), open source",
    vs_western_tools: "Alternative for data sovereignty and cost control"
  }
};

async function checkExistingTool() {
  const db = getDb();
  const result = await db.select().from(tools).where(eq(tools.slug, QWEN_CODE_SLUG));
  return result.length > 0 ? result[0] : null;
}

async function updateQwenCodeTool() {
  const db = getDb();

  console.log(`\n📝 Updating ${QWEN_CODE_SLUG}...`);
  console.log("=".repeat(80));

  // Check if tool exists
  const existingTool = await checkExistingTool();

  if (!existingTool) {
    console.log(`  ❌ Tool not found: ${QWEN_CODE_SLUG}`);
    return { success: false, message: "Tool not found" };
  }

  console.log(`  ✓ Found tool: ${existingTool.name}`);
  console.log(`  Current category: ${existingTool.category}`);

  // Get existing data
  const existingData = existingTool.data as Record<string, any>;

  console.log(`\n📊 BEFORE UPDATE:`);
  console.log(`  Company: ${existingData.company || 'MISSING'}`);
  console.log(`  Website: ${existingData.website || 'MISSING'}`);
  console.log(`  GitHub: ${existingData.github_url || 'MISSING'}`);
  console.log(`  Overview: ${existingData.overview ? existingData.overview.substring(0, 80) + '...' : 'MISSING'}`);

  // Update the tool data - merge with existing data
  const updatedData = {
    ...existingData,
    ...qwenCodeUpdateData,
    // Keep existing description if it's good
    description: existingData.description || qwenCodeUpdateData.overview.substring(0, 200),
  };

  // Perform the update
  const result = await db
    .update(tools)
    .set({
      data: updatedData,
      updatedAt: new Date(),
    })
    .where(eq(tools.slug, QWEN_CODE_SLUG))
    .returning();

  if (result.length > 0) {
    const updatedTool = result[0];
    const updatedToolData = updatedTool.data as Record<string, any>;

    console.log(`\n📊 AFTER UPDATE:`);
    console.log(`  Company: ${updatedToolData.company}`);
    console.log(`  Website: ${updatedToolData.website}`);
    console.log(`  GitHub: ${updatedToolData.github_url}`);
    console.log(`  License: ${updatedToolData.license}`);
    console.log(`  Overview: ${updatedToolData.overview.substring(0, 100)}...`);
    console.log(`  Features: ${updatedToolData.features.length} features added`);
    console.log(`  Pricing tiers: ${updatedToolData.pricing.tiers.length} tiers configured`);
    console.log(`  GitHub stars: ${updatedToolData.github_metrics.stars}`);
    console.log(`  Model downloads: ${updatedToolData.model_metrics.total_downloads}`);

    console.log(`\n✅ Successfully updated ${QWEN_CODE_SLUG}`);
    return { success: true, data: result[0] };
  } else {
    console.log(`  ❌ Failed to update ${QWEN_CODE_SLUG}`);
    return { success: false, message: "Update failed" };
  }
}

async function main() {
  console.log("🚀 Starting Qwen Code tool content update...\n");
  console.log("=".repeat(80));
  console.log("Tool: Qwen Code");
  console.log("Slug: qwen-code");
  console.log("Category: open-source-framework");
  console.log("Website: https://qwenlm.github.io/blog/qwen3-coder/");
  console.log("GitHub: https://github.com/QwenLM/qwen-code");
  console.log("Stars: 14,700+");
  console.log("License: Apache-2.0");
  console.log("Model: Qwen3-Coder 480B (35B active)");
  console.log("=".repeat(80));

  try {
    const result = await updateQwenCodeTool();

    console.log("\n" + "=".repeat(80));
    if (result.success) {
      console.log("\n✨ Update completed successfully!");
      console.log("\n🎯 Qwen Code tool now has:");
      console.log("  ✅ Company: Alibaba Cloud (Qwen Team)");
      console.log("  ✅ Website: Official Qwen blog");
      console.log("  ✅ GitHub: 14.7k stars, 1.2k forks");
      console.log("  ✅ License: Apache-2.0 (open source)");
      console.log("  ✅ Model: 480B params (35B active MoE)");
      console.log("  ✅ Comprehensive overview (~150 words)");
      console.log("  ✅ 12 key features (agentic, 1M context)");
      console.log("  ✅ 3 pricing tiers (free + Alibaba Cloud)");
      console.log("  ✅ Target audience: enterprise, data sovereignty");
      console.log("  ✅ 10 use cases (Western AI alternative)");
      console.log("  ✅ 10 integrations (Alibaba Cloud, Hugging Face)");
      console.log("  ✅ GitHub + Model metrics (20M downloads)");
      console.log("  ✅ 2025 updates (July launch, competitive)");
      console.log("  ✅ Competitive positioning vs Western tools");
    } else {
      console.log("\n❌ Update failed!");
      console.log(`  Reason: ${result.message}`);
    }
    console.log("\n" + "=".repeat(80));
  } catch (error) {
    console.error("  ❌ Error updating Qwen Code tool:", error);
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
