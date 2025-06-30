#!/usr/bin/env tsx
/**
 * Import News from CSV to JSON Database
 * Imports news articles from the exported CSV file into the JSON database
 */

import { getNewsRepo } from "../lib/json-db";
import fs from "fs/promises";
import path from "path";
import { parse } from "csv-parse/sync";

interface CSVNewsRow {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  published_at: string;
  related_tools: string;
  category: string;
  importance_score: string;
  created_at: string;
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

function parseRelatedTools(relatedToolsStr: string): string[] {
  // Parse the array string format: ["tool1","tool2"] or []
  if (!relatedToolsStr || relatedToolsStr === "[]") {
    return [];
  }

  try {
    // Remove brackets and quotes, then split
    const cleaned = relatedToolsStr.replace(/[\[\]"]/g, "");
    if (!cleaned) return [];

    return cleaned
      .split(",")
      .map((tool) => tool.trim())
      .filter(Boolean);
  } catch (error) {
    console.warn(`Failed to parse related tools: ${relatedToolsStr}`);
    return [];
  }
}

function convertCSVToArticle(row: CSVNewsRow): NewsArticle {
  const now = new Date().toISOString();

  // Use summary as content if no separate content field
  const content = row.summary || row.title;

  // Parse the published date
  let publishedDate = row.published_at;
  try {
    // Ensure it's in ISO format
    publishedDate = new Date(row.published_at).toISOString();
  } catch (error) {
    console.warn(`Invalid date format for article ${row.id}: ${row.published_at}`);
    publishedDate = now;
  }

  // Parse created date
  let createdDate = row.created_at;
  try {
    createdDate = new Date(row.created_at).toISOString();
  } catch (error) {
    createdDate = now;
  }

  return {
    id: row.id,
    slug: generateSlug(row.title),
    title: row.title,
    content: content,
    summary: row.summary,
    published_date: publishedDate,
    source: row.source,
    source_url: row.url,
    tags: row.category ? [row.category] : [],
    tool_mentions: parseRelatedTools(row.related_tools),
    created_at: createdDate,
    updated_at: now,
  };
}

async function importNewsFromCSV() {
  try {
    console.log("🔄 Starting news import from CSV...\n");

    // Load CSV file
    const csvPath = path.join(process.cwd(), "data", "incoming", "news_updates_rows.csv");
    const csvContent = await fs.readFile(csvPath, "utf-8");

    // Parse CSV
    const rows: CSVNewsRow[] = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    console.log(`📊 Found ${rows.length} articles in CSV\n`);

    // Get current articles from database
    const newsRepo = getNewsRepo();
    const currentArticles = await newsRepo.getAll();
    console.log(`📊 Current database has ${currentArticles.length} articles\n`);

    // Create a set of existing IDs and titles for duplicate detection
    const existingIds = new Set(currentArticles.map((a) => a.id));
    const existingTitles = new Set(currentArticles.map((a) => a.title.toLowerCase()));
    const existingSlugs = new Set(currentArticles.map((a) => a.slug));

    // Convert and filter CSV rows
    const articlesToImport: NewsArticle[] = [];
    let skipped = 0;
    let duplicates = 0;

    for (const row of rows) {
      // Skip if ID already exists
      if (existingIds.has(row.id)) {
        duplicates++;
        console.log(`   ⚠️  Duplicate ID: ${row.title.substring(0, 50)}...`);
        continue;
      }

      // Skip if title already exists (case-insensitive)
      const titleLower = row.title.toLowerCase();
      if (existingTitles.has(titleLower)) {
        duplicates++;
        console.log(`   ⚠️  Duplicate title: ${row.title.substring(0, 50)}...`);
        continue;
      }

      // Skip invalid entries
      if (!row.title || !row.id) {
        skipped++;
        console.log(`   ⚠️  Skipping invalid entry: ${JSON.stringify(row).substring(0, 100)}...`);
        continue;
      }

      const article = convertCSVToArticle(row);

      // Ensure unique slug
      let baseSlug = article.slug;
      let counter = 1;
      while (
        existingSlugs.has(article.slug) ||
        articlesToImport.some((a) => a.slug === article.slug)
      ) {
        article.slug = `${baseSlug}-${counter}`;
        counter++;
      }

      articlesToImport.push(article);
      existingIds.add(article.id);
      existingTitles.add(titleLower);
      existingSlugs.add(article.slug);
    }

    console.log(`\n📊 Import Summary:`);
    console.log(`   - Articles to import: ${articlesToImport.length}`);
    console.log(`   - Duplicates skipped: ${duplicates}`);
    console.log(`   - Invalid entries skipped: ${skipped}`);

    if (articlesToImport.length === 0) {
      console.log("\n✅ No new articles to import!");
      return;
    }

    // Sort by published date (oldest first) to maintain chronological order
    articlesToImport.sort(
      (a, b) => new Date(a.published_date).getTime() - new Date(b.published_date).getTime()
    );

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
          console.log(
            `   ✓ [${new Date(article.published_date).toISOString().split("T")[0]}] ${article.title.substring(0, 50)}...`
          );
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
  importNewsFromCSV()
    .then(() => {
      console.log("\n✅ Import completed!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Import failed:", error);
      process.exit(1);
    });
}
