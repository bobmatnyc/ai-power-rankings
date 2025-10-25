#!/usr/bin/env tsx

/**
 * Check which Phase 3 open source tools exist in the database
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";

const PHASE3_TOOL_SLUGS = [
  "aider",
  "continue",
  "google-gemini-cli",
  "qwen-code",
  "mentat",
  "open-interpreter"
];

async function checkTools() {
  const db = getDb();

  console.log("🔍 Checking Phase 3 open source tools...\n");
  console.log("=".repeat(80));

  const existingTools = await db
    .select()
    .from(tools)
    .where(inArray(tools.slug, PHASE3_TOOL_SLUGS));

  const existingSlugs = existingTools.map(t => t.slug);

  console.log(`\n✅ Found ${existingTools.length} existing tools:\n`);
  existingTools.forEach(tool => {
    console.log(`  - ${tool.name} (${tool.slug}) - Category: ${tool.category}`);
  });

  const missingTools = PHASE3_TOOL_SLUGS.filter(slug => !existingSlugs.includes(slug));

  if (missingTools.length > 0) {
    console.log(`\n❌ Missing ${missingTools.length} tools:\n`);
    missingTools.forEach(slug => {
      console.log(`  - ${slug}`);
    });
  }

  console.log("\n" + "=".repeat(80));
}

checkTools()
  .catch(console.error)
  .finally(() => closeDb());
