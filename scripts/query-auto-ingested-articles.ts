#!/usr/bin/env npx ts-node
/**
 * Query recently auto-ingested articles
 * Finds articles with ingestion_run_id set or is_auto_ingested = true
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { desc, eq, isNotNull, or, sql } from "drizzle-orm";
import { getDb } from "../lib/db/connection";
import { articles, automatedIngestionRuns } from "../lib/db/schema";

async function queryAutoIngestedArticles() {
  console.log("=== Querying Auto-Ingested Articles ===\n");

  const db = getDb();
  if (!db) {
    console.error("Failed to get database connection");
    process.exit(1);
  }

  try {
    // 1. First, check if there are any automated ingestion runs
    console.log("1. Checking automated ingestion runs...\n");
    const runs = await db
      .select()
      .from(automatedIngestionRuns)
      .orderBy(desc(automatedIngestionRuns.createdAt))
      .limit(5);

    if (runs.length === 0) {
      console.log("   No automated ingestion runs found in the database.\n");
    } else {
      console.log(`   Found ${runs.length} recent ingestion runs:\n`);
      for (const run of runs) {
        console.log(`   Run ID: ${run.id}`);
        console.log(`   Type: ${run.runType}`);
        console.log(`   Status: ${run.status}`);
        console.log(`   Started: ${run.startedAt}`);
        console.log(`   Completed: ${run.completedAt || "In progress"}`);
        console.log(`   Articles discovered: ${run.articlesDiscovered}`);
        console.log(`   Articles ingested: ${run.articlesIngested}`);
        console.log(`   Search query: ${run.searchQuery || "N/A"}`);
        console.log("   ---");
      }
    }

    // 2. Query articles that are auto-ingested
    console.log("\n2. Querying auto-ingested articles...\n");

    const autoIngestedArticles = await db
      .select({
        id: articles.id,
        title: articles.title,
        sourceUrl: articles.sourceUrl,
        sourceName: articles.sourceName,
        discoverySource: articles.discoverySource,
        isAutoIngested: articles.isAutoIngested,
        ingestionRunId: articles.ingestionRunId,
        publishedDate: articles.publishedDate,
        ingestedAt: articles.ingestedAt,
        importanceScore: articles.importanceScore,
        status: articles.status,
      })
      .from(articles)
      .where(
        or(
          eq(articles.isAutoIngested, true),
          isNotNull(articles.ingestionRunId)
        )
      )
      .orderBy(desc(articles.ingestedAt))
      .limit(10);

    if (autoIngestedArticles.length === 0) {
      console.log("   No auto-ingested articles found.\n");

      // Check if there are any articles at all
      const totalArticles = await db
        .select({ count: sql<number>`count(*)` })
        .from(articles);
      console.log(`   Total articles in database: ${totalArticles[0]?.count || 0}`);
    } else {
      console.log(`   Found ${autoIngestedArticles.length} auto-ingested articles:\n`);
      console.log("   " + "=".repeat(80) + "\n");

      for (const article of autoIngestedArticles) {
        console.log(`   Title: ${article.title}`);
        console.log(`   Source: ${article.sourceName || "Unknown"}`);
        console.log(`   URL: ${article.sourceUrl || "N/A"}`);
        console.log(`   Discovery Source: ${article.discoverySource || "N/A"}`);
        console.log(`   Auto-Ingested: ${article.isAutoIngested ? "Yes" : "No"}`);
        console.log(`   Ingestion Run ID: ${article.ingestionRunId || "N/A"}`);
        console.log(`   Published: ${article.publishedDate || "N/A"}`);
        console.log(`   Ingested At: ${article.ingestedAt}`);
        console.log(`   Quality Score: ${article.importanceScore || "N/A"}`);
        console.log(`   Status: ${article.status}`);
        console.log("   " + "-".repeat(80));
      }
    }

    // 3. Summary by discovery source
    console.log("\n3. Articles by discovery source...\n");
    const bySource = await db
      .select({
        discoverySource: articles.discoverySource,
        count: sql<number>`count(*)`,
      })
      .from(articles)
      .groupBy(articles.discoverySource);

    for (const source of bySource) {
      console.log(`   ${source.discoverySource || "null"}: ${source.count} articles`);
    }

    // 4. Recent articles (last 7 days) regardless of source
    console.log("\n4. Most recent articles (last 10, any source)...\n");
    const recentArticles = await db
      .select({
        title: articles.title,
        discoverySource: articles.discoverySource,
        isAutoIngested: articles.isAutoIngested,
        ingestedAt: articles.ingestedAt,
        sourceUrl: articles.sourceUrl,
      })
      .from(articles)
      .orderBy(desc(articles.ingestedAt))
      .limit(10);

    for (const article of recentArticles) {
      const autoTag = article.isAutoIngested ? "[AUTO]" : "[MANUAL]";
      const source = article.discoverySource || "unknown";
      console.log(`   ${autoTag} [${source}] ${article.title?.substring(0, 60)}...`);
      console.log(`      Ingested: ${article.ingestedAt}`);
      console.log(`      URL: ${article.sourceUrl?.substring(0, 70) || "N/A"}...`);
      console.log("");
    }

  } catch (error) {
    console.error("Error querying articles:", error);
    process.exit(1);
  }

  console.log("\n=== Query Complete ===");
  process.exit(0);
}

queryAutoIngestedArticles();
