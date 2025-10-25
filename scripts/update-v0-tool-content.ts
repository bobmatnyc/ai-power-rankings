#!/usr/bin/env tsx

/**
 * Update v0 Tool with Comprehensive Content
 *
 * This script updates the v0 tool (slug: v0-vercel) with:
 * - Correct company name (Vercel)
 * - Official website (https://v0.dev)
 * - Comprehensive overview based on 2025 research
 * - Complete metadata including pricing, features, and target audience
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const V0_SLUG = "v0-vercel";

const v0UpdateData = {
  company: "Vercel",
  website: "https://v0.dev",
  overview: "v0 is Vercel's revolutionary AI-powered UI generator that transforms text prompts and images into production-ready React components using Tailwind CSS and shadcn/ui. Launched as a collaborative design assistant, v0 enables rapid prototyping through natural language commands and browser-based code editing, making it ideal for frontend developers, product teams, and agencies building Next.js applications. With support for image/video input providing visual context, the v0 Models API offers up to 512K token context windows for complex designs. As of 2025, v0 has evolved its pricing model with flexible tiers from a free plan (200 credits/month, public generations) to enterprise solutions featuring SAML SSO and priority support, serving thousands of developers who need to build modern interfaces at unprecedented speed.",
  pricing: {
    model: "Freemium with Premium Tiers",
    tiers: [
      {
        name: "Free",
        price: "$0/month",
        credits: "200 credits/month",
        features: [
          "Public generations",
          "React + Tailwind CSS components",
          "shadcn/ui integration",
          "Text and image prompts"
        ]
      },
      {
        name: "Premium/Individual",
        price: "$20/month",
        features: [
          "Private generations",
          "Custom themes",
          "Enhanced generation limits",
          "Priority processing"
        ]
      },
      {
        name: "Team",
        price: "$30/user/month",
        recommended: true,
        features: [
          "$30 monthly credits per user",
          "Centralized billing on Vercel",
          "Shared usage across team",
          "Collaborative chats",
          "API access"
        ]
      },
      {
        name: "Enterprise",
        price: "Custom pricing",
        features: [
          "Training opt-out by default",
          "SAML SSO",
          "Priority access with no queues",
          "Dedicated support",
          "Full API access"
        ]
      }
    ]
  },
  features: [
    "AI-powered UI generation from text prompts",
    "Image and video input for visual context",
    "React + Tailwind CSS + shadcn/ui component generation",
    "Browser-based code editing environment",
    "Iterative design refinement via natural language",
    "v0 Models API with 512K+ token context windows",
    "Collaborative team features",
    "Private and public generation modes",
    "Custom theme support",
    "Next.js and Tailwind CSS optimization"
  ],
  target_audience: "Frontend developers, UI/UX designers, product teams, startups, marketing agencies, and companies using Next.js and Tailwind CSS for rapid prototyping and production interface development",
  use_cases: [
    "Rapid prototyping of user interfaces",
    "Design exploration and iteration",
    "Marketing pages and landing pages",
    "Admin dashboards and internal tools",
    "Component library generation",
    "Design system implementation"
  ],
  integrations: [
    "Next.js",
    "Tailwind CSS",
    "shadcn/ui",
    "Vercel deployment platform",
    "React"
  ],
  launch_year: 2023,
  updated_2025: true
};

async function checkExistingTool() {
  const db = getDb();
  const result = await db.select().from(tools).where(eq(tools.slug, V0_SLUG));
  return result.length > 0 ? result[0] : null;
}

async function updateV0Tool() {
  const db = getDb();

  console.log(`\n📝 Updating ${V0_SLUG}...`);
  console.log("=".repeat(80));

  // Check if tool exists
  const existingTool = await checkExistingTool();

  if (!existingTool) {
    console.log(`  ❌ Tool not found: ${V0_SLUG}`);
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
  console.log(`  Description: ${existingData.description ? existingData.description.substring(0, 80) + '...' : 'MISSING'}`);

  // Update the tool data - merge with existing data
  const updatedData = {
    ...existingData,
    ...v0UpdateData,
    // Keep existing description if it's good
    description: existingData.description || v0UpdateData.overview.substring(0, 200),
  };

  // Perform the update
  const result = await db
    .update(tools)
    .set({
      data: updatedData,
      updatedAt: new Date(),
    })
    .where(eq(tools.slug, V0_SLUG))
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

    console.log(`\n✅ Successfully updated ${V0_SLUG}`);
    return { success: true, data: result[0] };
  } else {
    console.log(`  ❌ Failed to update ${V0_SLUG}`);
    return { success: false, message: "Update failed" };
  }
}

async function main() {
  console.log("🚀 Starting v0 tool content update...\n");
  console.log("=" .repeat(80));
  console.log("Tool: v0 by Vercel");
  console.log("Slug: v0-vercel");
  console.log("Category: app-builder");
  console.log("Website: https://v0.dev");
  console.log("=".repeat(80));

  try {
    const result = await updateV0Tool();

    console.log("\n" + "=".repeat(80));
    if (result.success) {
      console.log("\n✨ Update completed successfully!");
      console.log("\n🎯 v0 tool now has:");
      console.log("  ✅ Company: Vercel");
      console.log("  ✅ Website: https://v0.dev");
      console.log("  ✅ Comprehensive overview (~150 words)");
      console.log("  ✅ 10 key features");
      console.log("  ✅ 4 pricing tiers (Free, Premium, Team, Enterprise)");
      console.log("  ✅ Target audience defined");
      console.log("  ✅ Use cases listed");
      console.log("  ✅ Integrations documented");
    } else {
      console.log("\n❌ Update failed!");
      console.log(`  Reason: ${result.message}`);
    }
    console.log("\n" + "=".repeat(80));
  } catch (error) {
    console.error("  ❌ Error updating v0 tool:", error);
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
