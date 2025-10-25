#!/usr/bin/env tsx

/**
 * Check Qwen Code Overview for 480B Model Mention
 */

import { getDb, closeDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const db = getDb();
  const [tool] = await db.select().from(tools).where(eq(tools.slug, "qwen-code")).limit(1);

  if (!tool) {
    console.log("Tool not found");
    closeDb();
    return;
  }

  const toolData = tool.data as Record<string, any>;
  const overview = toolData.overview || "";

  console.log("Qwen Code Overview:");
  console.log("=".repeat(80));
  console.log(overview);
  console.log("=".repeat(80));
  console.log(`\nLength: ${overview.length} chars`);
  console.log(`Words: ${overview.split(/\s+/).length}`);
  console.log(`\n480B mentions: ${overview.match(/480[- ]?b/gi)?.length || 0}`);
  console.log(`Matches: ${overview.match(/480[- ]?b/gi) || "none"}`);

  closeDb();
}

main();
