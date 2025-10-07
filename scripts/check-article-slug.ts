/**
 * Check if a specific article slug exists in the database
 */

import { getDb } from "@/lib/db/connection";
import { articles } from "@/lib/db/article-schema";
import { like, or, desc, eq } from "drizzle-orm";

async function checkSlug() {
  const db = getDb();

  console.log("\n=== Checking for article slug ===\n");

  // Check for the specific slug
  const specificSlug = "ai-coding-tools-discovery-adoption-funding-and-technical-trends-aug-7-aug-17-2025";

  const exactMatch = await db
    .select()
    .from(articles)
    .where(eq(articles.slug, specificSlug))
    .limit(1);

  console.log("Exact match for slug:", specificSlug);
  if (exactMatch.length > 0) {
    console.log("✓ Found!");
    console.log("  ID:", exactMatch[0].id);
    console.log("  Title:", exactMatch[0].title);
    console.log("  Status:", exactMatch[0].status);
    console.log("  Published:", exactMatch[0].publishedDate);
  } else {
    console.log("✗ Not found");
  }

  console.log("\n=== Partial matches (ai-coding-tools) ===\n");

  const partialMatches = await db
    .select({
      slug: articles.slug,
      title: articles.title,
      status: articles.status,
      publishedDate: articles.publishedDate,
    })
    .from(articles)
    .where(
      or(
        like(articles.slug, "%ai-coding-tools%aug%"),
        like(articles.slug, "%ai-coding-tools-discovery%")
      )
    )
    .limit(10);

  if (partialMatches.length > 0) {
    partialMatches.forEach((article, i) => {
      console.log(`${i + 1}. ${article.slug}`);
      console.log(`   Title: ${article.title}`);
      console.log(`   Status: ${article.status}`);
      console.log(`   Published: ${article.publishedDate}`);
      console.log("");
    });
  } else {
    console.log("No partial matches found");
  }

  console.log("\n=== Recent active articles ===\n");

  const recentArticles = await db
    .select({
      slug: articles.slug,
      title: articles.title,
      status: articles.status,
      publishedDate: articles.publishedDate,
    })
    .from(articles)
    .where(eq(articles.status, "active"))
    .orderBy(desc(articles.publishedDate))
    .limit(5);

  recentArticles.forEach((article, i) => {
    console.log(`${i + 1}. ${article.slug}`);
    console.log(`   Title: ${article.title}`);
    console.log(`   Published: ${article.publishedDate}`);
    console.log("");
  });

  process.exit(0);
}

checkSlug().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
