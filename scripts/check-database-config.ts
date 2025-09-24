#!/usr/bin/env tsx

/**
 * Database Configuration Checker
 *
 * This script checks and validates database configuration across environments.
 * It shows which database URL is being used and tests connections.
 *
 * Usage: pnpm tsx scripts/check-database-config.ts
 */

import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import * as fs from "fs";
import * as path from "path";

// Colors for terminal output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log("\n" + "=".repeat(60));
  log(title, colors.bright + colors.cyan);
  console.log("=".repeat(60));
}

function logSuccess(message: string) {
  log("✅ " + message, colors.green);
}

function logWarning(message: string) {
  log("⚠️  " + message, colors.yellow);
}

function logError(message: string) {
  log("❌ " + message, colors.red);
}

function logInfo(key: string, value: string | undefined, sensitive = false) {
  if (!value) {
    console.log(`${colors.blue}${key}:${colors.reset} ${colors.red}(not set)${colors.reset}`);
    return;
  }

  if (sensitive) {
    // Mask sensitive information
    const masked = value.substring(0, 20) + "..." + value.substring(value.length - 10);
    console.log(`${colors.blue}${key}:${colors.reset} ${masked}`);
  } else {
    console.log(`${colors.blue}${key}:${colors.reset} ${value}`);
  }
}

async function testDatabaseConnection(
  url: string,
  name: string
): Promise<{ success: boolean; tables?: string[]; error?: string }> {
  try {
    const sql = neon(url);

    // Test basic connection
    const timeResult = await sql`SELECT NOW() as current_time`;
    const currentTime = timeResult[0]?.current_time;

    // Get list of tables
    const tablesResult = await sql`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `;

    const tables = tablesResult.map((row: any) => row.tablename);

    // Count rows in key tables
    const articleCount = await sql`SELECT COUNT(*) as count FROM articles`.catch(() => [
      { count: 0 },
    ]);
    const toolCount = await sql`SELECT COUNT(*) as count FROM tools`.catch(() => [{ count: 0 }]);

    console.log(`  📊 Connection successful at ${currentTime}`);
    console.log(`  📋 Tables found: ${tables.length}`);
    console.log(`  📰 Articles: ${articleCount[0]?.count || 0}`);
    console.log(`  🔧 Tools: ${toolCount[0]?.count || 0}`);

    return { success: true, tables };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

function extractDatabaseInfo(url: string): { host: string; database: string; branch?: string } {
  try {
    // Parse the PostgreSQL URL
    const match = url.match(/postgresql:\/\/[^@]+@([^/]+)\/([^?]+)/);
    if (match) {
      const host = match[1];
      const database = match[2];

      // Try to extract branch name from Neon host
      // Neon hosts look like: ep-branch-name-xxx.region.aws.neon.tech
      const branchMatch = host.match(/ep-([^-]+(?:-[^-]+)*)-[a-z0-9]+(?:-pooler)?\..*\.neon\.tech/);
      const branch = branchMatch ? branchMatch[1] : undefined;

      return { host, database, branch };
    }
  } catch (error) {
    // Ignore parsing errors
  }

  return { host: "unknown", database: "unknown" };
}

async function main() {
  logSection("AI Power Rankings - Database Configuration Checker");

  // Load environment variables
  const envLocalPath = path.join(process.cwd(), ".env.local");
  const envPath = path.join(process.cwd(), ".env");

  // Load .env.local first (higher priority)
  if (fs.existsSync(envLocalPath)) {
    config({ path: envLocalPath });
    log(`Loaded: ${envLocalPath}`, colors.green);
  } else {
    logWarning(".env.local not found");
  }

  // Load .env as fallback
  if (fs.existsSync(envPath)) {
    config({ path: envPath });
    log(`Loaded: ${envPath}`, colors.green);
  }

  // Check current environment
  logSection("Environment Configuration");

  const nodeEnv = process.env.NODE_ENV || "development";
  const useDatabase = process.env.USE_DATABASE === "true";

  logInfo("NODE_ENV", nodeEnv);
  logInfo("USE_DATABASE", String(useDatabase));

  if (!useDatabase) {
    logWarning("Database is disabled. Set USE_DATABASE=true to enable.");
    return;
  }

  // Check database URLs
  logSection("Database URLs Configuration");

  const urls = {
    development: process.env.DATABASE_URL_DEVELOPMENT,
    production: process.env.DATABASE_URL,
    staging: process.env.DATABASE_URL_STAGING,
    unpooled: process.env.DATABASE_URL_UNPOOLED,
  };

  // Display configuration for each environment
  for (const [env, url] of Object.entries(urls)) {
    if (url && !url.includes("YOUR_PASSWORD")) {
      const info = extractDatabaseInfo(url);
      console.log(`\n${colors.bright}${env.toUpperCase()}:${colors.reset}`);
      logInfo("  Host", info.host);
      logInfo("  Database", info.database);
      if (info.branch) {
        logInfo("  Branch", info.branch);
      }
      logInfo("  URL", url, true);
    } else {
      console.log(
        `\n${colors.bright}${env.toUpperCase()}:${colors.reset} ${colors.red}(not configured)${colors.reset}`
      );
    }
  }

  // Determine which URL would be used based on current NODE_ENV
  logSection("Active Database Selection");

  let activeUrl: string | undefined;
  let activeName: string;

  if (nodeEnv === "development") {
    activeUrl = urls.development || urls.production;
    activeName = urls.development ? "DATABASE_URL_DEVELOPMENT" : "DATABASE_URL (fallback)";
  } else if (nodeEnv === "staging") {
    activeUrl = urls.staging || urls.production;
    activeName = urls.staging ? "DATABASE_URL_STAGING" : "DATABASE_URL (fallback)";
  } else {
    activeUrl = urls.production;
    activeName = "DATABASE_URL";
  }

  if (activeUrl && !activeUrl.includes("YOUR_PASSWORD")) {
    const info = extractDatabaseInfo(activeUrl);
    logSuccess(`Using ${activeName} for ${nodeEnv} environment`);
    logInfo("Active Host", info.host);
    if (info.branch) {
      logInfo("Active Branch", info.branch);
    }
  } else {
    logError(`No valid database URL for ${nodeEnv} environment`);
    return;
  }

  // Test connections
  logSection("Database Connection Tests");

  // Test active connection
  if (activeUrl && !activeUrl.includes("YOUR_PASSWORD")) {
    console.log(`\nTesting ${activeName}...`);
    const result = await testDatabaseConnection(activeUrl, activeName);
    if (result.success) {
      logSuccess(`${activeName} connection successful`);
    } else {
      logError(`${activeName} connection failed: ${result.error}`);
    }
  }

  // Optionally test all configured databases
  const testAll = process.argv.includes("--all");
  if (testAll) {
    console.log("\n" + colors.yellow + "Testing all configured databases..." + colors.reset);

    for (const [env, url] of Object.entries(urls)) {
      if (url && !url.includes("YOUR_PASSWORD") && url !== activeUrl) {
        console.log(`\nTesting ${env.toUpperCase()}...`);
        const result = await testDatabaseConnection(url, env);
        if (result.success) {
          logSuccess(`${env} connection successful`);
        } else {
          logError(`${env} connection failed: ${result.error}`);
        }
      }
    }
  } else {
    console.log(
      `\n${colors.cyan}Tip: Run with --all flag to test all configured databases${colors.reset}`
    );
  }

  // Summary
  logSection("Summary");

  if (activeUrl && !activeUrl.includes("YOUR_PASSWORD")) {
    logSuccess(`Database configuration is valid for ${nodeEnv} environment`);
    console.log("\nNext steps:");
    console.log("1. Ensure DATABASE_URL_DEVELOPMENT is set in .env.local for development");
    console.log("2. Ensure DATABASE_URL is set in Vercel for production");
    console.log("3. Run migrations: pnpm run db:migrate");
    console.log("4. Test with: pnpm run dev:pm2 start");
  } else {
    logError("Database configuration needs to be updated");
    console.log("\nRequired actions:");
    console.log("1. Copy .env.local.example to .env.local");
    console.log("2. Update database URLs with your Neon credentials");
    console.log("3. Set up database branches in Neon (main, development)");
    console.log("4. Run this script again to verify");
  }
}

// Run the script
main().catch((error) => {
  logError(`Script failed: ${error.message}`);
  process.exit(1);
});
