#!/usr/bin/env tsx

/**
 * Import News from Cache to JSON Database
 * Imports missing news articles from the cache file into the JSON database
 */

import fs from "node:fs/promises";
import path from "node:path";
import { getNewsRepo } from "../lib/json-db";

interface CachedNewsItem {
  id: number;
  tool_id: string;
  tool_name?: string;
  tool_slug?: string;
  event_type: string;
  event_date: string;
  title: string;
  description: string;
  metrics?: {
    previous_value?: number;
    new_value?: number;
    change_percentage?: number;
    additional_metrics?: Record<string, string | number | boolean>;
  };
  source?: string;
  source_url?: string;
}

interface NewsArticle {
  id: string;
  slug: string;
  title: string;
  content: string;
  summary?: string;
  published_date: string;
  source?: string;
  source_url?: string;
  tags: string[];
  tool_mentions: string[];
  created_at: string;
  updated_at: string;
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 100);
}

function generateId(): string {
  // Generate a unique ID similar to UUID v4 format
  const timestamp = Date.now().toString(16);
  const random = Math.random().toString(16).substring(2, 10);
  const random2 = Math.random().toString(16).substring(2, 10);
  return `${timestamp}-${random}-${random2}`;
}

function convertCachedToArticle(cached: CachedNewsItem): NewsArticle {
  const now = new Date().toISOString();
  const title = cached.title || "Untitled News";

  // Generate content from description and metrics
  let content = cached.description || "";
  if (cached.metrics) {
    if (cached.metrics.previous_value !== undefined && cached.metrics.new_value !== undefined) {
      content += `\n\nMetrics Update: ${cached.metrics.previous_value} → ${cached.metrics.new_value}`;
      if (cached.metrics.change_percentage) {
        content += ` (${cached.metrics.change_percentage > 0 ? "+" : ""}${cached.metrics.change_percentage}%)`;
      }
    }
  }

  return {
    id: generateId(),
    slug: generateSlug(title),
    title,
    content: content || title,
    summary: cached.description,
    published_date: cached.event_date || now,
    source: cached.source,
    source_url: cached.source_url,
    tags: [cached.event_type].filter(Boolean),
    tool_mentions: cached.tool_id !== "unknown" ? [cached.tool_id] : [],
    created_at: now,
    updated_at: now,
  };
}

async function importNewsFromCache() {
  try {
    console.log("🔄 Starting news import from cache...\n");

    // Load cache file
    const cachePath = path.join(process.cwd(), "src", "data", "cache", "news.json");
    const cacheContent = await fs.readFile(cachePath, "utf-8");
    const cacheData = JSON.parse(cacheContent);

    if (!cacheData.news || !Array.isArray(cacheData.news)) {
      throw new Error("Invalid cache file structure");
    }

    console.log(`📊 Found ${cacheData.news.length} articles in cache\n`);

    // Get current articles from database
    const newsRepo = getNewsRepo();
    const currentArticles = await newsRepo.getAll();
    console.log(`📊 Current database has ${currentArticles.length} articles\n`);

    // Create a set of existing titles for duplicate detection
    const existingTitles = new Set(currentArticles.map((a) => a.title.toLowerCase()));
    const existingSlugs = new Set(currentArticles.map((a) => a.slug));

    // Convert and filter cached articles
    const articlesToImport: NewsArticle[] = [];
    let skipped = 0;
    let duplicates = 0;

    for (const cached of cacheData.news) {
      const titleLower = (cached.title || "").toLowerCase();

      // Skip if title already exists
      if (existingTitles.has(titleLower)) {
        duplicates++;
        continue;
      }

      // Generate title from description if not present
      const generatedTitle =
        cached.title ||
        (cached.description
          ? cached.description.substring(0, 100) + (cached.description.length > 100 ? "..." : "")
          : `${cached.tool_name || "Tool"} ${cached.event_type || "Update"}`);

      // Skip invalid entries
      if (!generatedTitle || !cached.event_date) {
        skipped++;
        console.log(`⚠️  Skipping invalid entry: ${JSON.stringify(cached).substring(0, 100)}...`);
        continue;
      }

      // Update cached object with generated title
      cached.title = generatedTitle;

      const article = convertCachedToArticle(cached);

      // Ensure unique slug
      const baseSlug = article.slug;
      let counter = 1;
      while (
        existingSlugs.has(article.slug) ||
        articlesToImport.some((a) => a.slug === article.slug)
      ) {
        article.slug = `${baseSlug}-${counter}`;
        counter++;
      }

      articlesToImport.push(article);
      existingTitles.add(titleLower);
      existingSlugs.add(article.slug);
    }

    console.log("\n📊 Import Summary:");
    console.log(`   - Articles to import: ${articlesToImport.length}`);
    console.log(`   - Duplicates skipped: ${duplicates}`);
    console.log(`   - Invalid entries skipped: ${skipped}`);

    if (articlesToImport.length === 0) {
      console.log("\n✅ No new articles to import!");
      return;
    }

    // Import articles in batches
    console.log("\n📥 Importing articles...");
    const batchSize = 10;
    let imported = 0;

    for (let i = 0; i < articlesToImport.length; i += batchSize) {
      const batch = articlesToImport.slice(i, i + batchSize);

      for (const article of batch) {
        try {
          await newsRepo.upsert(article);
          imported++;
          console.log(`   ✓ Imported: ${article.title.substring(0, 60)}...`);
        } catch (error) {
          console.error(`   ✗ Failed to import: ${article.title}`, error);
        }
      }

      // Small delay between batches
      if (i + batchSize < articlesToImport.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    console.log(`\n✅ Successfully imported ${imported} articles!`);

    // Verify final count
    const finalArticles = await newsRepo.getAll();
    console.log(`\n📊 Final database count: ${finalArticles.length} articles`);
  } catch (error) {
    console.error("❌ Import failed:", error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  importNewsFromCache()
    .then(() => {
      console.log("\n✅ Import completed!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Import failed:", error);
      process.exit(1);
    });
}
