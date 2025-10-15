#!/usr/bin/env tsx

/**
 * Verify the updates to the 7 AI coding tools
 * Display complete information including scores, descriptions, and categories
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const toolSlugs = [
  "openai-codex",
  "greptile",
  "google-gemini-cli",
  "graphite",
  "qwen-code",
  "gitlab-duo",
  "anything-max",
];

async function verifyTool(slug: string) {
  const db = getDb();
  const result = await db.select().from(tools).where(eq(tools.slug, slug));

  if (result.length === 0) {
    return null;
  }

  const tool = result[0];
  const data = tool.data as Record<string, any>;

  return {
    id: tool.id,
    slug: tool.slug,
    name: tool.name,
    category: tool.category,
    description: data.description || "No description",
    score: data.latest_ranking?.score || "No score",
    rank: data.latest_ranking?.rank || "No rank",
    period: data.latest_ranking?.period || "No period",
    updatedAt: tool.updatedAt,
  };
}

async function main() {
  console.log("\n🔍 VERIFICATION REPORT: 7 AI Coding Tools\n");
  console.log("=".repeat(100));

  const tools = [];

  for (const slug of toolSlugs) {
    console.log(`\n📦 ${slug.toUpperCase()}`);
    console.log("-".repeat(100));

    const tool = await verifyTool(slug);

    if (!tool) {
      console.log("  ❌ Tool not found in database");
      continue;
    }

    tools.push(tool);

    console.log(`  Name:        ${tool.name}`);
    console.log(`  Category:    ${tool.category}`);
    console.log(`  Score:       ${tool.score}/100`);
    console.log(`  Rank:        #${tool.rank}`);
    console.log(`  Period:      ${tool.period}`);
    console.log(`  Updated:     ${new Date(tool.updatedAt).toLocaleString()}`);
    console.log(`  Description: ${tool.description}`);
  }

  // Summary table
  console.log("\n" + "=".repeat(100));
  console.log("\n📊 SUMMARY TABLE\n");
  console.log("Rank | Tool                    | Score  | Category                  | Status");
  console.log("-".repeat(100));

  tools
    .sort((a, b) => Number(a.rank) - Number(b.rank))
    .forEach((tool) => {
      const name = tool.name.padEnd(23);
      const score = String(tool.score).padEnd(6);
      const category = tool.category.padEnd(25);
      const status = tool.score !== "No score" ? "✅ Updated" : "⚠️  Missing Score";
      console.log(`#${String(tool.rank).padStart(2)}  | ${name} | ${score} | ${category} | ${status}`);
    });

  console.log("\n" + "=".repeat(100));

  // Category breakdown
  console.log("\n📁 CATEGORY BREAKDOWN\n");

  const categories: Record<string, any[]> = {};
  tools.forEach((tool) => {
    if (!categories[tool.category]) {
      categories[tool.category] = [];
    }
    categories[tool.category].push(tool);
  });

  Object.keys(categories)
    .sort()
    .forEach((category) => {
      console.log(`  ${category}:`);
      categories[category].forEach((tool) => {
        console.log(`    - ${tool.name} (Score: ${tool.score})`);
      });
      console.log();
    });

  console.log("=".repeat(100));
  console.log("\n✅ Verification complete!\n");
}

main()
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  })
  .finally(() => {
    closeDb();
  });
