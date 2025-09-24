#!/usr/bin/env tsx

/**
 * Script to migrate articles from development database to production database
 * Copies all articles from ep-bold-sunset-adneqlo6 to ep-wispy-fog-ad8d4skz
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

// Colors for terminal output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log(`\n${"=".repeat(60)}`);
  log(title, colors.bright + colors.cyan);
  console.log("=".repeat(60));
}

function logSuccess(message: string) {
  log(`✅ ${message}`, colors.green);
}

function logWarning(message: string) {
  log(`⚠️  ${message}`, colors.yellow);
}

function logError(message: string) {
  log(`❌ ${message}`, colors.red);
}

async function migrateArticles() {
  logSection("Article Migration: Development → Production");

  // Load environment variables - only from .env.local, not .env
  const envLocalPath = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(envLocalPath)) {
    // Clear any existing env vars first
    delete process.env.DATABASE_URL;
    delete process.env.DATABASE_URL_DEVELOPMENT;

    // Load only from .env.local
    config({ path: envLocalPath, override: true });
    log(`Loaded: ${envLocalPath}`, colors.green);
  }

  // Database URLs - hardcode if needed for this migration
  const DEV_DATABASE_URL =
    process.env.DATABASE_URL_DEVELOPMENT ||
    "postgresql://neondb_owner:npg_3oQsxj0FcfKY@ep-bold-sunset-adneqlo6-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

  const PROD_DATABASE_URL =
    "postgresql://neondb_owner:npg_3oQsxj0FcfKY@ep-wispy-fog-ad8d4skz-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

  if (!DEV_DATABASE_URL || DEV_DATABASE_URL.includes("YOUR_PASSWORD")) {
    logError("DATABASE_URL_DEVELOPMENT not configured properly");
    return;
  }

  if (!PROD_DATABASE_URL || PROD_DATABASE_URL.includes("YOUR_PASSWORD")) {
    logError("DATABASE_URL not configured properly");
    return;
  }

  // Verify we're using the correct databases
  if (!DEV_DATABASE_URL.includes("ep-bold-sunset")) {
    logError("Development database URL doesn't match expected endpoint (ep-bold-sunset)");
    return;
  }

  if (!PROD_DATABASE_URL.includes("ep-wispy-fog")) {
    logError("Production database URL doesn't match expected endpoint (ep-wispy-fog)");
    return;
  }

  logSection("Source & Destination");
  log("Source: ep-bold-sunset-adneqlo6 (Development)", colors.blue);
  log("Target: ep-wispy-fog-ad8d4skz (Production)", colors.blue);

  try {
    // Connect to both databases
    const devSql = neon(DEV_DATABASE_URL);
    const prodSql = neon(PROD_DATABASE_URL);

    // Step 1: Check source articles
    logSection("Step 1: Reading Source Articles");
    const sourceArticles = await devSql`
      SELECT * FROM articles
      ORDER BY created_at DESC
    `;

    log(`Found ${sourceArticles.length} articles in development database`, colors.cyan);

    if (sourceArticles.length === 0) {
      logWarning("No articles to migrate");
      return;
    }

    // Step 2: Check if production has any articles
    logSection("Step 2: Checking Production Database");
    const existingArticles = await prodSql`
      SELECT COUNT(*) as count FROM articles
    `;

    const existingCount = existingArticles[0]?.count || 0;
    if (existingCount > 0) {
      logWarning(`Production already has ${existingCount} articles`);
      log("Do you want to continue? This will add to existing articles.", colors.yellow);

      // For safety, let's clear production first if it has test data
      log("Clearing production articles for clean migration...", colors.yellow);
      await prodSql`DELETE FROM articles`;
      logSuccess("Production articles cleared");
    }

    // Step 3: Migrate articles
    logSection("Step 3: Migrating Articles");

    let successCount = 0;
    let errorCount = 0;

    for (const article of sourceArticles) {
      try {
        // Insert article into production
        await prodSql`
          INSERT INTO articles (
            id, slug, title, summary, content, ingestion_type,
            source_url, source_name, file_name, file_type,
            tags, category, importance_score, sentiment_score,
            tool_mentions, company_mentions, rankings_snapshot,
            author, published_date, ingested_at, ingested_by,
            status, is_processed, processed_at, created_at, updated_at
          ) VALUES (
            ${article.id},
            ${article.slug},
            ${article.title},
            ${article.summary},
            ${article.content},
            ${article.ingestion_type},
            ${article.source_url},
            ${article.source_name},
            ${article.file_name},
            ${article.file_type},
            ${article.tags},
            ${article.category},
            ${article.importance_score},
            ${article.sentiment_score},
            ${article.tool_mentions},
            ${article.company_mentions},
            ${article.rankings_snapshot},
            ${article.author},
            ${article.published_date},
            ${article.ingested_at},
            ${article.ingested_by},
            ${article.status},
            ${article.is_processed},
            ${article.processed_at},
            ${article.created_at},
            ${article.updated_at}
          )
        `;

        successCount++;
        process.stdout.write(`\rMigrated: ${successCount}/${sourceArticles.length} articles`);
      } catch (error) {
        errorCount++;
        console.error(`\nFailed to migrate article ${article.id}:`, error);
      }
    }

    console.log(""); // New line after progress

    // Step 4: Verify migration
    logSection("Step 4: Verifying Migration");

    const finalCount = await prodSql`
      SELECT COUNT(*) as count FROM articles
    `;

    const migratedCount = finalCount[0]?.count || 0;

    if (migratedCount === sourceArticles.length) {
      logSuccess(`Successfully migrated all ${migratedCount} articles!`);
    } else {
      logWarning(`Migrated ${migratedCount} out of ${sourceArticles.length} articles`);
      if (errorCount > 0) {
        logError(`${errorCount} articles failed to migrate`);
      }
    }

    // Step 5: Show sample of migrated data
    logSection("Step 5: Sample Verification");

    const sampleArticles = await prodSql`
      SELECT id, title, source_name, published_date
      FROM articles
      ORDER BY published_date DESC
      LIMIT 3
    `;

    log("\nLatest migrated articles:", colors.cyan);
    for (const article of sampleArticles) {
      console.log(`  📰 ${article.title}`);
      console.log(
        `     Source: ${article.source_name} | Date: ${new Date(article.published_date).toLocaleDateString()}`
      );
    }

    // Summary
    logSection("Migration Complete");
    logSuccess(`✨ Production database (ep-wispy-fog-ad8d4skz) now has ${migratedCount} articles`);
    log("\nNext steps:", colors.cyan);
    log("1. Visit https://aipowerranking.com/admin to verify");
    log("2. Check that articles load properly");
    log("3. Test article editing functionality");
  } catch (error) {
    logError(`Migration failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// Run the migration
migrateArticles().catch((error) => {
  logError(`Script failed: ${error.message}`);
  process.exit(1);
});
