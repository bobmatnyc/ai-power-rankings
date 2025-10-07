#!/usr/bin/env node

/**
 * Delete invalid and miscategorized tools from the database
 *
 * This script removes:
 * - Non-AI tools (GitLab, Jira, Docker, VS Code, Visual Studio, Stack Overflow, YouTube)
 * - General LLM references (gpt-models, claude-sonnet-models, gemini-flash-models)
 *
 * IMPORTANT: Run this script with caution. It will permanently delete tools.
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";
import * as readline from 'readline';

const TOOLS_TO_DELETE = [
  // Non-AI tools
  'gitlab',                // Version control (GitLab Duo is separate)
  'jira',                  // Project management
  'docker',                // Container platform
  'visual-studio-code',    // Code editor (not AI)
  'visual-studio',         // IDE (not AI)
  'stack-overflow',        // Q&A platform
  'youtube',               // Video platform

  // General LLM references (not coding-specific)
  'gpt-models',            // Use ChatGPT, GPT-4, etc. instead
  'claude-sonnet-models',  // Use Claude, Claude Code, etc. instead
  'gemini-flash-models',   // Use Gemini, etc. instead
];

function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

async function deleteInvalidTools(dryRun = true) {
  try {
    console.log("🗑️  Delete Invalid Tools Script");
    console.log("=" .repeat(80) + "\n");

    const db = getDb();
    if (!db) {
      throw new Error("Failed to get database connection");
    }

    // First, check which tools exist
    console.log("1. Checking which tools exist in database...\n");

    const existingTools = await db.select().from(tools).where(
      inArray(tools.slug, TOOLS_TO_DELETE)
    );

    console.log(`Tools marked for deletion: ${TOOLS_TO_DELETE.length}`);
    console.log(`Tools found in database: ${existingTools.length}\n`);

    if (existingTools.length === 0) {
      console.log("✅ No tools to delete!");
      return;
    }

    console.log("Tools to be deleted:\n");
    for (const tool of existingTools) {
      console.log(`  - ${tool.name} (${tool.slug})`);
      console.log(`    Category: ${tool.category}`);
    }

    console.log("\n" + "=" .repeat(80) + "\n");

    if (dryRun) {
      console.log("🔍 DRY RUN MODE - No changes will be made");
      console.log("\nTo actually delete these tools, run:");
      console.log("  npx tsx scripts/delete-invalid-tools.ts --execute\n");
      return;
    }

    // Ask for confirmation
    console.log("⚠️  WARNING: This will permanently delete these tools!");
    console.log("Make sure you have a database backup before proceeding.\n");

    const confirmed = await askConfirmation("Are you sure you want to delete these tools? (yes/no): ");

    if (!confirmed) {
      console.log("\n❌ Deletion cancelled.");
      return;
    }

    console.log("\n🗑️  Deleting tools...\n");

    // Perform deletion
    const deleted = await db.delete(tools).where(
      inArray(tools.slug, TOOLS_TO_DELETE)
    ).returning();

    console.log(`✅ Successfully deleted ${deleted.length} tools:\n`);

    for (const tool of deleted) {
      console.log(`  ✓ ${tool.name} (${tool.slug})`);
    }

    console.log("\n✅ Deletion complete!");

    // Verify deletion
    console.log("\nVerifying deletion...");
    const remaining = await db.select().from(tools).where(
      inArray(tools.slug, TOOLS_TO_DELETE)
    );

    if (remaining.length === 0) {
      console.log("✅ All tools successfully deleted!");
    } else {
      console.log(`⚠️  Warning: ${remaining.length} tools still remain:`);
      remaining.forEach(t => console.log(`  - ${t.name} (${t.slug})`));
    }

  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const execute = args.includes('--execute') || args.includes('-e');

if (require.main === module) {
  deleteInvalidTools(!execute)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { deleteInvalidTools };
