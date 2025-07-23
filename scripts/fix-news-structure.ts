#!/usr/bin/env node

import { copyFile, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const DATA_PATH = join(process.cwd(), "data", "json");

async function fixNewsStructure() {
  console.log("📰 Fixing news data structure...");

  try {
    const newsPath = join(DATA_PATH, "news", "news.json");

    // Backup first
    const timestamp = new Date().toISOString();
    const backupPath = `${newsPath}.backup-${timestamp}`;
    await copyFile(newsPath, backupPath);
    console.log(`✅ Backed up to ${backupPath}`);

    const newsData = JSON.parse(await readFile(newsPath, "utf-8"));

    // If articles array is empty but index.byId has content, rebuild articles from index
    if (
      newsData.articles?.length === 0 &&
      newsData.index?.byId &&
      Object.keys(newsData.index.byId).length > 0
    ) {
      console.log("Found articles in index.byId, rebuilding articles array...");

      const articles = Object.values(newsData.index.byId);

      // Fix date fields while we're at it
      for (const article of articles) {
        if (article.published_date && !article.date) {
          article.date = article.published_date;
          delete article.published_date;
        }
      }

      // Sort articles by date descending
      articles.sort((a: any, b: any) => {
        const dateA = new Date(a.date || a.created_at);
        const dateB = new Date(b.date || b.created_at);
        return dateB.getTime() - dateA.getTime();
      });

      newsData.articles = articles;
      console.log(`✅ Rebuilt articles array with ${articles.length} articles`);
    }

    // Save the fixed data
    await writeFile(newsPath, JSON.stringify(newsData, null, 2));
    console.log("✅ Saved fixed news.json");

    // Now rebuild the cache
    const cacheData = {
      articles: newsData.articles || [],
      total: newsData.articles?.length || 0,
      last_updated: new Date().toISOString(),
    };

    const cachePath = join(process.cwd(), "src", "data", "cache", "news.json");
    await writeFile(cachePath, JSON.stringify(cacheData, null, 2));
    console.log(`✅ Rebuilt news cache with ${cacheData.total} articles`);
  } catch (error) {
    console.error("❌ Error fixing news structure:", error);
  }
}

fixNewsStructure().catch(console.error);
