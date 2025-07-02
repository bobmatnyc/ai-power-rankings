#!/usr/bin/env tsx

import fs from "fs-extra";
import path from "path";
import type { NewsData, NewsArticle } from "@/lib/json-db/schemas";

async function splitNewsByMonth() {
  const newsFilePath = path.join(process.cwd(), "data", "json", "news", "news.json");
  const articlesDir = path.join(process.cwd(), "data", "json", "news", "articles");

  // Ensure articles directory exists
  await fs.ensureDir(articlesDir);

  // Read current news data
  console.log("Reading news.json...");
  const newsData: NewsData = await fs.readJson(newsFilePath);
  console.log(`Found ${newsData.articles.length} articles`);

  // Group articles by month
  const articlesByMonth: Record<string, NewsArticle[]> = {};

  for (const article of newsData.articles) {
    const date = new Date(article.published_date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    if (!articlesByMonth[monthKey]) {
      articlesByMonth[monthKey] = [];
    }
    articlesByMonth[monthKey].push(article);
  }

  console.log(`\nSplitting into ${Object.keys(articlesByMonth).length} monthly files:`);

  // Write monthly files
  for (const [monthKey, articles] of Object.entries(articlesByMonth)) {
    const monthFilePath = path.join(articlesDir, `${monthKey}.json`);

    // Sort articles by published date (newest first)
    articles.sort(
      (a, b) => new Date(b.published_date).getTime() - new Date(a.published_date).getTime()
    );

    await fs.writeJson(monthFilePath, articles, { spaces: 2 });
    console.log(`  ${monthKey}: ${articles.length} articles → ${path.basename(monthFilePath)}`);
  }

  // Create a summary index file
  const indexFilePath = path.join(articlesDir, "index.json");
  const index = {
    months: Object.keys(articlesByMonth).sort().reverse(),
    articleCounts: Object.fromEntries(
      Object.entries(articlesByMonth).map(([month, articles]) => [month, articles.length])
    ),
    totalArticles: newsData.articles.length,
    lastUpdated: new Date().toISOString(),
  };

  await fs.writeJson(indexFilePath, index, { spaces: 2 });
  console.log(`\nCreated index file: ${path.basename(indexFilePath)}`);

  // Keep the original news.json but clear the articles array to save space
  // Keep only the structure and metadata
  const lightNewsData: NewsData = {
    ...newsData,
    articles: [], // Clear articles array
    metadata: {
      ...newsData.metadata,
      total: 0,
      last_updated: new Date().toISOString(),
      note: "Articles have been moved to monthly files in the articles/ directory",
    },
  };

  // Create backup of original file
  const backupPath = newsFilePath.replace(".json", `-backup-${Date.now()}.json`);
  await fs.copy(newsFilePath, backupPath);
  console.log(`\nCreated backup: ${path.basename(backupPath)}`);

  // Write the light version
  await fs.writeJson(newsFilePath, lightNewsData, { spaces: 2 });
  console.log("Updated news.json to reference monthly files");

  console.log("\n✅ News split by month completed successfully!");
}

// Run the script
splitNewsByMonth().catch(console.error);
