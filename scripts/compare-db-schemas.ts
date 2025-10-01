#!/usr/bin/env tsx

/**
 * Database Schema Comparison Script
 * Compares production and development database schemas
 * Identifies missing tables, columns, indexes, and migrations
 *
 * Usage:
 *   tsx scripts/compare-db-schemas.ts
 *   npm run db:compare
 */

import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

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

interface TableColumn {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  ordinal_position: number;
}

interface TableInfo {
  table_name: string;
  table_schema: string;
}

interface IndexInfo {
  index_name: string;
  table_name: string;
  column_names: string;
  is_unique: boolean;
  index_type: string;
}

interface SchemaComparison {
  tablesOnlyInProd: string[];
  tablesOnlyInDev: string[];
  commonTables: string[];
  columnDifferences: Record<string, {
    onlyInProd: TableColumn[];
    onlyInDev: TableColumn[];
    common: TableColumn[];
  }>;
  indexDifferences: Record<string, {
    onlyInProd: IndexInfo[];
    onlyInDev: IndexInfo[];
  }>;
}

function log(message: string, type: "info" | "success" | "warning" | "error" = "info") {
  const colorMap = {
    info: colors.cyan,
    success: colors.green,
    warning: colors.yellow,
    error: colors.red,
  };
  console.log(`${colorMap[type]}${message}${colors.reset}`);
}

async function getTables(sql: any): Promise<TableInfo[]> {
  const tables = await sql<TableInfo[]>`
    SELECT table_name, table_schema
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `;
  return tables;
}

async function getTableColumns(sql: any, tableName: string): Promise<TableColumn[]> {
  const columns = await sql<TableColumn[]>`
    SELECT
      column_name,
      data_type,
      is_nullable,
      column_default,
      ordinal_position
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ${tableName}
    ORDER BY ordinal_position;
  `;
  return columns;
}

async function getTableIndexes(sql: any, tableName: string): Promise<IndexInfo[]> {
  const indexes = await sql<IndexInfo[]>`
    SELECT
      i.relname as index_name,
      t.relname as table_name,
      array_to_string(array_agg(a.attname), ', ') as column_names,
      ix.indisunique as is_unique,
      am.amname as index_type
    FROM pg_class t
    JOIN pg_index ix ON t.oid = ix.indrelid
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_am am ON i.relam = am.oid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
    WHERE t.relkind = 'r'
      AND t.relname = ${tableName}
      AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    GROUP BY i.relname, t.relname, ix.indisunique, am.amname
    ORDER BY i.relname;
  `;
  return indexes;
}

async function compareSchemas(
  prodSql: any,
  devSql: any
): Promise<SchemaComparison> {
  log("\n🔍 Fetching schema information from both databases...", "info");

  // Get tables from both databases
  const prodTables = await getTables(prodSql);
  const devTables = await getTables(devSql);

  const prodTableNames = prodTables.map(t => t.table_name);
  const devTableNames = devTables.map(t => t.table_name);

  // Find table differences
  const tablesOnlyInProd = prodTableNames.filter(t => !devTableNames.includes(t));
  const tablesOnlyInDev = devTableNames.filter(t => !prodTableNames.includes(t));
  const commonTables = prodTableNames.filter(t => devTableNames.includes(t));

  log(`   Found ${prodTableNames.length} tables in production`, "info");
  log(`   Found ${devTableNames.length} tables in development`, "info");
  log(`   ${commonTables.length} tables in common\n`, "info");

  // Compare columns for common tables
  const columnDifferences: Record<string, any> = {};
  const indexDifferences: Record<string, any> = {};

  for (const tableName of commonTables) {
    // Compare columns
    const prodColumns = await getTableColumns(prodSql, tableName);
    const devColumns = await getTableColumns(devSql, tableName);

    const prodColNames = prodColumns.map(c => c.column_name);
    const devColNames = devColumns.map(c => c.column_name);

    const onlyInProd = prodColumns.filter(c => !devColNames.includes(c.column_name));
    const onlyInDev = devColumns.filter(c => !prodColNames.includes(c.column_name));

    if (onlyInProd.length > 0 || onlyInDev.length > 0) {
      columnDifferences[tableName] = {
        onlyInProd,
        onlyInDev,
        common: prodColumns.filter(c => devColNames.includes(c.column_name)),
      };
    }

    // Compare indexes
    const prodIndexes = await getTableIndexes(prodSql, tableName);
    const devIndexes = await getTableIndexes(devSql, tableName);

    const prodIndexNames = prodIndexes.map(i => i.index_name);
    const devIndexNames = devIndexes.map(i => i.index_name);

    const indexOnlyInProd = prodIndexes.filter(i => !devIndexNames.includes(i.index_name));
    const indexOnlyInDev = devIndexes.filter(i => !prodIndexNames.includes(i.index_name));

    if (indexOnlyInProd.length > 0 || indexOnlyInDev.length > 0) {
      indexDifferences[tableName] = {
        onlyInProd: indexOnlyInProd,
        onlyInDev: indexOnlyInDev,
      };
    }
  }

  return {
    tablesOnlyInProd,
    tablesOnlyInDev,
    commonTables,
    columnDifferences,
    indexDifferences,
  };
}

async function checkMigrationStatus(sql: any, dbName: string): Promise<void> {
  log(`\n📋 Migration Status - ${dbName}:`, "info");

  try {
    // Check if migrations table exists
    const tableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'migrations'
      );
    `;

    if (!tableExists[0]?.exists) {
      log("   ⚠️  Migrations table does not exist", "warning");
      return;
    }

    // Get migration records
    const migrations = await sql`
      SELECT name, status, completed_at, error
      FROM migrations
      ORDER BY created_at DESC;
    `;

    if (migrations.length === 0) {
      log("   ⚠️  No migrations recorded in database", "warning");
    } else {
      log(`   Found ${migrations.length} migration records:`, "info");
      migrations.forEach((m: any) => {
        const statusColor = m.status === "completed" ? colors.green :
                           m.status === "failed" ? colors.red :
                           colors.yellow;
        console.log(`      ${statusColor}• ${m.name}: ${m.status}${colors.reset}`);
        if (m.error) {
          console.log(`        ${colors.red}Error: ${m.error}${colors.reset}`);
        }
      });
    }
  } catch (error) {
    log(`   ❌ Error checking migrations: ${error}`, "error");
  }
}

async function printComparisonReport(comparison: SchemaComparison): Promise<void> {
  console.log(`\n${colors.bright}${colors.blue}========================================`);
  console.log(`     DATABASE SCHEMA COMPARISON`);
  console.log(`========================================${colors.reset}\n`);

  // Table differences
  if (comparison.tablesOnlyInProd.length > 0) {
    log("⚠️  Tables ONLY in Production:", "warning");
    comparison.tablesOnlyInProd.forEach(t => console.log(`   - ${t}`));
    console.log();
  }

  if (comparison.tablesOnlyInDev.length > 0) {
    log("📦 Tables ONLY in Development:", "info");
    comparison.tablesOnlyInDev.forEach(t => console.log(`   - ${t}`));
    console.log();
  }

  // Column differences
  const tablesWithColDiffs = Object.keys(comparison.columnDifferences);
  if (tablesWithColDiffs.length > 0) {
    log("🔧 Column Differences:", "warning");
    tablesWithColDiffs.forEach(tableName => {
      const diffs = comparison.columnDifferences[tableName];
      console.log(`\n   ${colors.bright}${tableName}:${colors.reset}`);

      if (diffs.onlyInProd.length > 0) {
        console.log(`      ${colors.yellow}Columns only in PRODUCTION:${colors.reset}`);
        diffs.onlyInProd.forEach(col => {
          console.log(`         - ${col.column_name} (${col.data_type})`);
        });
      }

      if (diffs.onlyInDev.length > 0) {
        console.log(`      ${colors.cyan}Columns only in DEVELOPMENT:${colors.reset}`);
        diffs.onlyInDev.forEach(col => {
          console.log(`         - ${col.column_name} (${col.data_type})`);
        });
      }
    });
    console.log();
  }

  // Index differences
  const tablesWithIndexDiffs = Object.keys(comparison.indexDifferences);
  if (tablesWithIndexDiffs.length > 0) {
    log("🔍 Index Differences:", "info");
    tablesWithIndexDiffs.forEach(tableName => {
      const diffs = comparison.indexDifferences[tableName];
      console.log(`\n   ${colors.bright}${tableName}:${colors.reset}`);

      if (diffs.onlyInProd.length > 0) {
        console.log(`      ${colors.yellow}Indexes only in PRODUCTION:${colors.reset}`);
        diffs.onlyInProd.forEach(idx => {
          console.log(`         - ${idx.index_name} on (${idx.column_names})`);
        });
      }

      if (diffs.onlyInDev.length > 0) {
        console.log(`      ${colors.cyan}Indexes only in DEVELOPMENT:${colors.reset}`);
        diffs.onlyInDev.forEach(idx => {
          console.log(`         - ${idx.index_name} on (${idx.column_names})`);
        });
      }
    });
    console.log();
  }

  // Summary
  console.log(`\n${colors.bright}${colors.blue}========================================`);
  console.log(`              SUMMARY`);
  console.log(`========================================${colors.reset}\n`);

  const totalDifferences =
    comparison.tablesOnlyInProd.length +
    comparison.tablesOnlyInDev.length +
    tablesWithColDiffs.length +
    tablesWithIndexDiffs.length;

  if (totalDifferences === 0) {
    log("✅ Schemas are IDENTICAL!", "success");
  } else {
    log(`⚠️  Found ${totalDifferences} schema differences`, "warning");
    console.log(`   - Tables only in prod: ${comparison.tablesOnlyInProd.length}`);
    console.log(`   - Tables only in dev: ${comparison.tablesOnlyInDev.length}`);
    console.log(`   - Tables with column differences: ${tablesWithColDiffs.length}`);
    console.log(`   - Tables with index differences: ${tablesWithIndexDiffs.length}`);
  }
}

async function main() {
  console.log(`${colors.bright}${colors.magenta}========================================`);
  console.log(`   Database Schema Comparison Tool`);
  console.log(`========================================${colors.reset}\n`);

  // Get database URLs
  const PROD_DATABASE_URL = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL;
  const DEV_DATABASE_URL = process.env.DATABASE_URL_DEVELOPMENT || process.env.DATABASE_URL;

  if (!PROD_DATABASE_URL) {
    log("❌ Production database URL not found", "error");
    log("   Set PROD_DATABASE_URL or DATABASE_URL in .env.local", "error");
    process.exit(1);
  }

  if (!DEV_DATABASE_URL) {
    log("❌ Development database URL not found", "error");
    log("   Set DATABASE_URL_DEVELOPMENT in .env.local", "error");
    process.exit(1);
  }

  log("📍 Production:  " + PROD_DATABASE_URL.split("@")[1]?.split("/")[0], "info");
  log("📍 Development: " + DEV_DATABASE_URL.split("@")[1]?.split("/")[0], "info");

  // Create database connections
  const prodSql = neon(PROD_DATABASE_URL);
  const devSql = neon(DEV_DATABASE_URL);

  try {
    // Test connections
    log("\n🔌 Testing database connections...", "info");
    await prodSql`SELECT 1`;
    log("   ✅ Production connection successful", "success");
    await devSql`SELECT 1`;
    log("   ✅ Development connection successful", "success");

    // Check migration status
    await checkMigrationStatus(prodSql, "Production");
    await checkMigrationStatus(devSql, "Development");

    // Compare schemas
    const comparison = await compareSchemas(prodSql, devSql);

    // Print report
    await printComparisonReport(comparison);

    // Check for critical missing schema elements in production
    console.log(`\n${colors.bright}${colors.blue}========================================`);
    console.log(`        MIGRATION RECOMMENDATIONS`);
    console.log(`========================================${colors.reset}\n`);

    const criticalMissing: string[] = [];

    // Check for missing scoring columns in production
    if (comparison.columnDifferences["tools"]) {
      const toolsDiff = comparison.columnDifferences["tools"];
      const scoringCols = ["baseline_score", "delta_score", "current_score", "score_updated_at"];
      const missingScoringCols = toolsDiff.onlyInDev.filter(col =>
        scoringCols.includes(col.column_name)
      );

      if (missingScoringCols.length > 0) {
        criticalMissing.push("⚠️  CRITICAL: Production is missing scoring columns in 'tools' table:");
        missingScoringCols.forEach(col => {
          criticalMissing.push(`   - ${col.column_name} (${col.data_type})`);
        });
        criticalMissing.push(`\n   📝 Apply migration: tsx scripts/apply-scoring-migration.ts`);
      }
    }

    // Check for missing article tables
    const articleTables = ["articles", "article_rankings_changes", "article_processing_logs", "ranking_versions"];
    const missingArticleTables = articleTables.filter(t =>
      comparison.tablesOnlyInDev.includes(t)
    );

    if (missingArticleTables.length > 0) {
      criticalMissing.push("\n⚠️  CRITICAL: Production is missing article management tables:");
      missingArticleTables.forEach(t => criticalMissing.push(`   - ${t}`));
      criticalMissing.push(`\n   📝 Run migrations or use: npm run migrate:prod-to-dev (reverse)`);
    }

    if (criticalMissing.length > 0) {
      criticalMissing.forEach(msg => log(msg, "warning"));
    } else {
      log("✅ No critical schema differences found", "success");
    }

    console.log();

  } catch (error) {
    log("\n❌ Comparison failed:", "error");
    console.error(error);
    process.exit(1);
  }
}

// Run comparison
main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
