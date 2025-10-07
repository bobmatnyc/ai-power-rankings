/**
 * Fix Article Dates Script
 * Restores correct article dates from backup file
 *
 * Usage:
 *   tsx scripts/fix-article-dates.ts                # Interactive mode with confirmation
 *   tsx scripts/fix-article-dates.ts --dry-run      # Preview changes without updating
 *   tsx scripts/fix-article-dates.ts --auto-confirm # Skip confirmation prompt
 */

import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { eq, sql } from "drizzle-orm";
import { articles } from "@/lib/db/article-schema";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const autoConfirm = args.includes('--auto-confirm');

interface BackupArticle {
  id: string;
  slug: string;
  title: string;
  date: string;
  created_at?: string;
  updated_at?: string;
}

interface DatabaseArticle {
  id: string;
  slug: string;
  title: string;
  publishedDate: Date | null;
  createdAt: Date | null;
}

interface DateUpdate {
  id: string;
  slug: string;
  title: string;
  currentDate: Date | null;
  correctDate: Date;
  source: 'backup' | 'manual';
}

interface DateStats {
  min: Date;
  max: Date;
  count: number;
}

/**
 * Load backup articles from JSON file
 */
function loadBackupArticles(): Map<string, BackupArticle> {
  const backupPath = path.join(
    process.cwd(),
    'data/json/backup/news.json.backup-2025-08-19T06-02-32.737Z'
  );

  console.log(`📂 Loading backup from: ${backupPath}`);

  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup file not found: ${backupPath}`);
  }

  const backupContent = fs.readFileSync(backupPath, 'utf-8');
  const backupData = JSON.parse(backupContent);

  // Handle different backup formats
  const articlesArray: BackupArticle[] = backupData.articles || backupData;

  if (!Array.isArray(articlesArray)) {
    throw new Error('Invalid backup format: expected array of articles');
  }

  console.log(`   Found ${articlesArray.length} articles in backup`);

  // Create lookup maps by ID and slug for flexibility
  const backupMap = new Map<string, BackupArticle>();

  for (const article of articlesArray) {
    if (article.id) {
      backupMap.set(article.id, article);
    }
    if (article.slug) {
      backupMap.set(article.slug, article);
    }
  }

  return backupMap;
}

/**
 * Parse and validate date from backup
 */
function parseBackupDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return null;
    }

    // Validate date is reasonable (between 2018 and 2026)
    // Historical articles from 2018-2023 are valid
    const year = date.getFullYear();
    if (year < 2018 || year > 2026) {
      console.warn(`   ⚠️  Date outside expected range: ${dateStr} (${year})`);
      return null;
    }

    return date;
  } catch (error) {
    console.warn(`   ⚠️  Failed to parse date: ${dateStr}`);
    return null;
  }
}

/**
 * Calculate date statistics
 */
function calculateDateStats(dates: Date[]): DateStats | null {
  if (dates.length === 0) return null;

  const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime());

  return {
    min: sortedDates[0],
    max: sortedDates[sortedDates.length - 1],
    count: dates.length
  };
}

/**
 * Format date for display
 */
function formatDate(date: Date | null): string {
  if (!date) return 'No date';
  return date.toISOString().split('T')[0]; // YYYY-MM-DD format
}

/**
 * Prompt user for confirmation
 */
function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

/**
 * Create backup of current dates
 */
async function createCurrentDatesBackup(articles: DatabaseArticle[]) {
  const backupData = articles.map(a => ({
    id: a.id,
    slug: a.slug,
    title: a.title,
    published_date: a.publishedDate?.toISOString() || null,
  }));

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(
    process.cwd(),
    `data/json/backup/article-dates-backup-${timestamp}.json`
  );

  // Ensure backup directory exists
  const backupDir = path.dirname(backupPath);
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
  console.log(`   ✅ Current dates backed up to: ${backupPath}`);

  return backupPath;
}

/**
 * Main fix dates function
 */
async function fixArticleDates() {
  console.log("📅 ARTICLE DATE FIXING SCRIPT");
  console.log("═".repeat(100));

  if (isDryRun) {
    console.log("\n🔍 DRY RUN MODE - No changes will be made\n");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  const db = drizzle(pool);

  try {
    // Step 1: Load backup articles
    console.log("\n📚 Step 1: Loading backup articles...");
    const backupMap = loadBackupArticles();

    // Step 2: Fetch all database articles
    console.log("\n📊 Step 2: Fetching articles from database...");
    const dbArticles = await db
      .select({
        id: articles.id,
        slug: articles.slug,
        title: articles.title,
        publishedDate: articles.publishedDate,
        createdAt: articles.createdAt,
      })
      .from(articles);

    console.log(`   Found ${dbArticles.length} articles in database`);

    // Step 3: Match articles and identify date updates needed
    console.log("\n🔍 Step 3: Matching articles with backup...");

    const updates: DateUpdate[] = [];
    const notFoundInBackup: DatabaseArticle[] = [];
    const alreadyCorrect: DatabaseArticle[] = [];
    const invalidDates: Array<{ article: DatabaseArticle; backupDate: string }> = [];

    for (const dbArticle of dbArticles) {
      // Try to find in backup by ID first, then by slug
      let backupArticle = backupMap.get(dbArticle.id);
      if (!backupArticle && dbArticle.slug) {
        backupArticle = backupMap.get(dbArticle.slug);
      }

      if (!backupArticle) {
        notFoundInBackup.push(dbArticle);
        continue;
      }

      // Parse backup date
      const backupDate = parseBackupDate(backupArticle.date);

      if (!backupDate) {
        invalidDates.push({ article: dbArticle, backupDate: backupArticle.date });
        continue;
      }

      // Check if date needs updating
      const currentDate = dbArticle.publishedDate;
      const needsUpdate = !currentDate ||
        currentDate.toISOString() !== backupDate.toISOString();

      if (needsUpdate) {
        updates.push({
          id: dbArticle.id,
          slug: dbArticle.slug,
          title: dbArticle.title,
          currentDate: currentDate,
          correctDate: backupDate,
          source: 'backup'
        });
      } else {
        alreadyCorrect.push(dbArticle);
      }
    }

    console.log(`   ✅ ${updates.length} articles need date updates`);
    console.log(`   ✅ ${alreadyCorrect.length} articles already have correct dates`);
    console.log(`   ⚠️  ${notFoundInBackup.length} articles not found in backup`);
    console.log(`   ⚠️  ${invalidDates.length} articles have invalid dates in backup`);

    // Step 4: Display date range analysis
    console.log("\n📈 Step 4: Date Range Analysis");
    console.log("─".repeat(100));

    const currentDates = dbArticles
      .map(a => a.publishedDate)
      .filter((d): d is Date => d !== null);

    const correctDates = updates.map(u => u.correctDate);

    const currentStats = calculateDateStats(currentDates);
    const newStats = calculateDateStats(correctDates);

    if (currentStats) {
      console.log(`\n   Current dates in database:`);
      console.log(`      Range: ${formatDate(currentStats.min)} to ${formatDate(currentStats.max)}`);
      console.log(`      Count: ${currentStats.count} articles with dates`);
    }

    if (newStats) {
      console.log(`\n   Correct dates from backup:`);
      console.log(`      Range: ${formatDate(newStats.min)} to ${formatDate(newStats.max)}`);
      console.log(`      Count: ${newStats.count} dates to update`);
    }

    // Step 5: Show sample updates
    if (updates.length > 0) {
      console.log("\n📋 Sample Date Updates (first 10):");
      console.log("─".repeat(100));

      const sampleSize = Math.min(10, updates.length);
      for (let i = 0; i < sampleSize; i++) {
        const update = updates[i];
        console.log(`\n${i + 1}. ${update.title}`);
        console.log(`   Slug: ${update.slug}`);
        console.log(`   Current: ${formatDate(update.currentDate)}`);
        console.log(`   Correct: ${formatDate(update.correctDate)}`);
      }

      if (updates.length > sampleSize) {
        console.log(`\n   ... and ${updates.length - sampleSize} more`);
      }
    }

    // Step 6: Show articles not found in backup
    if (notFoundInBackup.length > 0) {
      console.log("\n⚠️  Articles NOT Found in Backup (need manual review):");
      console.log("─".repeat(100));

      notFoundInBackup.forEach((article, index) => {
        console.log(`\n${index + 1}. ${article.title}`);
        console.log(`   ID: ${article.id}`);
        console.log(`   Slug: ${article.slug}`);
        console.log(`   Current Date: ${formatDate(article.publishedDate)}`);
      });
    }

    // Step 7: Show articles with invalid backup dates
    if (invalidDates.length > 0) {
      console.log("\n⚠️  Articles with Invalid Backup Dates:");
      console.log("─".repeat(100));

      invalidDates.forEach(({ article, backupDate }, index) => {
        console.log(`\n${index + 1}. ${article.title}`);
        console.log(`   Slug: ${article.slug}`);
        console.log(`   Current Date: ${formatDate(article.publishedDate)}`);
        console.log(`   Invalid Backup Date: ${backupDate}`);
      });
    }

    // Step 8: Summary
    console.log("\n\n📝 UPDATE SUMMARY:");
    console.log("─".repeat(100));
    console.log(`   Total articles in database: ${dbArticles.length}`);
    console.log(`   Articles to update: ${updates.length}`);
    console.log(`   Already correct: ${alreadyCorrect.length}`);
    console.log(`   Not found in backup: ${notFoundInBackup.length}`);
    console.log(`   Invalid backup dates: ${invalidDates.length}`);

    if (updates.length === 0) {
      console.log("\n✨ No date updates needed! All articles have correct dates.");
      return;
    }

    // Step 9: Dry run exit
    if (isDryRun) {
      console.log("\n✅ DRY RUN COMPLETE - No changes were made");
      console.log("\nTo actually update dates, run without --dry-run flag");
      console.log("\n" + "═".repeat(100));
      return;
    }

    // Step 10: Confirmation
    console.log("\n\n⚠️  This will update dates for " + updates.length + " articles");

    let confirmed = autoConfirm;
    if (!autoConfirm) {
      confirmed = await askConfirmation(`\nProceed with date updates? (yes/no): `);
    }

    if (!confirmed) {
      console.log("\n❌ Update cancelled by user");
      return;
    }

    // Step 11: Create backup of current dates
    console.log("\n💾 Creating backup of current dates...");
    const backupPath = await createCurrentDatesBackup(dbArticles);

    // Step 12: Perform updates in transaction
    console.log("\n📅 Updating article dates...");
    const startTime = Date.now();

    let updatedCount = 0;

    await db.transaction(async (tx) => {
      for (const update of updates) {
        await tx
          .update(articles)
          .set({
            publishedDate: update.correctDate,
            updatedAt: new Date()
          })
          .where(eq(articles.id, update.id));

        updatedCount++;

        // Progress indicator every 10 articles
        if (updatedCount % 10 === 0) {
          console.log(`   Updated ${updatedCount}/${updates.length} articles...`);
        }
      }
    });

    const duration = Date.now() - startTime;

    // Step 13: Verify updates
    console.log("\n✅ Date updates completed successfully!");
    console.log(`   Duration: ${duration}ms`);
    console.log(`   Articles updated: ${updatedCount}`);

    // Verify by checking date range again
    const verifyArticles = await db
      .select({
        publishedDate: articles.publishedDate,
      })
      .from(articles)
      .where(sql`${articles.publishedDate} IS NOT NULL`);

    const verifyDates = verifyArticles
      .map(a => a.publishedDate)
      .filter((d): d is Date => d !== null);

    const verifyStats = calculateDateStats(verifyDates);

    if (verifyStats) {
      console.log("\n📊 Verification - Updated date range:");
      console.log(`   Range: ${formatDate(verifyStats.min)} to ${formatDate(verifyStats.max)}`);
      console.log(`   Count: ${verifyStats.count} articles with dates`);
    }

    // Step 14: Final summary
    console.log("\n\n📋 UPDATE AUDIT LOG:");
    console.log("─".repeat(100));
    console.log(`   Timestamp: ${new Date().toISOString()}`);
    console.log(`   Articles updated: ${updatedCount}`);
    console.log(`   Backup location: ${backupPath}`);
    console.log(`   Source: news.json.backup-2025-08-19T06-02-32.737Z`);

    if (notFoundInBackup.length > 0) {
      console.log(`\n   ⚠️  ${notFoundInBackup.length} articles need manual review (not in backup)`);
    }

    console.log("\n\n" + "═".repeat(100));
    console.log("✨ DATE FIX COMPLETE!");

  } catch (error) {
    console.error("\n❌ ERROR during date fix:", error);
    if (error instanceof Error) {
      console.error("   Message:", error.message);
      console.error("   Stack:", error.stack?.substring(0, 500));
    }
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the script
fixArticleDates().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
