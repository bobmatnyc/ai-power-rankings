/**
 * Quick script to check logo paths in database
 */
import { getDb } from "../lib/db/connection";
import { tools } from "../lib/db/schema";
import { inArray } from "drizzle-orm";

async function checkLogoPaths() {
  const db = getDb();
  if (!db) {
    console.error("Database not connected");
    process.exit(1);
  }

  const toolsToCheck = ["cursor", "github-copilot", "claude-code"];

  const results = await db
    .select()
    .from(tools)
    .where(inArray(tools.slug, toolsToCheck));

  console.log("\nDatabase Logo Path Check:");
  console.log("=".repeat(80));

  for (const tool of results) {
    const data = tool.data as Record<string, unknown>;
    console.log(`\nTool: ${tool.name} (${tool.slug})`);
    console.log(`  Database ID: ${tool.id}`);
    console.log(`  JSONB logo: ${data.logo || "(not set)"}`);
  }

  console.log("\n" + "=".repeat(80));
  process.exit(0);
}

checkLogoPaths();
