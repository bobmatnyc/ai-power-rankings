/**
 * Script to sync data from development database to production database
 * Run with: pnpm tsx scripts/sync-to-production.ts
 *
 * CAUTION: This will modify production data!
 */

import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/lib/db/schema";

// Load environment variables
dotenv.config({ path: ".env.local" });

// Development database
const devUrl = process.env["DATABASE_URL"];
const devSql = devUrl ? neon(devUrl) : null;
const devDb = devSql ? drizzle(devSql, { schema }) : null;

// Production database
const prodUrl = process.env["PRODUCTION_DATABASE_URL"];
const prodSql = prodUrl ? neon(prodUrl) : null;
const prodDb = prodSql ? drizzle(prodSql, { schema }) : null;

async function syncNews() {
  console.log("📰 Syncing news articles...");

  if (!devDb || !prodDb) {
    throw new Error("Database connections not configured");
  }

  // Get all news from development
  const devNews = await devDb.select().from(schema.news);
  console.log(`Found ${devNews.length} news articles in development`);

  // Clear production news table (optional - comment out if you want to merge)
  // await prodDb.delete(schema.news);
  // console.log("Cleared production news table");

  // Insert news into production
  let inserted = 0;
  let skipped = 0;

  for (const article of devNews) {
    try {
      // Check if article already exists
      const existing = await prodDb
        .select()
        .from(schema.news)
        .where(sql`slug = ${article.slug}`)
        .limit(1);

      if (existing.length > 0) {
        skipped++;
        console.log(`⏭️  Skipping existing: ${article.title}`);
        continue;
      }

      // Insert the article
      await prodDb.insert(schema.news).values(article);
      inserted++;
      console.log(`✅ Added: ${article.title}`);
    } catch (error) {
      console.error(`❌ Error adding article ${article.title}:`, error);
    }
  }

  console.log(`\n📊 News sync complete: ${inserted} added, ${skipped} skipped`);
}

async function syncTools() {
  console.log("\n🛠️  Syncing tools...");

  if (!devDb || !prodDb) {
    throw new Error("Database connections not configured");
  }

  // Get all tools from development
  const devTools = await devDb.select().from(schema.tools);
  console.log(`Found ${devTools.length} tools in development`);

  // Insert tools into production
  let inserted = 0;
  let skipped = 0;

  for (const tool of devTools) {
    try {
      // Check if tool already exists
      const existing = await prodDb
        .select()
        .from(schema.tools)
        .where(sql`slug = ${tool.slug}`)
        .limit(1);

      if (existing.length > 0) {
        skipped++;
        console.log(`⏭️  Skipping existing: ${tool.name}`);
        continue;
      }

      // Insert the tool
      await prodDb.insert(schema.tools).values(tool);
      inserted++;
      console.log(`✅ Added: ${tool.name}`);
    } catch (error) {
      console.error(`❌ Error adding tool ${tool.name}:`, error);
    }
  }

  console.log(`\n📊 Tools sync complete: ${inserted} added, ${skipped} skipped`);
}

async function syncRankings() {
  console.log("\n📈 Syncing rankings...");

  if (!devDb || !prodDb) {
    throw new Error("Database connections not configured");
  }

  // Get all rankings from development
  const devRankings = await devDb.select().from(schema.rankings);
  console.log(`Found ${devRankings.length} ranking periods in development`);

  // Insert rankings into production
  let inserted = 0;
  let skipped = 0;

  for (const ranking of devRankings) {
    try {
      // Check if ranking period already exists
      const existing = await prodDb
        .select()
        .from(schema.rankings)
        .where(sql`period = ${ranking.period}`)
        .limit(1);

      if (existing.length > 0) {
        skipped++;
        console.log(`⏭️  Skipping existing period: ${ranking.period}`);
        continue;
      }

      // Insert the ranking
      await prodDb.insert(schema.rankings).values(ranking);
      inserted++;
      console.log(`✅ Added period: ${ranking.period}`);
    } catch (error) {
      console.error(`❌ Error adding ranking period ${ranking.period}:`, error);
    }
  }

  console.log(`\n📊 Rankings sync complete: ${inserted} added, ${skipped} skipped`);
}

async function getStatistics(db: any, label: string) {
  const newsCount = await db.select({ count: sql<number>`count(*)` }).from(schema.news);

  const toolsCount = await db.select({ count: sql<number>`count(*)` }).from(schema.tools);

  const rankingsCount = await db.select({ count: sql<number>`count(*)` }).from(schema.rankings);

  console.log(`\n📊 ${label} Statistics:`);
  console.log(`   - News articles: ${newsCount[0]?.count || 0}`);
  console.log(`   - Tools: ${toolsCount[0]?.count || 0}`);
  console.log(`   - Ranking periods: ${rankingsCount[0]?.count || 0}`);
}

async function main() {
  console.log("🚀 Starting database sync from Development to Production\n");

  if (!devDb) {
    console.error("❌ Development database not configured");
    process.exit(1);
  }

  if (!prodDb) {
    console.error("❌ Production database not configured");
    process.exit(1);
  }

  try {
    // Show initial statistics
    await getStatistics(devDb, "Development Database");
    await getStatistics(prodDb, "Production Database (Before Sync)");

    // Ask for confirmation
    console.log("\n⚠️  WARNING: This will modify the production database!");
    console.log("Press Ctrl+C to cancel, or wait 5 seconds to continue...\n");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Perform sync
    await syncNews();
    await syncTools();
    await syncRankings();

    // Show final statistics
    await getStatistics(prodDb, "Production Database (After Sync)");

    console.log("\n✨ Sync complete!");
  } catch (error) {
    console.error("\n❌ Sync failed:", error);
    process.exit(1);
  }
}

// Run the sync
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
