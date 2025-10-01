#!/usr/bin/env tsx
/**
 * Database Article Tables Check Script
 * Verifies the existence and structure of article-related tables
 *
 * Usage: npx tsx scripts/check-article-tables.ts
 */

import { config } from "dotenv";

// Load environment variables
config({ path: ".env.local" });
config({ path: ".env" });

import { getDb, testConnection, closeDb } from "../lib/db/connection";
import { sql } from "drizzle-orm";
import { articles, articleRankingsChanges, articleProcessingLogs, rankingVersions } from "../lib/db/article-schema";
import { desc, count } from "drizzle-orm";

// Color codes for console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log("");
  log(`${"=".repeat(70)}`, colors.cyan);
  log(`  ${title.toUpperCase()}`, colors.bright + colors.cyan);
  log(`${"=".repeat(70)}`, colors.cyan);
  console.log("");
}

function logSuccess(message: string) {
  log(`✅ ${message}`, colors.green);
}

function logError(message: string) {
  log(`❌ ${message}`, colors.red);
}

function logInfo(message: string) {
  log(`ℹ️  ${message}`, colors.blue);
}

function logWarning(message: string) {
  log(`⚠️  ${message}`, colors.yellow);
}

function logTable(data: any[], columns: string[]) {
  if (data.length === 0) {
    logWarning("No data to display");
    return;
  }

  // Calculate column widths
  const widths: { [key: string]: number } = {};
  columns.forEach(col => {
    widths[col] = Math.max(
      col.length,
      ...data.map(row => String(row[col] || "").length)
    );
    widths[col] = Math.min(widths[col], 50); // Max width of 50
  });

  // Print header
  const header = columns.map(col => col.padEnd(widths[col])).join(" │ ");
  const separator = columns.map(col => "─".repeat(widths[col])).join("─┼─");

  log(header, colors.bright);
  log(separator, colors.dim);

  // Print rows
  data.forEach(row => {
    const rowStr = columns.map(col => {
      let value = String(row[col] || "");
      if (value.length > widths[col]) {
        value = value.substring(0, widths[col] - 3) + "...";
      }
      return value.padEnd(widths[col]);
    }).join(" │ ");
    console.log(rowStr);
  });
}

async function checkTableExists(tableName: string): Promise<boolean> {
  try {
    const db = getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    // Query the information schema to check if table exists
    const result = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = ${tableName}
      ) as exists
    `);

    return (result.rows[0] as any)?.exists || false;
  } catch (error) {
    logError(`Failed to check table ${tableName}: ${error}`);
    return false;
  }
}

async function getTableColumns(tableName: string) {
  try {
    const db = getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    const result = await db.execute(sql`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = ${tableName}
      ORDER BY ordinal_position
    `);

    return result.rows;
  } catch (error) {
    logError(`Failed to get columns for ${tableName}: ${error}`);
    return [];
  }
}

async function getTableStats(tableName: string) {
  try {
    const db = getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    const result = await db.execute(sql`
      SELECT
        COUNT(*) as row_count,
        pg_size_pretty(pg_total_relation_size(${tableName}::regclass)) as total_size
      FROM ${sql.identifier(tableName)}
    `);

    return result.rows[0];
  } catch (error) {
    // Table might not exist
    return { row_count: 0, total_size: "N/A" };
  }
}

async function checkArticlesTable() {
  logSection("Articles Table");

  const exists = await checkTableExists("articles");

  if (exists) {
    logSuccess("Table 'articles' exists");

    // Get column info
    const columns = await getTableColumns("articles");
    logInfo(`Found ${columns.length} columns`);

    // Get stats
    const stats = await getTableStats("articles");
    logInfo(`Row count: ${(stats as any).row_count || 0}`);
    logInfo(`Table size: ${(stats as any).total_size || "N/A"}`);

    // Get sample data
    try {
      const db = getDb();
      if (db) {
        const sampleData = await db
          .select({
            id: articles.id,
            title: articles.title,
            status: articles.status,
            ingestionType: articles.ingestionType,
            createdAt: articles.createdAt,
          })
          .from(articles)
          .orderBy(desc(articles.createdAt))
          .limit(5);

        if (sampleData.length > 0) {
          console.log("");
          logInfo("Recent articles:");
          logTable(
            sampleData.map(row => ({
              ...row,
              id: row.id.substring(0, 8) + "...",
              title: row.title?.substring(0, 40) || "",
              createdAt: new Date(row.createdAt).toISOString().split("T")[0],
            })),
            ["id", "title", "status", "ingestionType", "createdAt"]
          );
        } else {
          logWarning("No articles found in the table");
        }
      }
    } catch (error) {
      logWarning(`Could not fetch sample data: ${error}`);
    }
  } else {
    logError("Table 'articles' does not exist");
    logInfo("Run migrations to create the table");
  }

  return exists;
}

async function checkArticleRankingsChangesTable() {
  logSection("Article Rankings Changes Table");

  const exists = await checkTableExists("article_rankings_changes");

  if (exists) {
    logSuccess("Table 'article_rankings_changes' exists");

    // Get column info
    const columns = await getTableColumns("article_rankings_changes");
    logInfo(`Found ${columns.length} columns`);

    // Get stats
    const stats = await getTableStats("article_rankings_changes");
    logInfo(`Row count: ${(stats as any).row_count || 0}`);
    logInfo(`Table size: ${(stats as any).total_size || "N/A"}`);

    // Get sample data
    try {
      const db = getDb();
      if (db) {
        const sampleData = await db
          .select({
            id: articleRankingsChanges.id,
            toolName: articleRankingsChanges.toolName,
            oldRank: articleRankingsChanges.oldRank,
            newRank: articleRankingsChanges.newRank,
            changeType: articleRankingsChanges.changeType,
          })
          .from(articleRankingsChanges)
          .limit(5);

        if (sampleData.length > 0) {
          console.log("");
          logInfo("Recent ranking changes:");
          logTable(
            sampleData.map(row => ({
              ...row,
              id: row.id.substring(0, 8) + "...",
            })),
            ["id", "toolName", "oldRank", "newRank", "changeType"]
          );
        } else {
          logWarning("No ranking changes found in the table");
        }
      }
    } catch (error) {
      logWarning(`Could not fetch sample data: ${error}`);
    }
  } else {
    logError("Table 'article_rankings_changes' does not exist");
    logInfo("Run migrations to create the table");
  }

  return exists;
}

async function checkProcessingLogsTable() {
  logSection("Article Processing Logs Table");

  const exists = await checkTableExists("article_processing_logs");

  if (exists) {
    logSuccess("Table 'article_processing_logs' exists");

    // Get stats
    const stats = await getTableStats("article_processing_logs");
    logInfo(`Row count: ${(stats as any).row_count || 0}`);
    logInfo(`Table size: ${(stats as any).total_size || "N/A"}`);

    // Get sample data
    try {
      const db = getDb();
      if (db) {
        const sampleData = await db
          .select({
            id: articleProcessingLogs.id,
            action: articleProcessingLogs.action,
            status: articleProcessingLogs.status,
            durationMs: articleProcessingLogs.durationMs,
            createdAt: articleProcessingLogs.createdAt,
          })
          .from(articleProcessingLogs)
          .orderBy(desc(articleProcessingLogs.createdAt))
          .limit(5);

        if (sampleData.length > 0) {
          console.log("");
          logInfo("Recent processing logs:");
          logTable(
            sampleData.map(row => ({
              ...row,
              id: row.id.substring(0, 8) + "...",
              createdAt: new Date(row.createdAt).toISOString().split("T")[0],
            })),
            ["id", "action", "status", "durationMs", "createdAt"]
          );
        }
      }
    } catch (error) {
      logWarning(`Could not fetch sample data: ${error}`);
    }
  } else {
    logError("Table 'article_processing_logs' does not exist");
  }

  return exists;
}

async function checkRankingVersionsTable() {
  logSection("Ranking Versions Table");

  const exists = await checkTableExists("ranking_versions");

  if (exists) {
    logSuccess("Table 'ranking_versions' exists");

    // Get stats
    const stats = await getTableStats("ranking_versions");
    logInfo(`Row count: ${(stats as any).row_count || 0}`);
    logInfo(`Table size: ${(stats as any).total_size || "N/A"}`);

    // Get sample data
    try {
      const db = getDb();
      if (db) {
        const sampleData = await db
          .select({
            id: rankingVersions.id,
            version: rankingVersions.version,
            changesSummary: rankingVersions.changesSummary,
            createdAt: rankingVersions.createdAt,
          })
          .from(rankingVersions)
          .orderBy(desc(rankingVersions.createdAt))
          .limit(5);

        if (sampleData.length > 0) {
          console.log("");
          logInfo("Recent versions:");
          logTable(
            sampleData.map(row => ({
              ...row,
              id: row.id.substring(0, 8) + "...",
              changesSummary: row.changesSummary?.substring(0, 30) || "",
              createdAt: new Date(row.createdAt).toISOString().split("T")[0],
            })),
            ["id", "version", "changesSummary", "createdAt"]
          );
        } else {
          logWarning("No ranking versions found");
        }
      }
    } catch (error) {
      logWarning(`Could not fetch sample data: ${error}`);
    }
  } else {
    logError("Table 'ranking_versions' does not exist");
    logWarning("This table may need to be created via migration");
  }

  return exists;
}

async function checkDatabaseSchema() {
  try {
    const db = getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    // Get all tables in the public schema
    const result = await db.execute(sql`
      SELECT
        table_name,
        (SELECT COUNT(*)
         FROM information_schema.columns
         WHERE table_schema = 'public'
         AND table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    logSection("Database Schema Overview");
    logInfo(`Total tables in database: ${result.rows.length}`);
    console.log("");

    const articleTables = result.rows.filter((row: any) =>
      row.table_name.includes("article") || row.table_name.includes("ranking")
    );

    if (articleTables.length > 0) {
      logInfo("Article-related tables:");
      logTable(
        articleTables.map((row: any) => ({
          table_name: row.table_name,
          columns: row.column_count,
        })),
        ["table_name", "columns"]
      );
    }

    console.log("");
    logInfo("Other tables:");
    const otherTables = result.rows.filter((row: any) =>
      !row.table_name.includes("article") && !row.table_name.includes("ranking")
    );

    logTable(
      otherTables.slice(0, 10).map((row: any) => ({
        table_name: row.table_name,
        columns: row.column_count,
      })),
      ["table_name", "columns"]
    );

    if (otherTables.length > 10) {
      logInfo(`... and ${otherTables.length - 10} more tables`);
    }
  } catch (error) {
    logError(`Failed to check database schema: ${error}`);
  }
}

// Main execution
async function main() {
  console.log("");
  log("🔍 DATABASE ARTICLE TABLES CHECK", colors.bright + colors.magenta);
  log(`${"=".repeat(70)}`, colors.magenta);
  console.log("");

  try {
    // Test connection first
    logSection("Database Connection");
    const connected = await testConnection();

    if (!connected) {
      logError("Cannot connect to database");
      logInfo("Please check your DATABASE_URL in .env.local");
      process.exit(1);
    }

    // Check overall schema
    await checkDatabaseSchema();

    // Check each table
    const articlesExists = await checkArticlesTable();
    const rankingsExists = await checkArticleRankingsChangesTable();
    const logsExists = await checkProcessingLogsTable();
    const versionsExists = await checkRankingVersionsTable();

    // Summary
    logSection("Summary");

    const tables = [
      { name: "articles", exists: articlesExists },
      { name: "article_rankings_changes", exists: rankingsExists },
      { name: "article_processing_logs", exists: logsExists },
      { name: "ranking_versions", exists: versionsExists },
    ];

    const existingTables = tables.filter(t => t.exists);
    const missingTables = tables.filter(t => !t.exists);

    if (existingTables.length > 0) {
      logSuccess(`${existingTables.length} tables exist:`);
      existingTables.forEach(t => logInfo(`  • ${t.name}`));
    }

    if (missingTables.length > 0) {
      console.log("");
      logWarning(`${missingTables.length} tables missing:`);
      missingTables.forEach(t => logInfo(`  • ${t.name}`));

      console.log("");
      logInfo("To create missing tables:");
      logInfo("1. Run: npm run db:generate");
      logInfo("2. Then: npm run db:migrate");
    }

    if (missingTables.length === 0) {
      console.log("");
      logSuccess("All article-related tables are present!");
      logInfo("The database is ready for article ingestion.");
    }

  } catch (error) {
    logError(`Check failed: ${error}`);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

// Execute
main().catch(error => {
  logError(`Fatal error: ${error}`);
  process.exit(1);
});