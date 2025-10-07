#!/usr/bin/env tsx
/**
 * Update Anything Max Tool Information
 * Updates comprehensive information about Anything Max including category,
 * description, pricing, and detailed product information.
 */

import { getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const TOOL_SLUG = "anything-max";

/**
 * Tool data to update
 */
const toolUpdates = {
  category: "autonomous-agent",
  tagline: "Autonomous AI engineer that tests, debugs, and ships code",
  description:
    "Anything Max is an autonomous AI software engineer that independently tests, debugs, and builds features for your applications. Unlike traditional coding assistants, Max operates like a human engineer - it runs your app in a full browser, interacts with it through clicking, typing, and scrolling, identifies bugs, writes code and tests, and keeps working until the task is complete. During beta testing, Max solved 97%+ of the most complex engineering problems autonomously.",
  website_url: "https://www.createanything.com",
  pricing_model: "subscription",
  data: {
    info: {
      product: {
        description:
          "Autonomous AI software engineer that tests, debugs, and ships features",
        tagline: "Autonomous AI engineer that tests, debugs, and ships code",
        product_url: "https://www.createanything.com/blog/anything-max",
      },
      features: [
        "Visual browser automation - runs apps in full browser",
        "Autonomous bug detection and fixing with 97%+ success rate",
        "End-to-end feature development",
        "Parallel agent deployment",
        "Long-running autonomous operation (100+ steps, 30+ minutes)",
        "Comprehensive automated testing",
        "Real-time interaction (clicking, typing, scrolling)",
      ],
      pricing: {
        model: "subscription",
        pricing_model: "subscription",
        plans: [
          {
            name: "Free",
            price: 0,
            credits: "3k one-time",
          },
          {
            name: "Pro 20k",
            price: 16,
            credits: "20k/month",
          },
          {
            name: "Pro 50k",
            price: 40,
            credits: "50k-55k/month",
          },
          {
            name: "Pro 200k (Max included)",
            price: 160,
            credits: "200k-220k/month",
            includes_max: true,
          },
        ],
        max_standalone: 199,
        currency: "USD",
      },
      business: {
        company: "Anything",
        founded: "2024",
        funding: "$11M Series A",
        valuation: "$100M",
        revenue: "$2M ARR (first two weeks)",
        founders: ["Dhruv Amin", "Marcus Lowe"],
        team_background: "Ex-Google engineers",
      },
      links: {
        website: "https://www.createanything.com",
        product: "https://www.createanything.com/blog/anything-max",
        pricing: "https://www.createanything.com/pricing",
      },
      technical: {
        operation_mode: "autonomous",
        max_steps: "100+",
        max_runtime: "30+ minutes",
        success_rate: "97%+",
        capabilities: [
          "Browser automation",
          "Bug detection",
          "Code writing",
          "Testing",
          "Feature development",
        ],
      },
      metadata: {
        launch_date: "2025",
        status: "active",
        market_position: "Autonomous AI engineer",
        competitors: ["Devin AI", "Factory.ai", "Cursor AI"],
      },
    },
  },
};

async function updateAnythingMax() {
  console.log("🔄 Starting Anything Max update...\n");

  try {
    const db = getDb();
    if (!db) {
      throw new Error("❌ Database connection not available");
    }

    // Find existing tool
    console.log(`🔍 Looking for tool with slug: ${TOOL_SLUG}`);
    const existingTool = await db
      .select()
      .from(tools)
      .where(eq(tools.slug, TOOL_SLUG))
      .limit(1);

    if (existingTool.length === 0) {
      console.error(`❌ Tool not found: ${TOOL_SLUG}`);
      console.log("\n💡 Available tools:");
      const allTools = await db
        .select({ slug: tools.slug, name: tools.name })
        .from(tools)
        .limit(20);
      allTools.forEach((t) => console.log(`   - ${t.slug} (${t.name})`));
      process.exit(1);
    }

    const tool = existingTool[0];
    console.log(`✅ Found tool: ${tool.name}`);
    console.log(`   Current category: ${tool.category}`);
    console.log(`   Current pricing model: ${(tool.data as any)?.info?.pricing?.pricing_model || "none"}`);

    // Display before state
    console.log("\n📊 BEFORE UPDATE:");
    console.log(`   Category: ${tool.category}`);
    console.log(`   Tagline: ${(tool.data as any)?.tagline || "none"}`);
    console.log(`   Website: ${(tool.data as any)?.website_url || "none"}`);
    console.log(`   Description length: ${(tool.data as any)?.description?.length || 0} chars`);

    // Update tool
    console.log("\n🔧 Applying updates...");
    await db
      .update(tools)
      .set({
        category: toolUpdates.category,
        data: {
          ...(tool.data as object),
          tagline: toolUpdates.tagline,
          description: toolUpdates.description,
          website_url: toolUpdates.website_url,
          pricing_model: toolUpdates.pricing_model,
          info: toolUpdates.data.info,
        },
        updatedAt: new Date(),
      })
      .where(eq(tools.slug, TOOL_SLUG));

    console.log("✅ Database updated successfully");

    // Verify the update
    console.log("\n🔍 Verifying update...");
    const updatedTool = await db
      .select()
      .from(tools)
      .where(eq(tools.slug, TOOL_SLUG))
      .limit(1);

    if (updatedTool.length > 0) {
      const verified = updatedTool[0];
      console.log("\n📊 AFTER UPDATE:");
      console.log(`   Category: ${verified.category}`);
      console.log(`   Tagline: ${(verified.data as any)?.tagline || "none"}`);
      console.log(`   Website: ${(verified.data as any)?.website_url || "none"}`);
      console.log(`   Description length: ${(verified.data as any)?.description?.length || 0} chars`);
      console.log(`   Pricing model: ${(verified.data as any)?.info?.pricing?.pricing_model || "none"}`);
      console.log(`   Features count: ${(verified.data as any)?.info?.features?.length || 0}`);
      console.log(`   Pricing plans: ${(verified.data as any)?.info?.pricing?.plans?.length || 0}`);
    }

    console.log("\n✨ Anything Max update complete!");
    console.log("\n📝 Summary of changes:");
    console.log(`   ✓ Category changed to: ${toolUpdates.category}`);
    console.log(`   ✓ Added comprehensive description (${toolUpdates.description.length} chars)`);
    console.log(`   ✓ Added tagline`);
    console.log(`   ✓ Added website URL`);
    console.log(`   ✓ Set pricing model to: ${toolUpdates.pricing_model}`);
    console.log(`   ✓ Added ${toolUpdates.data.info.features.length} features`);
    console.log(`   ✓ Added ${toolUpdates.data.info.pricing.plans.length} pricing plans`);
    console.log(`   ✓ Added business information (funding, revenue, etc.)`);
    console.log(`   ✓ Added technical specifications`);

    console.log("\n🧪 To verify the update, run:");
    console.log(
      `   curl -s http://localhost:3000/api/tools/${TOOL_SLUG}/json | jq '.tool | {name, category, tagline, description, website_url, pricing_model}'`
    );

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error updating Anything Max:", error);
    process.exit(1);
  }
}

// Run the update
updateAnythingMax();
