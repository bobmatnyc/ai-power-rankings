/**
 * Check categories for the 7 new tools
 */

import { getDb } from "../lib/db/connection";
import { tools } from "../lib/db/schema";
import { eq } from "drizzle-orm";

async function checkCategories() {
  const db = getDb();
  if (!db) {
    console.error("❌ Database connection not available");
    process.exit(1);
  }

  const toolSlugs = [
    "openai-codex",
    "greptile",
    "google-gemini-cli",
    "graphite",
    "qwen-code",
    "gitlab-duo",
    "anything-max",
  ];

  console.log("🔍 Checking tool categories:\n");

  for (const slug of toolSlugs) {
    const result = await db
      .select({ name: tools.name, slug: tools.slug, category: tools.category })
      .from(tools)
      .where(eq(tools.slug, slug));

    if (result[0]) {
      console.log(`${result[0].name}: ${result[0].category}`);
    }
  }

  process.exit(0);
}

checkCategories().catch(console.error);
