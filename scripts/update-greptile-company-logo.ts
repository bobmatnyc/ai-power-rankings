#!/usr/bin/env tsx

/**
 * Update Greptile with Company Name and Logo
 *
 * This script adds:
 * - Company name: Greptile
 * - Logo URL: https://www.greptile.com/logo.svg
 * - Website: https://www.greptile.com
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function updateGreptile() {
  const db = getDb();
  const slug = "greptile";

  console.log(`\n📝 Updating ${slug}...`);

  // Check if tool exists
  const result = await db.select().from(tools).where(eq(tools.slug, slug));

  if (result.length === 0) {
    console.log(`  ❌ Tool not found: ${slug}`);
    return { success: false, message: "Tool not found" };
  }

  const existingTool = result[0];
  console.log(`  ✓ Found tool: ${existingTool.name}`);

  // Get existing data
  const existingData = existingTool.data as Record<string, any>;

  console.log(`  Current company: ${existingData.company || 'None'}`);
  console.log(`  Current logo: ${existingData.logo_url || 'None'}`);

  // Update the tool data with company and logo
  const updatedData = {
    ...existingData,
    company: "Greptile",
    logo_url: "https://www.greptile.com/logo.svg",
    website_url: "https://www.greptile.com",
  };

  // Perform the update
  const updateResult = await db
    .update(tools)
    .set({
      data: updatedData,
      updatedAt: new Date(),
    })
    .where(eq(tools.slug, slug))
    .returning();

  if (updateResult.length > 0) {
    console.log(`  ✅ Successfully updated ${slug}`);
    console.log(`  New company: Greptile`);
    console.log(`  New logo: https://www.greptile.com/logo.svg`);
    return { success: true, data: updateResult[0] };
  } else {
    console.log(`  ❌ Failed to update ${slug}`);
    return { success: false, message: "Update failed" };
  }
}

async function main() {
  console.log("🚀 Updating Greptile company and logo...\n");
  console.log("=".repeat(80));

  try {
    const result = await updateGreptile();

    console.log("\n" + "=".repeat(80));
    if (result.success) {
      console.log("✅ Update completed successfully!");
    } else {
      console.log(`❌ Update failed: ${result.message}`);
      process.exit(1);
    }
  } catch (error) {
    console.error("\n❌ Error during update:", error);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

main();
