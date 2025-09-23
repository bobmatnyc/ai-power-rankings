#!/usr/bin/env tsx

/**
 * Script to check articles in the database
 */

import { desc } from "drizzle-orm";
import { getDb } from "../src/lib/db/connection";
import { articles } from "../src/lib/db/schema";

async function checkArticles() {
  const db = getDb();

  if (!db) {
    console.error("Database connection not available");
    process.exit(1);
  }

  try {
    // Count total articles
    const allArticles = await db.select().from(articles);
    console.log(`Total articles in database: ${allArticles.length}`);

    // Get recent articles
    const recentArticles = await db
      .select()
      .from(articles)
      .orderBy(desc(articles.createdAt))
      .limit(5);

    if (recentArticles.length > 0) {
      console.log("\nRecent articles:");
      recentArticles.forEach((a) => {
        console.log(`- ${a.title} (status: ${a.status}, created: ${a.createdAt})`);
      });
    } else {
      console.log("No articles found in database");
    }

    // Check status distribution
    const statusCounts = allArticles.reduce(
      (acc, article) => {
        acc[article.status] = (acc[article.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    if (Object.keys(statusCounts).length > 0) {
      console.log("\nArticle status distribution:");
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`- ${status}: ${count}`);
      });
    }
  } catch (error) {
    console.error("Error querying articles:", error);
  }

  process.exit(0);
}

checkArticles();
