#!/usr/bin/env tsx

/**
 * Update Continue Tool with Comprehensive Open Source Content
 *
 * This script updates the Continue tool with:
 * - Complete 2025 GitHub metrics (29.5k stars, Apache 2.0)
 * - VS Code and JetBrains IDE integration
 * - Model-agnostic architecture for maximum flexibility
 * - Custom AI agent and chat capabilities
 * - Self-hosted privacy and control
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const CONTINUE_SLUG = "continue";

const continueUpdateData = {
  company: "Continue Dev Inc. (Open Source Community)",
  website: "https://www.continue.dev",
  github_url: "https://github.com/continuedev/continue",
  license: "Apache-2.0",
  overview: "Continue is the leading open-source AI code assistant for VS Code and JetBrains IDEs, with 29,500+ GitHub stars and 419 contributors building the most flexible Copilot alternative. Founded to give developers full control over their AI coding experience, Continue allows users to choose any LLM (OpenAI, Anthropic Claude, local models via Ollama) without vendor lock-in. The platform offers intelligent autocomplete with streaming diff previews, an integrated AI chat interface within your IDE, and the ability to build custom agents that leverage your codebase, documentation, and team knowledge. With its latest v1.5.7 release (October 2025), Continue delivers context-aware code completion, highlight-and-edit functionality, and extensible architecture that developers can customize to their exact needs. Completely free and self-hostable, Continue empowers developers and organizations to maintain privacy, transparency, and control while enjoying enterprise-grade AI coding assistance comparable to proprietary solutions.",
  pricing: {
    model: "Free Open Source (Self-Hosted or Cloud)",
    tiers: [
      {
        name: "Open Source (Free)",
        price: "$0 (Apache 2.0 License)",
        features: [
          "Full source code access on GitHub",
          "Unlimited usage and customization",
          "Self-hosted deployment option",
          "All features included",
          "Community support via GitHub and Discord",
          "No subscription fees ever"
        ],
        recommended: true
      },
      {
        name: "Self-Hosted with LLM APIs",
        price: "Pay only for LLM API usage",
        features: [
          "Use your own OpenAI API keys",
          "Connect to Anthropic Claude",
          "Google Gemini integration",
          "Azure OpenAI support",
          "Control your data and privacy",
          "No Continue.dev fees"
        ]
      },
      {
        name: "Local Models (Free)",
        price: "$0 (No API costs)",
        features: [
          "Run completely offline with Ollama",
          "Use Code Llama, Mistral, or other local models",
          "Zero cloud dependencies",
          "Complete data privacy",
          "Ideal for sensitive codebases",
          "No ongoing costs"
        ]
      }
    ]
  },
  features: [
    "IDE-native integration for VS Code and JetBrains (IntelliJ, PyCharm, WebStorm)",
    "Model-agnostic: choose any LLM (GPT-4, Claude, Gemini, local models)",
    "Intelligent code autocomplete with streaming diff previews",
    "Integrated AI chat interface within your IDE",
    "Tab completion with inline suggestions",
    "Highlight-and-edit: select code and transform with AI",
    "Custom agent builder for team-specific workflows",
    "Context-aware suggestions using codebase knowledge",
    "Self-hosted deployment for complete privacy",
    "Extensible architecture with plugin system",
    "Multi-model support: switch between providers seamlessly",
    "Free and open source with no vendor lock-in"
  ],
  target_audience: "Professional developers using VS Code or JetBrains IDEs, engineering teams requiring privacy and customization, open source contributors, organizations avoiding vendor lock-in, developers seeking cost-effective AI coding tools, and teams building custom AI development workflows",
  use_cases: [
    "GitHub Copilot alternative with full customization",
    "Self-hosted AI coding for enterprise privacy",
    "Custom AI agent development for team workflows",
    "Multi-model experimentation (GPT-4, Claude, local)",
    "Cost-effective coding assistance with local models",
    "Context-aware code completion in VS Code/JetBrains",
    "Building proprietary AI coding tools on open foundation",
    "Privacy-compliant development in regulated industries",
    "Open source project contributions with AI assistance",
    "Teaching and learning with transparent AI tools"
  ],
  integrations: [
    "Visual Studio Code (official extension)",
    "JetBrains IDEs (IntelliJ, PyCharm, WebStorm, etc.)",
    "OpenAI API (GPT-4, GPT-4 Turbo)",
    "Anthropic Claude API",
    "Google Gemini API",
    "Azure OpenAI Service",
    "Ollama (local LLM hosting)",
    "Code Llama and Mistral models",
    "GitHub for version control",
    "Custom model endpoints via API"
  ],
  launch_year: 2023,
  updated_2025: true,
  recent_updates_2025: [
    "Released v1.5.7 (October 24, 2025) with latest features",
    "Reached 29,500+ GitHub stars (fastest-growing Copilot alternative)",
    "Grew to 419 contributors from global developer community",
    "Added custom agent builder for team workflows",
    "Enhanced context-aware code completion",
    "Improved streaming diff preview performance",
    "Expanded IDE support with JetBrains enhancements"
  ],
  github_metrics: {
    stars: "29,500+",
    forks: "3,700+",
    contributors: "419",
    commits: "5,000+",
    license: "Apache-2.0",
    primary_languages: "TypeScript (83.1%), JavaScript (8.1%), Kotlin (4.1%)",
    latest_release: "v1.5.7 (Oct 24, 2025)"
  },
  open_source_benefits: [
    "No vendor lock-in: switch LLM providers freely",
    "Full transparency: audit all code and data flows",
    "Community-driven innovation with 419 contributors",
    "Self-hosted for maximum privacy and compliance",
    "Extensible: build custom features and agents",
    "Cost control: use free local models or manage API spend",
    "Active community support via GitHub and Discord"
  ],
  comparison: {
    vs_copilot: "Continue offers model flexibility (not locked to OpenAI), self-hosting, and zero subscription fees vs Copilot's $10-20/month",
    vs_cursor: "Continue works in your existing IDE vs Cursor's custom editor, with full open source transparency",
    vs_proprietary: "Complete control, no data sent to vendors, customizable to team needs, and free forever"
  }
};

async function checkExistingTool() {
  const db = getDb();
  const result = await db.select().from(tools).where(eq(tools.slug, CONTINUE_SLUG));
  return result.length > 0 ? result[0] : null;
}

async function updateContinueTool() {
  const db = getDb();

  console.log(`\n📝 Updating ${CONTINUE_SLUG}...`);
  console.log("=".repeat(80));

  // Check if tool exists
  const existingTool = await checkExistingTool();

  if (!existingTool) {
    console.log(`  ❌ Tool not found: ${CONTINUE_SLUG}`);
    console.log(`  ℹ️  This tool needs to be added to the database first`);
    return { success: false, message: "Tool not found - needs to be created" };
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
    ...continueUpdateData,
    // Keep existing description if it's good
    description: existingData.description || continueUpdateData.overview.substring(0, 200),
  };

  // Perform the update
  const result = await db
    .update(tools)
    .set({
      data: updatedData,
      updatedAt: new Date(),
    })
    .where(eq(tools.slug, CONTINUE_SLUG))
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
    console.log(`  Target audience: ${updatedToolData.target_audience.substring(0, 80)}...`);

    console.log(`\n✅ Successfully updated ${CONTINUE_SLUG}`);
    return { success: true, data: result[0] };
  } else {
    console.log(`  ❌ Failed to update ${CONTINUE_SLUG}`);
    return { success: false, message: "Update failed" };
  }
}

async function main() {
  console.log("🚀 Starting Continue tool content update...\n");
  console.log("=".repeat(80));
  console.log("Tool: Continue");
  console.log("Slug: continue");
  console.log("Category: open-source-framework");
  console.log("Website: https://www.continue.dev");
  console.log("GitHub: https://github.com/continuedev/continue");
  console.log("Stars: 29,500+");
  console.log("License: Apache-2.0");
  console.log("=".repeat(80));

  try {
    const result = await updateContinueTool();

    console.log("\n" + "=".repeat(80));
    if (result.success) {
      console.log("\n✨ Update completed successfully!");
      console.log("\n🎯 Continue tool now has:");
      console.log("  ✅ Company: Continue Dev Inc. (Open Source)");
      console.log("  ✅ Website: https://www.continue.dev");
      console.log("  ✅ GitHub: 29.5k stars, 419 contributors");
      console.log("  ✅ License: Apache-2.0 (open source)");
      console.log("  ✅ Comprehensive overview (~150 words)");
      console.log("  ✅ 12 key features (IDE-native, model-agnostic)");
      console.log("  ✅ 3 pricing tiers (free + self-hosted options)");
      console.log("  ✅ Target audience: VS Code/JetBrains developers");
      console.log("  ✅ 10 use cases (Copilot alternative, privacy)");
      console.log("  ✅ 10 integrations (VS Code, JetBrains, LLMs)");
      console.log("  ✅ GitHub metrics (stars, forks, contributors)");
      console.log("  ✅ 2025 updates (v1.5.7, custom agents)");
      console.log("  ✅ Open source benefits highlighted");
      console.log("  ✅ Comparison with proprietary tools");
    } else {
      console.log("\n❌ Update failed!");
      console.log(`  Reason: ${result.message}`);
      if (result.message.includes("not found")) {
        console.log("\n📋 Next steps:");
        console.log("  1. Add Continue to database first");
        console.log("  2. Then run this update script");
      }
    }
    console.log("\n" + "=".repeat(80));
  } catch (error) {
    console.error("  ❌ Error updating Continue tool:", error);
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
