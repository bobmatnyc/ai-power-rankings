#!/usr/bin/env tsx
/**
 * Test Environment Variable Loading
 * Verifies that environment variables are loaded from .env files
 */

// Load environment variables from .env files FIRST
import * as dotenv from "dotenv";

// Load .env.local first (higher priority), then .env
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

// Color codes for console output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log(`\n${"=".repeat(50)}`);
  log(title, colors.cyan);
  console.log("=".repeat(50));
}

/**
 * Test environment variable loading
 */
async function testEnvLoading() {
  logSection("Environment Variable Loading Test");

  // Check if .env or .env.local exists
  const fs = await import("node:fs");
  const path = await import("node:path");

  const envPath = path.join(process.cwd(), ".env");
  const envLocalPath = path.join(process.cwd(), ".env.local");

  log("\n📁 Checking for .env files:", colors.yellow);

  if (fs.existsSync(envPath)) {
    log("  ✅ .env file exists", colors.green);
  } else {
    log("  ⚠️  .env file not found", colors.yellow);
  }

  if (fs.existsSync(envLocalPath)) {
    log("  ✅ .env.local file exists", colors.green);
  } else {
    log("  ⚠️  .env.local file not found", colors.yellow);
  }

  // Test critical environment variables
  log("\n🔍 Testing critical environment variables:", colors.yellow);

  const criticalVars = [
    "DATABASE_URL",
    "USE_DATABASE",
    "NODE_ENV",
    "DIRECT_DATABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_DATABASE_URL",
  ];

  let foundCount = 0;
  let missingCount = 0;

  for (const varName of criticalVars) {
    const value = process.env[varName];
    if (value) {
      foundCount++;
      // Don't log the actual value for security
      const displayValue =
        varName.includes("URL") || varName.includes("KEY") ? `${value.substring(0, 20)}...` : value;
      log(`  ✅ ${varName}: ${displayValue}`, colors.green);
    } else {
      missingCount++;
      log(`  ❌ ${varName}: Not set`, colors.red);
    }
  }

  // Test database-specific variables
  log("\n🗄️  Testing database configuration:", colors.yellow);

  const dbUrl = process.env["DATABASE_URL"];
  const useDb = process.env["USE_DATABASE"];
  const directDbUrl = process.env["DIRECT_DATABASE_URL"];

  if (dbUrl || directDbUrl) {
    log("  ✅ Database URL configured", colors.green);

    // Parse the URL to check if it's Neon
    const urlToParse = directDbUrl || dbUrl;
    if (urlToParse?.includes("neon")) {
      log("  ✅ Using Neon database", colors.green);
    } else if (urlToParse?.includes("supabase")) {
      log("  ✅ Using Supabase database", colors.green);
    } else {
      log("  ℹ️  Database provider unknown", colors.blue);
    }
  } else {
    log("  ⚠️  No database URL configured", colors.yellow);
  }

  if (useDb === "true") {
    log("  ✅ Database mode enabled (USE_DATABASE=true)", colors.green);
  } else if (useDb === "false") {
    log("  ℹ️  Database mode disabled (USE_DATABASE=false)", colors.blue);
  } else {
    log("  ⚠️  USE_DATABASE not set", colors.yellow);
  }

  // Summary
  logSection("Summary");

  log(
    `Found ${foundCount}/${criticalVars.length} critical environment variables`,
    foundCount === criticalVars.length ? colors.green : colors.yellow
  );

  if (missingCount > 0) {
    log(`\n⚠️  ${missingCount} environment variables are missing`, colors.yellow);
    log("Add them to your .env.local file", colors.yellow);
  }

  // Test loading from different files
  log("\n📝 Testing dotenv loading order:", colors.yellow);
  log("  1. .env.local (highest priority)", colors.cyan);
  log("  2. .env (default values)", colors.cyan);
  log("  Note: .env.local values override .env values", colors.blue);

  // Test that we can import and use the connection
  log("\n🔌 Testing database connection module:", colors.yellow);
  try {
    const { getDb, testConnection } = await import("../src/lib/db/connection");
    log("  ✅ Database connection module loaded", colors.green);

    const db = getDb();
    if (db) {
      log("  ✅ Database instance created", colors.green);
    } else {
      log("  ℹ️  Database instance is null (may be disabled or not configured)", colors.blue);
    }

    // Only test actual connection if database is enabled
    if (useDb === "true" && (dbUrl || directDbUrl)) {
      log("\n🔄 Testing actual database connection...", colors.yellow);
      const connected = await testConnection();
      if (connected) {
        log("  ✅ Database connection successful!", colors.green);
      } else {
        log("  ❌ Database connection failed", colors.red);
      }
    }
  } catch (error) {
    log(`  ❌ Error loading database module: ${error}`, colors.red);
  }

  log("\n✨ Environment variable loading test complete!", colors.cyan);
}

// Run the test
if (require.main === module) {
  testEnvLoading().catch((error) => {
    log(`\n❌ Test failed: ${error}`, colors.red);
    process.exit(1);
  });
}
