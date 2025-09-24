#!/usr/bin/env tsx

/**
 * Fixed migration script that handles JSON fields properly
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

// Helper to ensure JSON fields are properly formatted
function ensureJsonField(value: any): any {
  if (value === null || value === undefined) {
    return null;
  }

  // If it's already an object/array, stringify it for the query
  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  // If it's a string, try to parse and re-stringify to ensure validity
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return JSON.stringify(parsed);
    } catch {
      // If parsing fails, return null instead of invalid JSON
      return null;
    }
  }

  return null;
}

async function migrateArticles() {
  logSection("Article Migration: Development → Production (Fixed)");

  // Load environment variables
  const envLocalPath = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(envLocalPath)) {
    delete process.env.DATABASE_URL;
    delete process.env.DATABASE_URL_DEVELOPMENT;
    config({ path: envLocalPath, override: true });
    log(`Loaded: ${envLocalPath}`, colors.green);
  }

  // Database URLs
  const DEV_DATABASE_URL =
    "postgresql://neondb_owner:npg_3oQsxj0FcfKY@ep-bold-sunset-adneqlo6-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
  const PROD_DATABASE_URL =
    "postgresql://neondb_owner:npg_3oQsxj0FcfKY@ep-wispy-fog-ad8d4skz-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

  logSection("Source & Destination");
  log("Source: ep-bold-sunset-adneqlo6 (Development)", colors.blue);
  log("Target: ep-wispy-fog-ad8d4skz (Production)", colors.blue);

  try {
    // Connect to both databases
    const devSql = neon(DEV_DATABASE_URL);
    const prodSql = neon(PROD_DATABASE_URL);

    // Step 1: Get articles not yet migrated
    logSection("Step 1: Identifying Articles to Migrate");

    // Get IDs of articles already in production
    const existingInProd = await prodSql`
      SELECT id FROM articles
    `;
    const existingIds = new Set(existingInProd.map((a) => a.id));

    // Get articles from development that aren't in production
    const sourceArticles = await devSql`
      SELECT * FROM articles
      ORDER BY created_at DESC
    `;

    const articlesToMigrate = sourceArticles.filter((a) => !existingIds.has(a.id));

    log(`Found ${sourceArticles.length} total articles in development`, colors.cyan);
    log(`Already migrated: ${existingIds.size}`, colors.cyan);
    log(`To migrate: ${articlesToMigrate.length}`, colors.cyan);

    if (articlesToMigrate.length === 0) {
      logSuccess("All articles already migrated!");
      return;
    }

    // Step 2: Migrate articles with fixed JSON handling
    logSection("Step 2: Migrating Articles with Fixed JSON");

    let successCount = 0;
    let errorCount = 0;
    const errors: { id: string; title: string; error: string }[] = [];

    for (const article of articlesToMigrate) {
      try {
        // Fix JSON fields
        const toolMentions = ensureJsonField(article.tool_mentions);
        const companyMentions = ensureJsonField(article.company_mentions);
        const rankingsSnapshot = ensureJsonField(article.rankings_snapshot);

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
            ${toolMentions}::jsonb,
            ${companyMentions}::jsonb,
            ${rankingsSnapshot}::jsonb,
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
        process.stdout.write(`\rMigrated: ${successCount}/${articlesToMigrate.length} articles`);
      } catch (error) {
        errorCount++;
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push({
          id: article.id,
          title: article.title.substring(0, 50),
          error: errorMsg.substring(0, 100),
        });
      }
    }

    console.log(""); // New line after progress

    // Step 3: Verify migration
    logSection("Step 3: Verifying Migration");

    const finalCount = await prodSql`
      SELECT COUNT(*) as count FROM articles
    `;

    const totalInProd = finalCount[0]?.count || 0;

    if (successCount > 0) {
      logSuccess(`Successfully migrated ${successCount} new articles!`);
    }
    if (errorCount > 0) {
      logWarning(`Failed to migrate ${errorCount} articles`);
      console.log("\nFailed articles:");
      for (const err of errors.slice(0, 5)) {
        console.log(`  - ${err.title}...`);
        console.log(`    Error: ${err.error}`);
      }
      if (errors.length > 5) {
        console.log(`  ... and ${errors.length - 5} more`);
      }
    }

    log(`\nTotal articles now in production: ${totalInProd}`, colors.cyan);

    // Step 4: Show sample of all data
    logSection("Step 4: Sample Verification");

    const sampleArticles = await prodSql`
      SELECT id, title, source_name, published_date
      FROM articles
      ORDER BY published_date DESC
      LIMIT 3
    `;

    log("\nLatest articles in production:", colors.cyan);
    for (const article of sampleArticles) {
      console.log(`  📰 ${article.title}`);
      console.log(
        `     Source: ${article.source_name || "Unknown"} | Date: ${new Date(article.published_date).toLocaleDateString()}`
      );
    }

    // Summary
    logSection("Migration Complete");
    logSuccess(`✨ Production database now has ${totalInProd} articles total`);

    if (totalInProd >= 79) {
      logSuccess("🎉 All articles successfully migrated!");
    } else {
      logWarning(`${79 - totalInProd} articles still need migration`);
    }

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
