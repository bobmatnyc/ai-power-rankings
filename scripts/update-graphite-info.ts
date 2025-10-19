#!/usr/bin/env tsx

/**
 * Update Graphite Information
 *
 * Adds comprehensive company, logo, pricing, and description information for Graphite
 * (formerly Diamond), the AI code review platform backed by Anthropic.
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function updateGraphite() {
  const db = getDb();
  const slug = "graphite";

  console.log("🔧 Updating Graphite Information\n");
  console.log("=".repeat(80));

  // Get existing tool data
  const result = await db.select().from(tools).where(eq(tools.slug, slug));

  if (result.length === 0) {
    console.log("❌ Graphite tool not found!");
    return { success: false, error: "Tool not found" };
  }

  const existingTool = result[0];
  const existingData = existingTool.data as Record<string, any>;

  console.log("\n📋 Current Data:");
  console.log(`  Name: ${existingTool.name}`);
  console.log(`  Category: ${existingTool.category}`);
  console.log(`  Company: ${existingData.company || 'Not set'}`);
  console.log(`  Logo: ${existingData.logo_url || 'Not set'}`);

  // Prepare updated data
  const updatedData = {
    ...existingData,
    company: "Graphite",
    logo_url: "https://graphite.dev/nextImageExportOptimizer/graphite_logo_neon_sign.924e2912-opt-1080.WEBP",
    website_url: "https://graphite.dev",
    summary: "Graphite Agent (formerly Diamond) is an AI-powered code review platform backed by Anthropic that delivers codebase-aware feedback with industry-leading 90-second review cycles and sub-3% false-positive rates.",
    description: "Graphite is the complete AI code review platform built to keep you unblocked. Built with Claude and backed by Anthropic's $52M Series B investment, Graphite serves enterprise clients like Shopify and Snowflake with 96% positive feedback rates. Features include stacked PRs, AI code review, merge queue, PR inbox, and dev metrics.",
    business: {
      ...(existingData.business || {}),
      pricing_model: "freemium",
      pricing_details: {
        free_trial: "Free for your first 30 days",
        trial_terms: "No credit card required",
        note: "Free for up to 100 PRs per month",
      },
    },
    features: [
      ...(existingData.features || []),
      "Stacked PRs",
      "AI-powered code review",
      "Merge queue management",
      "PR inbox organization",
      "Developer metrics dashboard",
      "GitHub integration",
      "90-second review cycles",
      "Sub-3% false-positive rates",
      "Codebase-aware feedback",
    ].filter((v, i, a) => a.indexOf(v) === i), // Remove duplicates
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

  console.log("\n✅ Updated Data:");
  console.log(`  Company: ${updatedData.company}`);
  console.log(`  Logo: ${updatedData.logo_url}`);
  console.log(`  Website: ${updatedData.website_url}`);
  console.log(`  Pricing Model: ${updatedData.business.pricing_model}`);
  console.log(`  Features Count: ${updatedData.features.length}`);

  console.log("\n" + "=".repeat(80));
  console.log("✅ Graphite information updated successfully!\n");

  return { success: true, data: updateResult[0] };
}

async function main() {
  try {
    await updateGraphite();
  } catch (error) {
    console.error("\n❌ Error updating Graphite:", error);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

main();
