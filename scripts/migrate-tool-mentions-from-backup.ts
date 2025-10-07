#!/usr/bin/env tsx

/**
 * Migration Script: Tool Mentions from Backup
 * Migrates tool_mentions from backup string arrays to current ValidatedToolMention object arrays
 *
 * Usage:
 *   npm run tsx scripts/migrate-tool-mentions-from-backup.ts [options]
 *
 * Options:
 *   --dry-run          Preview changes without applying them
 *   --auto-confirm     Skip confirmation prompts
 *
 * Examples:
 *   tsx scripts/migrate-tool-mentions-from-backup.ts --dry-run
 *   tsx scripts/migrate-tool-mentions-from-backup.ts --auto-confirm
 */

import { eq, sql } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { articles } from "@/lib/db/article-schema";
import { getDb } from "@/lib/db/connection";
import type { ValidatedToolMention } from "@/lib/types/article-analysis";

// Color codes for console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
};

function log(message: string, type: "info" | "success" | "warning" | "error" = "info") {
  const timestamp = new Date().toISOString();
  const colorMap = {
    info: colors.cyan,
    success: colors.green,
    warning: colors.yellow,
    error: colors.red,
  };
  console.log(`${colorMap[type]}[${timestamp}] ${message}${colors.reset}`);
}

// Parse command-line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const autoConfirm = args.includes("--auto-confirm");

// Backup file path
const BACKUP_FILE_PATH = path.join(
  process.cwd(),
  "data/json/backup/news.json.backup-2025-08-19T06-02-32.737Z"
);

interface BackupArticle {
  id: string;
  slug: string;
  title: string;
  tool_mentions?: string[];
  toolMentions?: string[];
  company_mentions?: string[];
  companyMentions?: string[];
}

interface BackupData {
  articles: BackupArticle[];
}

interface MigrationResult {
  articleId: string;
  slug: string;
  title: string;
  backupToolMentions: string[];
  transformedToolMentions: ValidatedToolMention[];
  success: boolean;
  error?: string;
}

/**
 * Transform string array to ValidatedToolMention objects
 */
function transformToolMentions(toolMentions: string[]): ValidatedToolMention[] {
  return toolMentions.map((toolName) => ({
    name: toolName,
    relevance: 0.5,
    sentiment: 0,
    context: "Restored from backup",
  }));
}

/**
 * Prompt user for confirmation
 */
async function promptConfirmation(message: string): Promise<boolean> {
  if (autoConfirm) {
    log("Auto-confirm enabled, proceeding...", "info");
    return true;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${colors.yellow}${message} (y/n): ${colors.reset}`, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

/**
 * Load backup data from JSON file
 */
function loadBackupData(): BackupData {
  log(`Loading backup from: ${BACKUP_FILE_PATH}`, "info");

  if (!fs.existsSync(BACKUP_FILE_PATH)) {
    throw new Error(`Backup file not found: ${BACKUP_FILE_PATH}`);
  }

  const fileContent = fs.readFileSync(BACKUP_FILE_PATH, "utf-8");
  const data = JSON.parse(fileContent);

  if (!data.articles || !Array.isArray(data.articles)) {
    throw new Error("Invalid backup format: missing articles array");
  }

  log(`Loaded ${data.articles.length} articles from backup`, "success");
  return data;
}

/**
 * Check if tool_mentions contains strings (needs migration) or objects (already migrated)
 */
function needsMigration(toolMentions: any): boolean {
  if (!Array.isArray(toolMentions) || toolMentions.length === 0) {
    return false;
  }

  // Check if first element is a string (needs migration)
  return typeof toolMentions[0] === "string";
}

/**
 * Find articles with string-based tool_mentions in database
 */
async function findArticlesWithStringToolMentions(db: any): Promise<any[]> {
  log("Querying database for all articles with tool_mentions...", "info");

  // Get all articles with non-empty tool_mentions
  const result = await db
    .select({
      id: articles.id,
      slug: articles.slug,
      title: articles.title,
      toolMentions: articles.toolMentions,
    })
    .from(articles)
    .where(
      sql`jsonb_array_length(${articles.toolMentions}) > 0`
    );

  log(`Found ${result.length} articles with tool_mentions`, "info");

  // Filter to only those with string arrays (need migration)
  const needingMigration = result.filter((article) => needsMigration(article.toolMentions));

  log(`${needingMigration.length} articles have string-based tool_mentions (need migration)`, "success");
  return needingMigration;
}

/**
 * Transform database articles directly (no backup needed)
 */
function prepareArticlesForMigration(dbArticles: any[]): Map<string, any> {
  log("Preparing articles for migration...", "info");

  const articlesMap = new Map<string, any>();

  for (const dbArticle of dbArticles) {
    if (needsMigration(dbArticle.toolMentions)) {
      articlesMap.set(dbArticle.id, {
        id: dbArticle.id,
        slug: dbArticle.slug,
        title: dbArticle.title,
        tool_mentions: dbArticle.toolMentions, // These are the string arrays
      });
    }
  }

  log(`Prepared ${articlesMap.size} articles for migration`, "success");
  return articlesMap;
}

/**
 * Preview changes without applying
 */
function previewChanges(articlesMap: Map<string, any>) {
  console.log(`\n${colors.bright}${colors.blue}========================================`);
  console.log(`         Migration Preview (Dry Run)`);
  console.log(`========================================${colors.reset}\n`);

  if (articlesMap.size === 0) {
    log("No changes to preview. All articles already have object-based tool_mentions.", "warning");
    return;
  }

  let previewCount = 0;
  for (const [articleId, article] of articlesMap.entries()) {
    previewCount++;
    if (previewCount > 10) {
      console.log(`\n${colors.yellow}... and ${articlesMap.size - 10} more articles${colors.reset}\n`);
      break;
    }

    const toolMentions = article.tool_mentions || [];
    const transformed = transformToolMentions(toolMentions);

    console.log(`${colors.bright}Article ${previewCount}:${colors.reset}`);
    console.log(`  ID: ${colors.cyan}${articleId}${colors.reset}`);
    console.log(`  Slug: ${colors.cyan}${article.slug}${colors.reset}`);
    console.log(`  Title: ${colors.cyan}${article.title}${colors.reset}`);
    console.log(`  Current tool_mentions (${toolMentions.length} strings):`);
    toolMentions.forEach((tm: string) => console.log(`    - ${colors.magenta}${tm}${colors.reset}`));
    console.log(`  Transformed tool_mentions (${transformed.length} objects):`);
    transformed.forEach((tm) => {
      console.log(`    - ${colors.green}${tm.name}${colors.reset}`);
      console.log(`      relevance: ${tm.relevance}, sentiment: ${tm.sentiment}`);
      console.log(`      context: "${tm.context}"`);
    });
    console.log();
  }

  console.log(`${colors.bright}Total articles to migrate: ${colors.green}${articlesMap.size}${colors.reset}\n`);
}

/**
 * Migrate articles in batches
 */
async function migrateArticles(
  db: any,
  articlesMap: Map<string, any>
): Promise<MigrationResult[]> {
  const results: MigrationResult[] = [];
  const batchSize = 50;
  const articlesToMigrate = Array.from(articlesMap.entries());
  const totalBatches = Math.ceil(articlesToMigrate.length / batchSize);

  log(`Starting migration of ${articlesToMigrate.length} articles in ${totalBatches} batches...`, "info");

  for (let i = 0; i < totalBatches; i++) {
    const batch = articlesToMigrate.slice(i * batchSize, (i + 1) * batchSize);
    const batchNumber = i + 1;

    log(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} articles)...`, "info");

    for (const [articleId, article] of batch) {
      const toolMentions = article.tool_mentions || [];
      const transformedToolMentions = transformToolMentions(toolMentions);

      try {
        // Update the article with transformed tool_mentions
        await db
          .update(articles)
          .set({
            toolMentions: transformedToolMentions as any,
            updatedAt: new Date(),
          })
          .where(eq(articles.id, articleId));

        results.push({
          articleId,
          slug: article.slug,
          title: article.title,
          backupToolMentions: toolMentions,
          transformedToolMentions,
          success: true,
        });

        process.stdout.write(
          `\r  Progress: ${results.length}/${articlesToMigrate.length} (${Math.round((results.length / articlesToMigrate.length) * 100)}%)`
        );
      } catch (error) {
        results.push({
          articleId,
          slug: article.slug,
          title: article.title,
          backupToolMentions: toolMentions,
          transformedToolMentions,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });

        log(`\nError migrating article ${articleId}: ${error}`, "error");
      }
    }

    console.log(); // New line after progress
  }

  return results;
}

/**
 * Print migration summary
 */
function printSummary(results: MigrationResult[], isDryRun: boolean) {
  console.log(`\n${colors.bright}${colors.blue}========================================`);
  console.log(`           Migration Summary`);
  console.log(`========================================${colors.reset}\n`);

  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  const totalToolMentions = results.reduce((sum, r) => sum + r.backupToolMentions.length, 0);

  console.log(`${colors.bright}Results:${colors.reset}`);
  console.log(`  Total articles processed: ${colors.cyan}${results.length}${colors.reset}`);
  console.log(`  Successful migrations: ${colors.green}${successful}${colors.reset}`);
  console.log(`  Failed migrations: ${failed > 0 ? colors.red : colors.green}${failed}${colors.reset}`);
  console.log(`  Total tool mentions transformed: ${colors.cyan}${totalToolMentions}${colors.reset}`);
  console.log(`  Mode: ${isDryRun ? colors.yellow + "DRY RUN" : colors.green + "LIVE"}${colors.reset}\n`);

  if (failed > 0) {
    console.log(`${colors.red}Failed Articles:${colors.reset}`);
    results
      .filter((r) => !r.success)
      .forEach((r) => {
        console.log(`  - ${r.slug}`);
        console.log(`    Error: ${r.error}`);
      });
    console.log();
  }

  // Show sample of successful migrations
  if (successful > 0 && !isDryRun) {
    console.log(`${colors.bright}Sample Successful Migrations (first 5):${colors.reset}`);
    results
      .filter((r) => r.success)
      .slice(0, 5)
      .forEach((r, idx) => {
        console.log(`\n  ${idx + 1}. ${colors.cyan}${r.title}${colors.reset}`);
        console.log(`     Slug: ${r.slug}`);
        console.log(`     Tool mentions: ${r.backupToolMentions.join(", ")}`);
        console.log(`     Transformed: ${r.transformedToolMentions.length} objects with:`);
        console.log(`       - relevance: 0.5`);
        console.log(`       - sentiment: 0 (neutral)`);
        console.log(`       - context: "Restored from backup"`);
      });
    console.log();
  }
}

/**
 * Main migration function
 */
async function main() {
  console.log(`${colors.bright}${colors.blue}========================================`);
  console.log(`    Tool Mentions Migration`);
  console.log(`    String Arrays → Object Arrays`);
  console.log(`========================================${colors.reset}\n`);

  if (isDryRun) {
    log("Running in DRY RUN mode - no changes will be applied", "warning");
  }

  if (autoConfirm) {
    log("Auto-confirm enabled - skipping confirmation prompts", "info");
  }

  try {
    // Connect to database
    log("Connecting to database...", "info");
    const db = getDb();
    if (!db) {
      throw new Error("Failed to connect to database");
    }
    log("Database connection established", "success");

    // Find articles with string-based tool_mentions
    const dbArticles = await findArticlesWithStringToolMentions(db);

    if (dbArticles.length === 0) {
      log("No articles with string-based tool_mentions found in database", "success");
      log("All articles already have object-based tool_mentions!", "success");
      return;
    }

    // Prepare articles for migration
    const articlesMap = prepareArticlesForMigration(dbArticles);

    if (articlesMap.size === 0) {
      log("No articles need migration", "success");
      return;
    }

    // Preview changes
    previewChanges(articlesMap);

    if (isDryRun) {
      log("Dry run complete. Use without --dry-run to apply changes.", "info");
      return;
    }

    // Confirm before proceeding
    const confirmed = await promptConfirmation(
      `Proceed with migrating ${articlesMap.size} articles?`
    );

    if (!confirmed) {
      log("Migration cancelled by user", "warning");
      return;
    }

    // Perform migration
    const results = await migrateArticles(db, articlesMap);

    // Print summary
    printSummary(results, isDryRun);

    const failed = results.filter((r) => !r.success).length;
    if (failed > 0) {
      log("Migration completed with errors. Please review the logs.", "warning");
      process.exit(1);
    } else {
      log("Migration completed successfully!", "success");
    }
  } catch (error) {
    log(`Fatal error during migration: ${error}`, "error");
    if (error instanceof Error) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the migration
main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
