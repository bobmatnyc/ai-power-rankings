#!/usr/bin/env tsx

/**
 * Update Anything Max Information
 *
 * Adds logo URL and ensures company field is at root level.
 * The tool already has comprehensive pricing, features, and description information.
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function updateAnythingMax() {
  const db = getDb();
  const slug = "anything-max";

  console.log("🔧 Updating Anything Max Information\n");
  console.log("=".repeat(80));

  // Get existing tool data
  const result = await db.select().from(tools).where(eq(tools.slug, slug));

  if (result.length === 0) {
    console.log("❌ Anything Max tool not found!");
    return { success: false, error: "Tool not found" };
  }

  const existingTool = result[0];
  const existingData = existingTool.data as Record<string, any>;

  console.log("\n📋 Current Data:");
  console.log(`  Name: ${existingTool.name}`);
  console.log(`  Category: ${existingTool.category}`);
  console.log(`  Company: ${existingData.company || 'Not set'}`);
  console.log(`  Logo: ${existingData.logo_url || 'Not set'}`);
  console.log(`  Website: ${existingData.website_url}`);
  console.log(`  Pricing Model: ${existingData.pricing_model}`);

  // Prepare updated data
  const updatedData = {
    ...existingData,
    // Add logo URL
    logo_url: "https://www.createanything.com/images/homepage-v2/Anything_Logo_White.svg",
    // Ensure company at root level (already exists in info.business.company)
    company: existingData.info?.business?.company || "Anything",
    // Ensure all key fields are present
    summary: existingData.tagline || existingData.info?.product?.tagline,
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
  console.log(`  Pricing Model: ${updatedData.pricing_model}`);
  console.log(`  Summary: ${updatedData.summary}`);
  console.log(`  Features Count: ${updatedData.info?.features?.length || 0}`);

  console.log("\n" + "=".repeat(80));
  console.log("✅ Anything Max information updated successfully!\n");

  return { success: true, data: updateResult[0] };
}

async function main() {
  try {
    await updateAnythingMax();
  } catch (error) {
    console.error("\n❌ Error updating Anything Max:", error);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

main();
