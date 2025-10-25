#!/usr/bin/env tsx

/**
 * Update Pieces for Developers Tool with Comprehensive Enterprise Content
 *
 * This script updates the Pieces for Developers tool with:
 * - Complete 2025 pricing information (Free and Teams/Enterprise tiers)
 * - Comprehensive on-device AI and personal knowledge management features
 * - Enterprise collaboration and LLM flexibility capabilities
 * - Complete metadata including target audience and use cases
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const PIECES_SLUG = "pieces-for-developers";

const piecesUpdateData = {
  company: "Pieces for Developers Inc.",
  website: "https://pieces.app/",
  overview: "Pieces for Developers is an innovative on-device AI development assistant and personal knowledge management platform that revolutionizes how developers capture, enrich, reuse, and share coding materials throughout their entire workflow. Unlike cloud-dependent AI tools, Pieces processes all data locally on your device, ensuring complete privacy and security while delivering powerful AI-driven productivity features. The platform seamlessly integrates across browsers (Chrome, Edge, Firefox, Brave), IDEs (VS Code, JetBrains), Obsidian for note-taking, and Microsoft Teams for collaboration, creating a unified developer toolchain. With 9 months of personal context retention on the free plan and unlimited shared team context on enterprise plans, Pieces learns from your patterns and activities to provide increasingly intelligent assistance. The enterprise offering supports custom or third-party LLMs, priority phone and email support, and advanced collaboration features designed for development teams. By consolidating coding snippets, notes, screenshots, and ideas into a single intelligent platform with local processing, Pieces delivers unparalleled productivity gains while maintaining the highest standards of data privacy and security.",
  pricing: {
    model: "Freemium with Enterprise custom pricing",
    tiers: [
      {
        name: "Individual (Free Forever)",
        price: "$0/month",
        features: [
          "9 months of personal context retention",
          "Copilot-style code assistance",
          "On-device AI processing for complete privacy",
          "Desktop app for macOS, Windows, Linux",
          "Browser extensions (Chrome, Edge, Firefox, Brave)",
          "VS Code extension",
          "JetBrains IDE plugin",
          "Obsidian plugin integration",
          "Email support",
          "Unlimited code snippet storage with AI enrichment"
        ]
      },
      {
        name: "Teams/Enterprise",
        price: "Contact for pricing",
        contact: "rosie@pieces.app",
        features: [
          "Everything in Individual plan",
          "Shared team context for collaboration",
          "Support for custom or third-party LLMs",
          "Priority support via phone and email",
          "Designed for team collaboration",
          "Enterprise user management",
          "Advanced analytics and insights",
          "Dedicated customer success",
          "Custom integration support",
          "SLA guarantees"
        ],
        recommended: true,
        note: "Custom pricing based on team size and requirements"
      }
    ]
  },
  features: [
    "On-device AI processing for complete data privacy",
    "Personal knowledge management for developers",
    "AI-enriched code snippet capture and storage",
    "Contextual code assistance with workflow understanding",
    "9 months personal context retention (free plan)",
    "Shared team context for collaboration (enterprise)",
    "Browser integration (Chrome, Edge, Firefox, Brave)",
    "VS Code extension for IDE integration",
    "JetBrains IDE plugin (IntelliJ, PyCharm, WebStorm, etc.)",
    "Obsidian plugin for developer note-taking",
    "Microsoft Teams integration for team collaboration",
    "Custom LLM support for enterprise flexibility",
    "Pattern learning from developer activities",
    "Unified platform for code, notes, screenshots, and ideas",
    "Local storage with cloud sync options"
  ],
  target_audience: "Individual developers seeking personal productivity tools, development teams requiring shared knowledge management, privacy-conscious developers, polyglot programmers working across multiple languages and frameworks, technical writers and documentation teams, developer advocates and educators, and enterprises needing customizable AI solutions",
  use_cases: [
    "Personal code snippet library with AI enrichment",
    "Developer onboarding with shared team knowledge",
    "Cross-project code reuse and knowledge transfer",
    "Technical documentation and note-taking",
    "Learning new languages and frameworks with captured examples",
    "Debugging with historical context and solutions",
    "Team collaboration on coding patterns and standards",
    "Privacy-focused development with on-device AI",
    "Custom LLM integration for specialized domains",
    "Developer productivity tracking and insights"
  ],
  integrations: [
    "Visual Studio Code",
    "JetBrains IDEs (IntelliJ IDEA, PyCharm, WebStorm, GoLand, PhpStorm)",
    "Chrome browser extension",
    "Microsoft Edge extension",
    "Firefox extension",
    "Brave browser extension",
    "Obsidian note-taking app",
    "Microsoft Teams",
    "macOS, Windows, Linux desktop apps",
    "Custom LLM providers (Enterprise)"
  ],
  launch_year: 2021,
  updated_2025: true,
  recent_updates_2025: [
    "Enhanced on-device AI capabilities for better privacy",
    "Improved team collaboration features",
    "Expanded custom LLM support for enterprise customers",
    "Added priority support options for teams",
    "Enhanced browser extension compatibility",
    "Improved context retention and learning algorithms",
    "Added advanced analytics for team usage",
    "Expanded JetBrains IDE support"
  ],
  enterprise_features: {
    privacy_security: [
      "On-device AI processing - no cloud data transmission",
      "Local storage of all development materials",
      "Complete data privacy and ownership",
      "No training on customer data",
      "Secure team collaboration protocols",
      "Custom deployment options"
    ],
    collaboration: [
      "Shared team context for knowledge transfer",
      "Team snippet libraries and best practices",
      "Collaborative coding pattern documentation",
      "Cross-team knowledge sharing",
      "Version history and change tracking",
      "Team analytics and insights"
    ],
    customization: [
      "Support for custom LLM providers",
      "Third-party LLM integration",
      "Flexible context retention policies",
      "Custom workflow integrations",
      "Tailored AI assistance rules",
      "Organization-specific pattern learning"
    ],
    administration: [
      "Team user management",
      "Usage analytics and reporting",
      "Priority email and phone support",
      "Dedicated customer success manager",
      "Custom onboarding and training",
      "SLA guarantees for enterprise customers"
    ]
  },
  unique_features: [
    "On-device AI processing for maximum privacy (vs. cloud-only competitors)",
    "Personal knowledge management focus beyond just code completion",
    "9-month free context retention (longer than most competitors)",
    "Cross-platform unification (browser, IDE, notes, collaboration)",
    "Obsidian integration for developer note-taking workflows",
    "Microsoft Teams integration for enterprise collaboration",
    "Pattern learning from individual developer workflows"
  ],
  privacy_commitment: "Pieces for Developers prioritizes privacy by processing all AI operations on-device. Your code, notes, and development materials never leave your machine unless you explicitly choose to share with team members. This architecture ensures complete data sovereignty while delivering powerful AI-driven productivity features."
};

async function checkExistingTool() {
  const db = getDb();
  const result = await db.select().from(tools).where(eq(tools.slug, PIECES_SLUG));
  return result.length > 0 ? result[0] : null;
}

async function updatePiecesTool() {
  const db = getDb();

  console.log(`\n📝 Updating ${PIECES_SLUG}...`);
  console.log("=".repeat(80));

  // Check if tool exists
  const existingTool = await checkExistingTool();

  if (!existingTool) {
    console.log(`  ❌ Tool not found: ${PIECES_SLUG}`);
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
    ...piecesUpdateData,
    // Keep existing description if it's good
    description: existingData.description || piecesUpdateData.overview.substring(0, 200),
  };

  // Perform the update
  const result = await db
    .update(tools)
    .set({
      data: updatedData,
      updatedAt: new Date(),
    })
    .where(eq(tools.slug, PIECES_SLUG))
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
    console.log(`  Unique features: ${updatedToolData.unique_features.length} listed`);

    console.log(`\n✅ Successfully updated ${PIECES_SLUG}`);
    return { success: true, data: result[0] };
  } else {
    console.log(`  ❌ Failed to update ${PIECES_SLUG}`);
    return { success: false, message: "Update failed" };
  }
}

async function main() {
  console.log("🚀 Starting Pieces for Developers tool content update...\n");
  console.log("=".repeat(80));
  console.log("Tool: Pieces for Developers");
  console.log("Slug: pieces-for-developers");
  console.log("Category: On-Device AI Developer Productivity");
  console.log("Website: https://pieces.app/");
  console.log("=".repeat(80));

  try {
    const result = await updatePiecesTool();

    console.log("\n" + "=".repeat(80));
    if (result.success) {
      console.log("\n✨ Update completed successfully!");
      console.log("\n🎯 Pieces for Developers tool now has:");
      console.log("  ✅ Company: Pieces for Developers Inc.");
      console.log("  ✅ Website: https://pieces.app/");
      console.log("  ✅ Comprehensive overview (~150 words)");
      console.log("  ✅ 15 key features");
      console.log("  ✅ 2 pricing tiers (Free, Teams/Enterprise)");
      console.log("  ✅ Enterprise features detailed (4 categories)");
      console.log("  ✅ Unique features (7 listed)");
      console.log("  ✅ Privacy commitment statement");
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
    console.error("  ❌ Error updating Pieces for Developers tool:", error);
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
