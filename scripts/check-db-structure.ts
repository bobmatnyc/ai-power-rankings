#!/usr/bin/env tsx

import { getDb } from "@/lib/db/connection";
import { articles } from "@/lib/db/article-schema";
import { eq } from "drizzle-orm";

async function main() {
  const db = getDb();

  // Check one article we know exists
  const result = await db
    .select({
      slug: articles.slug,
      toolMentions: articles.toolMentions,
    })
    .from(articles)
    .where(eq(articles.id, "0931ca7b-e0ca-41d4-abe7-3c2bb9151d72"))
    .limit(1);

  console.log("Article from DB:");
  console.log("Slug:", result[0].slug);
  console.log("Tool mentions type:", typeof result[0].toolMentions);
  console.log("Tool mentions value:", JSON.stringify(result[0].toolMentions, null, 2));
  console.log("Is array?", Array.isArray(result[0].toolMentions));

  if (Array.isArray(result[0].toolMentions) && result[0].toolMentions.length > 0) {
    console.log("\nFirst element:");
    console.log("  Type:", typeof result[0].toolMentions[0]);
    console.log("  Value:", JSON.stringify(result[0].toolMentions[0], null, 2));

    // Check if it's a string or object
    if (typeof result[0].toolMentions[0] === "string") {
      console.log("\n❌ Tool mentions are STRINGS (need migration)");
    } else if (typeof result[0].toolMentions[0] === "object") {
      console.log("\n✓ Tool mentions are OBJECTS (already migrated)");
      console.log("  Object keys:", Object.keys(result[0].toolMentions[0]));
    }
  }
}

main().catch(console.error);
