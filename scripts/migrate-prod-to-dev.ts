#!/usr/bin/env tsx

/**
 * Migration Script: Production to Development Database
 * Copies all data from production tables to development database
 *
 * Usage: npm run migrate:prod-to-dev
 * Or: tsx scripts/migrate-prod-to-dev.ts
 */

import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "@/lib/db/schema";
import * as articleSchema from "@/lib/db/article-schema";
import { sql } from "drizzle-orm";
import dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

// Database connection strings
const PROD_DATABASE_URL = process.env.PROD_DATABASE_URL ||
  "postgresql://neondb_owner:npg_3oQsxj0FcfKY@ep-wispy-fog-ad8d4skz-pooler.c-2.us-east-1.aws.neon.tech/neondb";

const DEV_DATABASE_URL = process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_3oQsxj0FcfKY@ep-bold-sunset-adneqlo6-pooler.c-2.us-east-1.aws.neon.tech/neondb";

// Create database connections
const prodSql = neon(PROD_DATABASE_URL);
const devSql = neon(DEV_DATABASE_URL);
const prodDb = drizzle(prodSql, { schema: { ...schema, ...articleSchema } });
const devDb = drizzle(devSql, { schema: { ...schema, ...articleSchema } });

// Color codes for console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  blue: "\x1b[34m",
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

interface MigrationStats {
  table: string;
  sourceCount: number;
  targetCountBefore: number;
  targetCountAfter: number;
  inserted: number;
  updated: number;
  errors: number;
  duration: number;
}

async function getTableCount(db: any, table: any): Promise<number> {
  try {
    const result = await db.select({ count: sql<number>`count(*)::int` }).from(table);
    return result[0]?.count || 0;
  } catch (error) {
    console.error(`Error getting count for table:`, error);
    return 0;
  }
}

async function migrateTable(
  tableName: string,
  table: any,
  uniqueFields: string[] = ["id"]
): Promise<MigrationStats> {
  const startTime = Date.now();
  const stats: MigrationStats = {
    table: tableName,
    sourceCount: 0,
    targetCountBefore: 0,
    targetCountAfter: 0,
    inserted: 0,
    updated: 0,
    errors: 0,
    duration: 0,
  };

  try {
    log(`Starting migration for table: ${tableName}`, "info");

    // Get counts before migration
    stats.sourceCount = await getTableCount(prodDb, table);
    stats.targetCountBefore = await getTableCount(devDb, table);

    if (stats.sourceCount === 0) {
      log(`No data in source table: ${tableName}`, "warning");
      stats.duration = Date.now() - startTime;
      return stats;
    }

    log(`Found ${stats.sourceCount} records in production ${tableName}`, "info");

    // Fetch all data from production
    const sourceData = await prodDb.select().from(table);

    // Process in batches for better performance
    const batchSize = 100;
    const batches = Math.ceil(sourceData.length / batchSize);

    for (let i = 0; i < batches; i++) {
      const batch = sourceData.slice(i * batchSize, (i + 1) * batchSize);

      try {
        // Use upsert (INSERT ... ON CONFLICT DO UPDATE)
        for (const record of batch) {
          try {
            // Build the ON CONFLICT clause
            const conflictClause = uniqueFields.map(field =>
              `"${field}" = EXCLUDED."${field}"`
            ).join(", ");

            // Insert or update the record
            await devDb.insert(table).values(record)
              .onConflictDoUpdate({
                target: uniqueFields as any,
                set: Object.keys(record).reduce((acc, key) => {
                  if (!uniqueFields.includes(key)) {
                    acc[key] = sql`EXCLUDED.${sql.identifier(key)}`;
                  }
                  return acc;
                }, {} as any)
              });

            stats.inserted++;
          } catch (recordError: any) {
            // Try to update if insert fails
            if (recordError.code === '23505') { // Unique violation
              try {
                const whereClause = uniqueFields.reduce((acc, field) => {
                  return sql`${acc} AND ${sql.identifier(field)} = ${(record as any)[field]}`;
                }, sql`1=1`);

                await devDb.update(table)
                  .set(record)
                  .where(whereClause);
                stats.updated++;
              } catch (updateError) {
                console.error(`Error updating record in ${tableName}:`, updateError);
                stats.errors++;
              }
            } else {
              console.error(`Error inserting record in ${tableName}:`, recordError);
              stats.errors++;
            }
          }
        }

        // Show progress
        const progress = Math.round((i + 1) / batches * 100);
        process.stdout.write(`\r  Progress: ${progress}% (${Math.min((i + 1) * batchSize, sourceData.length)}/${sourceData.length})`);
      } catch (batchError) {
        console.error(`\nError processing batch ${i + 1} for ${tableName}:`, batchError);
        stats.errors += batch.length;
      }
    }

    console.log(); // New line after progress

    // Get count after migration
    stats.targetCountAfter = await getTableCount(devDb, table);
    stats.duration = Date.now() - startTime;

    log(`Completed ${tableName}: ${stats.inserted + stats.updated} records processed in ${(stats.duration / 1000).toFixed(2)}s`, "success");
  } catch (error) {
    console.error(`Error migrating table ${tableName}:`, error);
    stats.errors++;
    stats.duration = Date.now() - startTime;
  }

  return stats;
}

async function main() {
  console.log(`${colors.bright}${colors.blue}========================================`);
  console.log(`   Production to Development Migration`);
  console.log(`========================================${colors.reset}\n`);

  log("Starting database migration...", "info");
  log(`Production URL: ${PROD_DATABASE_URL.replace(/:[^@]+@/, ':****@')}`, "info");
  log(`Development URL: ${DEV_DATABASE_URL.replace(/:[^@]+@/, ':****@')}`, "info");

  const migrationStats: MigrationStats[] = [];
  const startTime = Date.now();

  try {
    // Test connections
    log("Testing database connections...", "info");
    await prodDb.execute(sql`SELECT 1`);
    await devDb.execute(sql`SELECT 1`);
    log("Database connections successful", "success");

    // Migrate tables in order (respecting foreign key constraints)
    const tables = [
      { name: "companies", table: schema.companies, unique: ["slug", "id"] },
      { name: "tools", table: schema.tools, unique: ["slug", "id"] },
      { name: "rankings", table: schema.rankings, unique: ["period", "id"] },
      { name: "news", table: schema.news, unique: ["slug", "articleId", "id"] },
      { name: "articles", table: articleSchema.articles, unique: ["slug", "id"] },
      { name: "article_rankings_changes", table: articleSchema.articleRankingsChanges, unique: ["id"] },
      { name: "article_processing_logs", table: articleSchema.articleProcessingLogs, unique: ["id"] },
      { name: "ranking_versions", table: articleSchema.rankingVersions, unique: ["version", "id"] },
    ];

    for (const { name, table, unique } of tables) {
      const stats = await migrateTable(name, table, unique);
      migrationStats.push(stats);
      console.log(); // Add spacing between tables
    }

    // Print summary
    const totalDuration = Date.now() - startTime;
    console.log(`\n${colors.bright}${colors.blue}========================================`);
    console.log(`           Migration Summary`);
    console.log(`========================================${colors.reset}\n`);

    console.table(migrationStats.map(stat => ({
      Table: stat.table,
      "Source Records": stat.sourceCount,
      "Target Before": stat.targetCountBefore,
      "Target After": stat.targetCountAfter,
      "Processed": stat.inserted + stat.updated,
      "Errors": stat.errors,
      "Duration (s)": (stat.duration / 1000).toFixed(2),
    })));

    const totalRecords = migrationStats.reduce((sum, stat) => sum + stat.inserted + stat.updated, 0);
    const totalErrors = migrationStats.reduce((sum, stat) => sum + stat.errors, 0);

    console.log(`\n${colors.bright}Total Statistics:${colors.reset}`);
    console.log(`  Total records processed: ${colors.green}${totalRecords}${colors.reset}`);
    console.log(`  Total errors: ${totalErrors > 0 ? colors.red : colors.green}${totalErrors}${colors.reset}`);
    console.log(`  Total duration: ${colors.cyan}${(totalDuration / 1000).toFixed(2)}s${colors.reset}`);

    if (totalErrors > 0) {
      log("Migration completed with errors. Please review the logs.", "warning");
      process.exit(1);
    } else {
      log("Migration completed successfully!", "success");
    }

  } catch (error) {
    console.error(`\n${colors.red}Fatal error during migration:`, error, colors.reset);
    process.exit(1);
  }
}

// Run the migration
main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});