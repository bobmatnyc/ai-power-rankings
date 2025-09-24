#!/usr/bin/env node

/**
 * Script to switch back to development database from production database
 *
 * SAFETY FEATURES:
 * - Restores development database configuration
 * - Verifies the switch was successful
 * - Provides confirmation of database mode
 */

const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const ROOT_DIR = path.dirname(__dirname);
const ENV_LOCAL = path.join(ROOT_DIR, ".env.local");

function findLatestBackup() {
  const files = fs.readdirSync(ROOT_DIR);
  const backupFiles = files.filter((file) => file.startsWith(".env.local.backup."));

  if (backupFiles.length === 0) {
    return null;
  }

  // Sort by timestamp (latest first)
  backupFiles.sort((a, b) => b.localeCompare(a));
  return path.join(ROOT_DIR, backupFiles[0]);
}

function restoreFromBackup() {
  const latestBackup = findLatestBackup();

  if (!latestBackup) {
    console.log("❌ No backup found. Creating default development configuration...");
    return createDefaultDevConfig();
  }

  console.log(`📄 Restoring from backup: ${path.basename(latestBackup)}`);
  fs.copyFileSync(latestBackup, ENV_LOCAL);
  console.log("✅ Restored development database configuration");
  return true;
}

function createDefaultDevConfig() {
  // Read the original development configuration if it exists
  const envExample = path.join(ROOT_DIR, ".env.local.example");
  const envBak = path.join(ROOT_DIR, ".env.local.bak");

  if (fs.existsSync(envBak)) {
    console.log("📄 Restoring from .env.local.bak");
    fs.copyFileSync(envBak, ENV_LOCAL);
    return true;
  }

  if (fs.existsSync(envExample)) {
    console.log("📄 Creating configuration from .env.local.example");
    fs.copyFileSync(envExample, ENV_LOCAL);
    return true;
  }

  console.error("❌ Unable to create default development configuration");
  console.log("Please manually restore your .env.local file");
  return false;
}

function testDatabaseConnection() {
  console.log("🔍 Testing development database connection...");
  try {
    execSync("pnpm run db:test", {
      stdio: "inherit",
      cwd: ROOT_DIR,
      timeout: 30000,
    });
    console.log("✅ Development database connection successful");
    return true;
  } catch (error) {
    console.error("❌ Database connection test failed:", error.message);
    return false;
  }
}

function displayConfirmation() {
  console.log(`\n${"✅ ".repeat(20)}`);
  console.log("🔄 SWITCHED BACK TO DEVELOPMENT DATABASE");
  console.log("✅ ".repeat(20));
  console.log("");
  console.log("Your local environment is now connected to:");
  console.log("🔹 Development database (safe for testing)");
  console.log("🔹 All safety restrictions removed");
  console.log("🔹 Full database operations enabled");
  console.log("");
  console.log("You can now:");
  console.log("• Run migrations safely");
  console.log("• Modify data without production impact");
  console.log("• Perform full testing");
  console.log("");
  console.log("✅ ".repeat(20));
}

function switchToDevDB() {
  try {
    console.log("🔄 Switching back to development database...");

    const restored = restoreFromBackup();
    if (!restored) {
      process.exit(1);
    }

    const connectionSuccess = testDatabaseConnection();
    if (!connectionSuccess) {
      console.error("❌ Development database connection failed");
      console.log("Please check your database configuration manually");
      process.exit(1);
    }

    displayConfirmation();

    console.log("Next steps:");
    console.log("  1. Restart your development server: pnpm run dev:pm2 restart");
    console.log("  2. Your app now uses the development database");
    console.log("");
  } catch (error) {
    console.error("❌ Failed to switch to development database:", error.message);
    process.exit(1);
  }
}

switchToDevDB();
