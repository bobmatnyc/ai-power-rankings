#!/usr/bin/env tsx

/**
 * Restore Rankings from Backup
 *
 * Restores rankings from a backup file created by backup-current-rankings.ts
 * Use this to rollback to a previous state if deployment fails.
 *
 * Usage:
 *   npx tsx scripts/restore-rankings-backup.ts <backup-file-path>
 *   npx tsx scripts/restore-rankings-backup.ts .ranking-backups/latest-backup.json
 *
 * Safety:
 *   - Prompts for confirmation before restoring
 *   - Creates backup of current state before restore
 *   - Validates backup file structure
 */

import { getDb, closeDb } from "@/lib/db/connection";
import { rankings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";
import readline from "readline";

interface BackupData {
  timestamp: string;
  database_endpoint: string;
  current_ranking: any;
  all_rankings: any[];
  metadata: {
    backup_version: string;
    script_version: string;
    created_by: string;
  };
}

function promptConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${question} (yes/no): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "yes" || answer.toLowerCase() === "y");
    });
  });
}

async function restoreRankingsBackup() {
  console.log("\n🔄 Restore Rankings from Backup\n");
  console.log("=".repeat(80));

  // Get backup file path from command line
  const backupFilePath = process.argv[2];

  if (!backupFilePath) {
    console.error("❌ Error: Backup file path required");
    console.error("\nUsage:");
    console.error("   npx tsx scripts/restore-rankings-backup.ts <backup-file-path>");
    console.error("\nExample:");
    console.error("   npx tsx scripts/restore-rankings-backup.ts .ranking-backups/latest-backup.json");
    console.error("\nAvailable backups:");

    const backupDir = path.join(process.cwd(), ".ranking-backups");
    if (fs.existsSync(backupDir)) {
      const backups = fs.readdirSync(backupDir)
        .filter(f => f.startsWith("rankings-backup-") && f.endsWith(".json"))
        .sort()
        .reverse();

      if (backups.length > 0) {
        backups.slice(0, 5).forEach(file => {
          console.error(`   • ${file}`);
        });
        if (backups.length > 5) {
          console.error(`   ... and ${backups.length - 5} more`);
        }
      } else {
        console.error("   (No backups found)");
      }
    } else {
      console.error("   (Backup directory does not exist)");
    }

    process.exit(1);
  }

  // Resolve backup file path
  const resolvedPath = path.isAbsolute(backupFilePath)
    ? backupFilePath
    : path.join(process.cwd(), backupFilePath);

  // Check if backup file exists
  if (!fs.existsSync(resolvedPath)) {
    console.error(`❌ Error: Backup file not found: ${resolvedPath}`);
    process.exit(1);
  }

  console.log(`📄 Backup File: ${path.basename(resolvedPath)}`);
  console.log(`📍 Full Path: ${resolvedPath}`);

  // Read and validate backup file
  console.log("\n📥 Reading backup file...");
  let backupData: BackupData;

  try {
    const backupContent = fs.readFileSync(resolvedPath, "utf-8");
    backupData = JSON.parse(backupContent);

    // Validate backup structure
    if (!backupData.current_ranking || !backupData.all_rankings) {
      throw new Error("Invalid backup file structure");
    }

    console.log(`✓ Backup file loaded successfully`);
  } catch (error) {
    console.error(`❌ Error reading backup file:`, error);
    process.exit(1);
  }

  // Display backup information
  console.log("\n📊 Backup Information:");
  console.log(`   Backup Timestamp: ${backupData.timestamp}`);
  console.log(`   Database Endpoint: ${backupData.database_endpoint}`);
  console.log(`   Current Ranking Period: ${backupData.current_ranking.period}`);
  console.log(`   Current Algorithm Version: ${backupData.current_ranking.algorithmVersion}`);
  console.log(`   Total Ranking Periods: ${backupData.all_rankings.length}`);
  console.log(`   Backup Version: ${backupData.metadata.backup_version}`);

  // Connect to database and show current state
  const db = getDb();

  try {
    console.log("\n📊 Current Database State:");
    const currentRankings = await db
      .select()
      .from(rankings)
      .where(eq(rankings.isCurrent, true))
      .limit(1);

    if (currentRankings.length > 0) {
      const current = currentRankings[0];
      console.log(`   Current Period: ${current.period}`);
      console.log(`   Current Algorithm: v${current.algorithmVersion}`);
      console.log(`   Published At: ${current.publishedAt?.toISOString() || "Not set"}`);
    } else {
      console.log(`   No current rankings found`);
    }

    const allCurrentRankings = await db.select().from(rankings);
    console.log(`   Total Periods in DB: ${allCurrentRankings.length}`);

    // Prompt for confirmation
    console.log("\n" + "=".repeat(80));
    console.log("⚠️  WARNING: This operation will restore rankings from backup");
    console.log("=".repeat(80));
    console.log("\nThis will:");
    console.log("   1. Create a backup of the current database state");
    console.log("   2. Delete all existing rankings");
    console.log(`   3. Restore ${backupData.all_rankings.length} ranking periods from backup`);
    console.log(`   4. Set period ${backupData.current_ranking.period} as current`);
    console.log("\nThis operation cannot be easily undone except by restoring from the pre-restore backup.");

    const confirmed = await promptConfirmation("\nAre you sure you want to proceed?");

    if (!confirmed) {
      console.log("\n❌ Restore cancelled by user");
      await closeDb();
      process.exit(0);
    }

    // Create backup of current state before restoring
    console.log("\n💾 Creating backup of current state before restore...");
    const preRestoreBackupDir = path.join(process.cwd(), ".ranking-backups");
    if (!fs.existsSync(preRestoreBackupDir)) {
      fs.mkdirSync(preRestoreBackupDir, { recursive: true });
    }

    const preRestoreData = {
      timestamp: new Date().toISOString(),
      database_endpoint: process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] || "unknown",
      current_ranking: currentRankings.length > 0 ? currentRankings[0] : null,
      all_rankings: allCurrentRankings,
      metadata: {
        backup_version: "1.0",
        script_version: "pre-restore-backup",
        created_by: "restore-rankings-backup.ts (automatic)",
      },
    };

    const preRestoreTimestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const preRestoreFilename = `pre-restore-backup-${preRestoreTimestamp}.json`;
    const preRestorePath = path.join(preRestoreBackupDir, preRestoreFilename);

    fs.writeFileSync(preRestorePath, JSON.stringify(preRestoreData, null, 2));
    console.log(`✓ Pre-restore backup created: ${preRestoreFilename}`);

    // Perform restore
    console.log("\n🔄 Starting restore process...");

    // Step 1: Delete all existing rankings
    console.log("\n   Step 1: Clearing existing rankings...");
    await db.delete(rankings);
    console.log("   ✓ Existing rankings cleared");

    // Step 2: Restore all rankings from backup
    console.log("\n   Step 2: Restoring rankings from backup...");

    for (const ranking of backupData.all_rankings) {
      // Remove id field to let database generate new ones
      const { id, createdAt, updatedAt, ...rankingData } = ranking;

      await db.insert(rankings).values({
        period: rankingData.period,
        algorithmVersion: rankingData.algorithmVersion,
        isCurrent: rankingData.isCurrent,
        publishedAt: rankingData.publishedAt ? new Date(rankingData.publishedAt) : null,
        data: rankingData.data,
      });
    }

    console.log(`   ✓ Restored ${backupData.all_rankings.length} ranking periods`);

    // Step 3: Verify restoration
    console.log("\n   Step 3: Verifying restoration...");

    const restoredCurrent = await db
      .select()
      .from(rankings)
      .where(eq(rankings.isCurrent, true))
      .limit(1);

    if (restoredCurrent.length === 0) {
      throw new Error("Verification failed: No current rankings after restore");
    }

    const restored = restoredCurrent[0];
    if (restored.period !== backupData.current_ranking.period) {
      throw new Error(
        `Verification failed: Expected period ${backupData.current_ranking.period}, got ${restored.period}`
      );
    }

    console.log("   ✓ Verification passed");

    // Success summary
    console.log("\n" + "=".repeat(80));
    console.log("✅ Restore Complete");
    console.log("=".repeat(80));

    console.log("\n📊 Restored State:");
    console.log(`   Current Period: ${restored.period}`);
    console.log(`   Algorithm Version: v${restored.algorithmVersion}`);
    console.log(`   Published At: ${restored.publishedAt?.toISOString() || "Not set"}`);
    console.log(`   Total Periods: ${backupData.all_rankings.length}`);

    console.log("\n💾 Backup Files:");
    console.log(`   Original Backup: ${resolvedPath}`);
    console.log(`   Pre-Restore Backup: ${preRestorePath}`);

    console.log("\n📋 Next Steps:");
    console.log("   • Verify rankings display correctly in application");
    console.log("   • Run verification: npx tsx scripts/verify-v73-deployment.ts");
    console.log("   • Monitor application for any issues");

    console.log("\n🔄 If you need to undo this restore:");
    console.log(`   npx tsx scripts/restore-rankings-backup.ts "${preRestorePath}"`);

    console.log();

  } catch (error) {
    console.error("\n❌ Restore Error:", error);
    console.error("\n💥 Restore failed - database may be in inconsistent state");
    console.error("\n🚨 URGENT: Restore from pre-restore backup:");
    console.error(`   npx tsx scripts/restore-rankings-backup.ts "${preRestorePath}"`);
    throw error;
  } finally {
    await closeDb();
  }
}

// Run restore
restoreRankingsBackup()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Fatal Error:", error);
    process.exit(1);
  });
