#!/usr/bin/env tsx

import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import fs from "fs-extra";
import { NewsRepository } from "../src/lib/json-db/news-repository.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function generateNewsCache() {
  console.log("📰 Generating news cache...\n");

  try {
    const newsRepository = new NewsRepository();

    // Get all news articles
    const allArticles = await newsRepository.getAll();
    console.log(`📦 Found ${allArticles.length} articles`);

    // Generate cache file
    const cacheDir = path.join(__dirname, "../src/data/cache");
    await fs.ensureDir(cacheDir);

    const cacheFile = path.join(cacheDir, "news.json");

    // Sort articles by date (newest first)
    const sortedArticles = allArticles.sort((a, b) => {
      const dateA = new Date(a.published_at);
      const dateB = new Date(b.published_at);
      return dateB.getTime() - dateA.getTime();
    });

    // Write news array directly (maintaining compatibility)
    await fs.writeJson(cacheFile, sortedArticles, { spaces: 2 });

    console.log(`✅ Cache generated: ${cacheFile}`);
    console.log(`📊 Total articles: ${sortedArticles.length}`);

    // Show monthly breakdown for recent months
    const monthlyBreakdown: Record<string, number> = {};
    sortedArticles.forEach((article) => {
      const date = new Date(article.published_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyBreakdown[monthKey] = (monthlyBreakdown[monthKey] || 0) + 1;
    });

    // Get recent 6 months
    const sortedMonths = Object.keys(monthlyBreakdown).sort().slice(-6);
    
    console.log("\n📅 Recent months:");
    for (const month of sortedMonths) {
      console.log(`  - ${month}: ${monthlyBreakdown[month]} articles`);
    }
  } catch (error) {
    console.error("❌ Error generating news cache:", error);
    process.exit(1);
  }
}

generateNewsCache();