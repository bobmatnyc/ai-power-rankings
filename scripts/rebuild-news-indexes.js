#!/usr/bin/env node

/**
 * Script to rebuild missing newsById and newsBySlug indexes for July/August 2025 news files
 *
 * This script addresses the 404 errors caused by missing indexes in the news repository.
 * The NewsRepositoryV2 requires both newsById and newsBySlug indexes for fast lookups
 * when running in "by-month" mode.
 */

const fs = require("fs-extra");
const path = require("node:path");

async function generateSlug(title) {
  if (!title || typeof title !== "string") {
    return "";
  }

  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "") // Remove special chars except spaces and hyphens
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
}

async function rebuildIndexes(filePath) {
  console.log(`Processing: ${filePath}`);

  if (!(await fs.pathExists(filePath))) {
    console.log(`  File does not exist, skipping: ${filePath}`);
    return;
  }

  try {
    // Read the current file
    const data = await fs.readJson(filePath);

    if (!data.articles || !Array.isArray(data.articles)) {
      console.log(`  No articles array found in: ${filePath}`);
      return;
    }

    console.log(`  Found ${data.articles.length} articles`);

    // Build indexes
    const newsById = {};
    const newsBySlug = {};

    for (const article of data.articles) {
      if (!article.id) {
        console.warn(
          `  Warning: Article missing ID in ${filePath}:`,
          article.title || "Unknown title"
        );
        continue;
      }

      // Add to newsById index
      newsById[article.id] = article;

      // Generate slug if missing, otherwise use existing one
      if (!article.slug) {
        article.slug = await generateSlug(article.title);
        console.log(`  Generated slug for "${article.title}": ${article.slug}`);
      }

      // Add to newsBySlug index
      if (article.slug) {
        if (newsBySlug[article.slug]) {
          console.warn(`  Warning: Duplicate slug "${article.slug}" in ${filePath}`);
          // Add a suffix to make it unique
          let counter = 1;
          let uniqueSlug = `${article.slug}-${counter}`;
          while (newsBySlug[uniqueSlug]) {
            counter++;
            uniqueSlug = `${article.slug}-${counter}`;
          }
          article.slug = uniqueSlug;
          console.log(`  Changed slug to: ${uniqueSlug}`);
        }
        newsBySlug[article.slug] = article;
      }
    }

    // Update the data structure
    data.newsById = newsById;
    data.newsBySlug = newsBySlug;

    // Update/add metadata
    const filename = path.basename(filePath);
    const monthMatch = filename.match(/(\d{4}-\d{2})/);
    const month = monthMatch ? monthMatch[1] : "unknown";

    data.metadata = {
      month: month,
      articleCount: data.articles.length,
      generatedAt: new Date().toISOString(),
      ...data.metadata, // Preserve existing metadata if any
    };

    // Create a backup first
    const backupPath = `${filePath}.backup-${new Date().toISOString().replace(/:/g, "-").split(".")[0]}`;
    await fs.copy(filePath, backupPath);
    console.log(`  Created backup: ${backupPath}`);

    // Write the updated file
    await fs.writeJson(filePath, data, { spaces: 2 });
    console.log(
      `  ✓ Updated with ${Object.keys(newsById).length} ID indexes and ${Object.keys(newsBySlug).length} slug indexes`
    );
  } catch (error) {
    console.error(`  Error processing ${filePath}:`, error.message);
    throw error;
  }
}

async function main() {
  console.log("Rebuilding news article indexes for July/August 2025...\n");

  const byMonthDir = path.join(process.cwd(), "data", "json", "news", "by-month");
  const articlesDir = path.join(process.cwd(), "data", "json", "news", "articles");

  // Files to fix
  const filesToFix = [
    path.join(byMonthDir, "2025-07.json"),
    path.join(byMonthDir, "2025-08.json"),
    path.join(articlesDir, "2025-07.json"),
    path.join(articlesDir, "2025-08.json"),
  ];

  for (const filePath of filesToFix) {
    await rebuildIndexes(filePath);
    console.log(); // Empty line for readability
  }

  // Also check the main news.json file for any indexes that need updating
  const mainNewsPath = path.join(process.cwd(), "data", "json", "news", "news.json");
  if (await fs.pathExists(mainNewsPath)) {
    console.log("Checking main news.json file...");
    try {
      const mainData = await fs.readJson(mainNewsPath);
      console.log(`  Main file has ${mainData.articles?.length || 0} articles`);
      console.log(`  Main file metadata: ${JSON.stringify(mainData.metadata, null, 2)}`);
    } catch (error) {
      console.error("  Error reading main news file:", error.message);
    }
    console.log();
  }

  console.log("✅ Index rebuild complete!");
  console.log("\nNext steps:");
  console.log("1. Test the news article pages to ensure they load correctly");
  console.log("2. Check that NewsRepositoryV2.getBySlug() works for July/August articles");
  console.log("3. Verify that both ID and slug lookups are working");
  console.log("4. If everything works, you can delete the .backup files");
}

// Run the script
main().catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});
