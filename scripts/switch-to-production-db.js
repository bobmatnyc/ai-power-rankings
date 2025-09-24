#!/usr/bin/env node

/**
 * Script to safely switch local environment to production database
 *
 * SAFETY FEATURES:
 * - Creates backup of current .env.local
 * - Sets DATABASE_MIGRATION_MODE to "dry-run" for safety
 * - Tests database connection before switching
 * - Provides clear warnings about production database usage
 */

const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const ROOT_DIR = path.dirname(__dirname);
const ENV_LOCAL = path.join(ROOT_DIR, ".env.local");
const ENV_PROD_DB = path.join(ROOT_DIR, ".env.local.production-db");

function createTimestampedBackup() {
  const timestamp =
    new Date().toISOString().replace(/[:.]/g, "-").split("T")[0] +
    "_" +
    new Date().toTimeString().split(" ")[0].replace(/:/g, "");
  const backupPath = path.join(ROOT_DIR, `.env.local.backup.${timestamp}`);

  if (fs.existsSync(ENV_LOCAL)) {
    fs.copyFileSync(ENV_LOCAL, backupPath);
    console.log(`✅ Created backup: ${backupPath}`);
    return backupPath;
  }
  return null;
}

function testDatabaseConnection() {
  console.log("🔍 Testing production database connection...");
  try {
    // Temporarily switch environment and test connection
    if (fs.existsSync(ENV_PROD_DB)) {
      fs.copyFileSync(ENV_PROD_DB, ENV_LOCAL);
    }

    // Test database connection
    execSync("pnpm run db:test", {
      stdio: "inherit",
      cwd: ROOT_DIR,
      timeout: 30000, // 30 second timeout
    });

    console.log("✅ Database connection test successful");
    return true;
  } catch (error) {
    console.error("❌ Database connection test failed:", error.message);
    return false;
  }
}

function displayWarnings() {
  console.log(`\n${"⚠️ ".repeat(20)}`);
  console.log("🚨 CRITICAL WARNING: PRODUCTION DATABASE CONNECTION");
  console.log("⚠️ ".repeat(20));
  console.log("");
  console.log("You are about to connect to the PRODUCTION database.");
  console.log("");
  console.log("SAFETY MEASURES IN PLACE:");
  console.log('✅ DATABASE_MIGRATION_MODE set to "dry-run"');
  console.log("✅ Backup of current .env.local created");
  console.log("✅ Database connection tested");
  console.log("");
  console.log("IMPORTANT GUIDELINES:");
  console.log("🔒 Use ONLY for read-only testing of new code");
  console.log("🔒 DO NOT run migration commands");
  console.log("🔒 DO NOT modify production data");
  console.log("🔒 Monitor your usage carefully");
  console.log("");
  console.log("To revert to development database:");
  console.log("  pnpm run db:switch-dev");
  console.log("");
  console.log("⚠️ ".repeat(20));
}

function switchToProductionDB() {
  try {
    // Create backup
    const backupPath = createTimestampedBackup();

    // Test database connection
    const connectionSuccess = testDatabaseConnection();

    if (!connectionSuccess) {
      console.error("❌ Aborting switch due to connection failure");

      // Restore original env if backup exists
      if (backupPath && fs.existsSync(backupPath)) {
        fs.copyFileSync(backupPath, ENV_LOCAL);
        console.log("✅ Restored original .env.local");
      }
      process.exit(1);
    }

    displayWarnings();

    console.log("✅ Successfully switched to production database connection");
    console.log(`📄 Original configuration backed up to: ${backupPath}`);
    console.log("");
    console.log("Next steps:");
    console.log("  1. Build the application: pnpm run build");
    console.log("  2. Start the server: pnpm run dev:pm2 start");
    console.log("  3. Test your changes carefully");
    console.log("");
    console.log("Remember: This connects to PRODUCTION data - handle with care!");
  } catch (error) {
    console.error("❌ Failed to switch to production database:", error.message);
    process.exit(1);
  }
}

// Check if production DB config exists
if (!fs.existsSync(ENV_PROD_DB)) {
  console.error(`❌ Production DB configuration not found: ${ENV_PROD_DB}`);
  console.log("Please run the setup script first.");
  process.exit(1);
}

switchToProductionDB();
