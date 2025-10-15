#!/usr/bin/env tsx

/**
 * Update 7 AI Coding Tools with Rankings, Scores, and Annual Descriptions
 *
 * This script updates the database records for:
 * 1. OpenAI Codex (autonomous-agent)
 * 2. Greptile (other)
 * 3. Google Gemini CLI (open-source-framework)
 * 4. Graphite (other)
 * 5. Qwen Code (open-source-framework)
 * 6. GitLab Duo (other)
 * 7. Anything Max (autonomous-agent)
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

interface ToolUpdate {
  slug: string;
  expectedCategory: string;
  score: number;
  description: string;
  rank?: number;
}

const toolUpdates: ToolUpdate[] = [
  {
    slug: "openai-codex",
    expectedCategory: "autonomous-agent",
    score: 92,
    description: "OpenAI Codex evolved in 2025 from the AI model powering GitHub Copilot to include GPT-5-Codex for agentic workflows and an autonomous software engineering agent based on GPT-o3, capable of completing entire development tasks independently in isolated cloud environments.",
    rank: 1, // Will be adjusted based on comparison with existing tools
  },
  {
    slug: "greptile",
    expectedCategory: "other",
    score: 90,
    description: "Greptile is a fast-growing AI code review platform that raised $25M in 2025 and catches 3x more bugs than previous versions, serving companies like Brex and PostHog while reviewing over 500M lines of code monthly at a competitive $30 per developer.",
    rank: 2,
  },
  {
    slug: "google-gemini-cli",
    expectedCategory: "open-source-framework",
    score: 88,
    description: "Google Gemini CLI is an open-source command-line tool launched in June 2025 that provides free access to Gemini 2.5 Pro with a 1M token context window, growing to over 1 million developers in three months with an extensible ecosystem from partners like Shopify and Stripe.",
    rank: 3,
  },
  {
    slug: "graphite",
    expectedCategory: "other",
    score: 87,
    description: "Graphite Agent (formerly Diamond) is an AI-powered code review platform backed by Anthropic that delivers codebase-aware feedback with industry-leading 90-second review cycles and sub-3% false-positive rates, serving enterprise clients like Shopify and Snowflake.",
    rank: 4,
  },
  {
    slug: "qwen-code",
    expectedCategory: "open-source-framework",
    score: 86,
    description: "Qwen Code is an open-source large language model series from Alibaba Cloud featuring Qwen3-Coder with 256K+ context windows, support for 100+ programming languages, and models ranging from 0.5B to 235B parameters under Apache 2.0 license for local and enterprise deployment.",
    rank: 5,
  },
  {
    slug: "gitlab-duo",
    expectedCategory: "other",
    score: 84,
    description: "GitLab Duo became part of GitLab's core Premium and Ultimate plans in 2025, offering AI code suggestions, chat, and automated reviews integrated across the entire DevOps lifecycle, with optional Pro ($19/month) and Enterprise tiers for advanced features.",
    rank: 6,
  },
  {
    slug: "anything-max",
    expectedCategory: "autonomous-agent",
    score: 80,
    description: "Anything Max is an autonomous AI software engineer launched in 2025 that tests apps in real environments and fixes bugs autonomously, growing to 700,000 users within weeks as part of the Anything no-code platform backed by $11M in Series A funding.",
    rank: 7,
  },
];

async function checkExistingTool(slug: string) {
  const db = getDb();
  const result = await db.select().from(tools).where(eq(tools.slug, slug));
  return result.length > 0 ? result[0] : null;
}

async function updateTool(update: ToolUpdate) {
  const db = getDb();

  console.log(`\n📝 Updating ${update.slug}...`);

  // Check if tool exists
  const existingTool = await checkExistingTool(update.slug);

  if (!existingTool) {
    console.log(`  ❌ Tool not found: ${update.slug}`);
    return { success: false, message: "Tool not found" };
  }

  console.log(`  ✓ Found tool: ${existingTool.name}`);
  console.log(`  Current category: ${existingTool.category}`);

  // Verify category
  if (existingTool.category !== update.expectedCategory) {
    console.log(`  ⚠️  Category mismatch! Expected: ${update.expectedCategory}, Got: ${existingTool.category}`);
    console.log(`  Updating category to: ${update.expectedCategory}`);
  }

  // Get existing data
  const existingData = existingTool.data as Record<string, any>;

  console.log(`  Current description: ${existingData.description ? existingData.description.substring(0, 100) + '...' : 'None'}`);
  console.log(`  Current score: ${existingData.latest_ranking?.score || 'None'}`);

  // Update the tool data
  const updatedData = {
    ...existingData,
    description: update.description,
    latest_ranking: {
      rank: update.rank,
      score: update.score,
      period: "2025-10",
      change: 0, // Will be calculated when rankings are published
    },
  };

  // Perform the update
  const result = await db
    .update(tools)
    .set({
      category: update.expectedCategory,
      data: updatedData,
      updatedAt: new Date(),
    })
    .where(eq(tools.slug, update.slug))
    .returning();

  if (result.length > 0) {
    console.log(`  ✅ Successfully updated ${update.slug}`);
    console.log(`  New score: ${update.score}`);
    console.log(`  New description: ${update.description.substring(0, 100)}...`);
    return { success: true, data: result[0] };
  } else {
    console.log(`  ❌ Failed to update ${update.slug}`);
    return { success: false, message: "Update failed" };
  }
}

async function main() {
  console.log("🚀 Starting tool updates...\n");
  console.log("=" .repeat(80));

  const results: { slug: string; success: boolean; message?: string }[] = [];

  for (const update of toolUpdates) {
    try {
      const result = await updateTool(update);
      results.push({
        slug: update.slug,
        success: result.success,
        message: result.message,
      });
    } catch (error) {
      console.error(`  ❌ Error updating ${update.slug}:`, error);
      results.push({
        slug: update.slug,
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Summary
  console.log("\n" + "=".repeat(80));
  console.log("\n📊 UPDATE SUMMARY\n");

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`✅ Successfully updated: ${successful.length}/${toolUpdates.length} tools`);
  if (successful.length > 0) {
    successful.forEach(r => console.log(`   - ${r.slug}`));
  }

  if (failed.length > 0) {
    console.log(`\n❌ Failed updates: ${failed.length} tools`);
    failed.forEach(r => console.log(`   - ${r.slug}: ${r.message}`));
  }

  // Display final scores
  console.log("\n📈 FINAL SCORES:");
  console.log("-".repeat(80));
  for (const update of toolUpdates) {
    const result = results.find(r => r.slug === update.slug);
    const status = result?.success ? "✅" : "❌";
    console.log(`${status} ${update.slug.padEnd(25)} Score: ${update.score}/100  Category: ${update.expectedCategory}`);
  }

  console.log("\n" + "=".repeat(80));
  console.log("\n✨ Update process complete!\n");
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
