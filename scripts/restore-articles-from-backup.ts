#!/usr/bin/env tsx

/**
 * Restore Articles from Backup
 *
 * Restores legitimate news articles from a backup JSON file to the database.
 * This script safely handles field mapping, duplicate detection, and batch insertion.
 *
 * USAGE:
 *   # Preview what will be restored (dry-run mode)
 *   npm run tsx scripts/restore-articles-from-backup.ts --dry-run
 *
 *   # Actually restore articles (prompts for confirmation)
 *   npm run tsx scripts/restore-articles-from-backup.ts
 *
 * FEATURES:
 *   - Loads 293 articles from backup file
 *   - Transforms fields from backup format to current database schema
 *   - Detects and skips duplicates (by ID and slug)
 *   - Batch inserts with transactions (50 articles per batch)
 *   - Progress reporting during restoration
 *   - Comprehensive verification and error reporting
 *   - Interactive confirmation before making changes
 *
 * SAFETY:
 *   - Dry-run mode available for preview
 *   - Duplicate detection prevents data corruption
 *   - Continues on individual failures, reports at end
 *   - Preserves existing articles (additive only)
 */

import { eq, inArray } from "drizzle-orm";
import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline/promises";
import { getDb } from "../lib/db/connection";
import { articles, type NewArticle } from "../lib/db/article-schema";

// Configuration
const BACKUP_FILE = path.join(
  process.cwd(),
  "data/json/backup/news.json.backup-2025-08-19T06-02-32.737Z"
);
const BATCH_SIZE = 50;

// Backup article structure
interface BackupArticle {
  id: string;
  slug: string;
  title: string;
  content: string;
  summary?: string;
  source: string;
  source_url: string;
  tags?: string[];
  tool_mentions?: string[];
  created_at: string;
  updated_at: string;
  date: string;
}

interface BackupData {
  articles: BackupArticle[];
}

/**
 * Transform backup article to database schema
 */
function transformArticle(article: BackupArticle): NewArticle {
  return {
    id: article.id,
    slug: article.slug,
    title: article.title,
    summary: article.summary || null,
    content: article.content,
    ingestionType: "url",
    sourceUrl: article.source_url || null,
    sourceName: article.source || null,
    tags: article.tags || [],
    toolMentions: article.tool_mentions || [],
    publishedDate: new Date(article.date),
    ingestedAt: new Date(article.created_at),
    status: "active",
    createdAt: new Date(article.created_at),
    updatedAt: new Date(article.updated_at),
  };
}

/**
 * Get existing article IDs and slugs from database
 */
async function getExistingArticles(db: ReturnType<typeof getDb>): Promise<{
  ids: Set<string>;
  slugs: Set<string>;
}> {
  if (!db) {
    throw new Error("Database connection required");
  }

  const existingArticles = await db.select({ id: articles.id, slug: articles.slug }).from(articles);

  return {
    ids: new Set(existingArticles.map((a) => a.id)),
    slugs: new Set(existingArticles.map((a) => a.slug)),
  };
}

/**
 * Batch insert articles with transaction support
 */
async function batchInsertArticles(
  db: ReturnType<typeof getDb>,
  articlesToInsert: NewArticle[],
  onProgress: (inserted: number, total: number) => void
): Promise<{ inserted: number; errors: Array<{ article: string; error: string }> }> {
  if (!db) {
    throw new Error("Database connection required");
  }

  let totalInserted = 0;
  const errors: Array<{ article: string; error: string }> = [];

  // Process in batches
  for (let i = 0; i < articlesToInsert.length; i += BATCH_SIZE) {
    const batch = articlesToInsert.slice(i, i + BATCH_SIZE);

    try {
      // Insert batch
      await db.insert(articles).values(batch);
      totalInserted += batch.length;
      onProgress(totalInserted, articlesToInsert.length);
    } catch (error) {
      // If batch fails, try individual inserts to identify problematic records
      for (const article of batch) {
        try {
          await db.insert(articles).values(article);
          totalInserted++;
          onProgress(totalInserted, articlesToInsert.length);
        } catch (individualError) {
          errors.push({
            article: article.title || article.slug,
            error: individualError instanceof Error ? individualError.message : String(individualError),
          });
        }
      }
    }
  }

  return { inserted: totalInserted, errors };
}

/**
 * Display sample articles
 */
function displaySampleArticles(articles: BackupArticle[], count: number = 5): void {
  const sample = articles.slice(0, count);
  sample.forEach((article, index) => {
    const date = new Date(article.date).toISOString().split("T")[0];
    console.log(`   ${index + 1}. "${article.title}" (${article.source}, ${date})`);
  });
  if (articles.length > count) {
    console.log(`   ... and ${articles.length - count} more`);
  }
}

/**
 * Prompt user for confirmation
 */
async function promptConfirmation(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = await rl.question(`${message} (yes/no): `);
    return answer.toLowerCase() === "yes" || answer.toLowerCase() === "y";
  } finally {
    rl.close();
  }
}

/**
 * Main restoration function
 */
async function restoreArticles(dryRun: boolean = false): Promise<void> {
  console.log("🔄 ARTICLE RESTORATION FROM BACKUP");
  console.log("═══════════════════════════════════════\n");

  // Load backup file
  console.log("📂 Loading backup file...");
  console.log(`   ${BACKUP_FILE}`);

  let backupData: BackupData;
  try {
    const fileContent = await fs.readFile(BACKUP_FILE, "utf-8");
    backupData = JSON.parse(fileContent);
  } catch (error) {
    console.error("❌ Failed to load backup file:", error);
    process.exit(1);
  }

  console.log(`   Found ${backupData.articles.length} articles in backup\n`);

  // Connect to database
  console.log("📊 Checking current database state...");
  const db = getDb();
  if (!db) {
    console.error("❌ Database connection required");
    process.exit(1);
  }

  // Get existing articles
  const existing = await getExistingArticles(db);
  console.log(`   Existing articles: ${existing.ids.size}`);

  // Filter out existing articles (by ID or slug)
  const backupArticles = backupData.articles;
  const newArticles = backupArticles.filter(
    (article) => !existing.ids.has(article.id) && !existing.slugs.has(article.slug)
  );

  const duplicateCount = backupArticles.length - newArticles.length;
  console.log(`   Articles to restore: ${newArticles.length}`);
  if (duplicateCount > 0) {
    console.log(`   Duplicates skipped: ${duplicateCount}`);
  }
  console.log();

  // Show breakdown of what's being kept vs restored
  if (existing.ids.size > 0) {
    console.log("📋 Database comparison:");
    console.log(`   Current articles (will be kept): ${existing.ids.size}`);
    console.log(`   Backup articles (to be added): ${newArticles.length}`);
    console.log(`   Total after restoration: ${existing.ids.size + newArticles.length}`);
    console.log();
  }

  if (newArticles.length === 0) {
    console.log("✅ No new articles to restore. Database is up to date.");
    return;
  }

  // Display preview
  console.log("✅ Preview of articles to restore (first 5):");
  displaySampleArticles(newArticles);
  console.log();

  // Dry run mode
  if (dryRun) {
    console.log("🔍 DRY RUN MODE - No changes will be made");
    console.log(`   Would restore ${newArticles.length} articles`);
    console.log("\nRun without --dry-run flag to perform restoration.");
    return;
  }

  // Confirm restoration
  const confirmed = await promptConfirmation("\nProceed with restoration?");
  if (!confirmed) {
    console.log("❌ Restoration cancelled by user");
    return;
  }

  console.log();

  // Transform articles
  console.log("🔄 Transforming articles to database format...");
  const articlesToInsert = newArticles.map(transformArticle);
  console.log("   Transformation complete\n");

  // Insert articles
  console.log("🔄 Restoring articles...");
  const startTime = Date.now();

  const result = await batchInsertArticles(db, articlesToInsert, (inserted, total) => {
    if (inserted % BATCH_SIZE === 0 || inserted === total) {
      console.log(`   [${inserted}/${total}] Restored ${inserted} articles...`);
    }
  });

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log();

  // Display summary
  console.log("✅ RESTORATION SUMMARY");
  console.log("═══════════════════════════════════════");
  console.log(`   Before: ${existing.ids.size} articles`);
  console.log(`   After: ${existing.ids.size + result.inserted} articles`);
  console.log(`   Restored: ${result.inserted} articles`);
  console.log(`   Errors: ${result.errors.length}`);
  console.log(`   Duration: ${duration}s`);
  console.log();

  // Display errors if any
  if (result.errors.length > 0) {
    console.log("⚠️  ERRORS ENCOUNTERED:");
    result.errors.slice(0, 10).forEach((error) => {
      console.log(`   - ${error.article}: ${error.error}`);
    });
    if (result.errors.length > 10) {
      console.log(`   ... and ${result.errors.length - 10} more errors`);
    }
    console.log();
  }

  // Verify restoration
  console.log("🔍 Verifying restoration...");
  const finalCount = await db.select({ id: articles.id }).from(articles);
  console.log(`   Total articles in database: ${finalCount.length}`);
  console.log();

  // Display sample of restored articles
  console.log("📚 Sample of restored articles:");
  const recentArticles = await db
    .select({
      title: articles.title,
      sourceName: articles.sourceName,
      publishedDate: articles.publishedDate,
    })
    .from(articles)
    .orderBy(articles.ingestedAt)
    .limit(5);

  recentArticles.forEach((article) => {
    const date = article.publishedDate
      ? new Date(article.publishedDate).toISOString().split("T")[0]
      : "Unknown";
    console.log(`   - "${article.title}" (${article.sourceName}, ${date})`);
  });

  console.log();
  console.log("✅ Restoration complete!");
}

// CLI handling
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  try {
    await restoreArticles(dryRun);
    process.exit(0);
  } catch (error) {
    console.error("❌ Restoration failed:", error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { restoreArticles };
