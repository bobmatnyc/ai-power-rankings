/**
 * Remove Duplicate JetBrains AI Assistant Entry
 *
 * Issue: Two JetBrains entries exist in database:
 * - jetbrains-ai (ID: 22, correct, has content)
 * - jetbrains-ai-assistant (duplicate, empty/minimal content)
 *
 * This script removes the duplicate entry.
 */

import { db } from "@/lib/db";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function removeJetBrainsDuplicate() {
  console.log("🔍 Checking for duplicate JetBrains entries...\n");

  try {
    // First, verify both entries exist
    const jetbrainsAi = await db.select().from(tools).where(eq(tools.slug, 'jetbrains-ai')).limit(1);
    const jetbrainsAssistant = await db.select().from(tools).where(eq(tools.slug, 'jetbrains-ai-assistant')).limit(1);

    console.log("Current state:");
    console.log(`- jetbrains-ai: ${jetbrainsAi.length > 0 ? '✅ EXISTS' : '❌ NOT FOUND'}`);
    if (jetbrainsAi.length > 0) {
      console.log(`  ID: ${jetbrainsAi[0].id}`);
      console.log(`  Name: ${jetbrainsAi[0].name}`);
    }

    console.log(`- jetbrains-ai-assistant: ${jetbrainsAssistant.length > 0 ? '✅ EXISTS (will delete)' : '❌ NOT FOUND'}`);
    if (jetbrainsAssistant.length > 0) {
      console.log(`  ID: ${jetbrainsAssistant[0].id}`);
      console.log(`  Name: ${jetbrainsAssistant[0].name}`);
    }

    if (jetbrainsAssistant.length === 0) {
      console.log("\n✅ No duplicate found - jetbrains-ai-assistant does not exist");
      process.exit(0);
    }

    if (jetbrainsAi.length === 0) {
      console.log("\n⚠️  Warning: jetbrains-ai does not exist, but jetbrains-ai-assistant does");
      console.log("Manual review required - not deleting automatically");
      process.exit(1);
    }

    console.log("\n🗑️  Deleting duplicate jetbrains-ai-assistant entry...");

    // Delete the duplicate entry
    const result = await db.delete(tools)
      .where(eq(tools.slug, 'jetbrains-ai-assistant'))
      .returning();

    if (result.length > 0) {
      console.log("✅ Successfully removed jetbrains-ai-assistant duplicate");
      console.log(`   Deleted ID: ${result[0].id}`);
    } else {
      console.log("⚠️  No rows deleted (entry may have been removed already)");
    }

    console.log("\n✅ Cleanup complete!");
    console.log("✅ Keeping jetbrains-ai (ID: 22) as the primary entry");

    process.exit(0);

  } catch (error) {
    console.error("\n❌ Error during cleanup:", error);
    process.exit(1);
  }
}

removeJetBrainsDuplicate();
