#!/usr/bin/env tsx

/**
 * Set Algorithm v7.2 Article as Announcement Type
 */

import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { articles } from "@/lib/db/article-schema";
import { eq } from "drizzle-orm";

neonConfig.poolQueryViaFetch = true;

const DATABASE_URL = process.env["DATABASE_URL"];

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL not found");
  process.exit(1);
}

console.log("📢 Setting Algorithm v7.2 Article as Announcement");
console.log("=".repeat(80));

const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool);

async function updateToAnnouncement() {
  try {
    console.log("\n🔍 Finding article...");
    const existing = await db
      .select()
      .from(articles)
      .where(eq(articles.slug, "algorithm-v72-october-2025-rankings"));

    if (existing.length === 0) {
      console.log("❌ Article not found!");
      return;
    }

    console.log("✓ Found article\n");

    console.log("💾 Updating to announcement type...");
    await db
      .update(articles)
      .set({
        category: "announcement",
        tags: ["announcement", "site update", "methodology", "AI coding tools"],
        updatedAt: new Date(),
      })
      .where(eq(articles.slug, "algorithm-v72-october-2025-rankings"));

    console.log("✅ Article updated successfully!");
    console.log("\n📊 Updated Properties:");
    console.log(`   Category: announcement`);
    console.log(`   Tags: announcement, site update, methodology, AI coding tools`);

    console.log("\n🎉 Complete!");
    console.log("=".repeat(80));
    console.log("✅ Article now appears as an Announcement");
    console.log("🔗 View: https://aipowerranking.com/en/news");
  } catch (error) {
    console.error("\n❌ Failed:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

updateToAnnouncement();
