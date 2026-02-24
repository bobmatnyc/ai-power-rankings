#!/usr/bin/env npx tsx
/**
 * Check Recent Articles
 * Shows recently ingested articles to verify ingestion is working
 */

import { getDb } from "../lib/db/connection";
import { articles } from "../lib/db/schema";
import { desc } from "drizzle-orm";

async function main() {
  const db = getDb();
  if (!db) {
    console.error("No database connection");
    return;
  }

  const recentArticles = await db
    .select({
      id: articles.id,
      title: articles.title,
      sourceUrl: articles.sourceUrl,
      createdAt: articles.createdAt,
      publishedDate: articles.publishedDate,
      discoverySource: articles.discoverySource,
      isAutoIngested: articles.isAutoIngested,
    })
    .from(articles)
    .orderBy(desc(articles.createdAt))
    .limit(15);

  console.log("Recent Articles (by ingestion date):");
  console.log("=".repeat(100));

  for (const article of recentArticles) {
    const autoLabel = article.isAutoIngested ? "[AUTO]" : "[MANUAL]";
    const source = article.discoverySource || "unknown";
    console.log(`${autoLabel} [${source}] ${article.title?.substring(0, 60)}`);
    console.log(`  ID: ${article.id}`);
    console.log(`  URL: ${article.sourceUrl?.substring(0, 80)}`);
    console.log(`  Ingested: ${article.createdAt}`);
    console.log(`  Published: ${article.publishedDate}`);
    console.log("-".repeat(100));
  }
}

main().catch(console.error);
