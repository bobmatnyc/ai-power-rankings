#!/usr/bin/env tsx

/**
 * Backup Current Rankings
 *
 * Creates a JSON backup of the current rankings before deployment.
 * This allows rollback if something goes wrong with the new deployment.
 *
 * Usage:
 *   npx tsx scripts/backup-current-rankings.ts
 *
 * Output:
 *   Creates backup file in .ranking-backups/ directory with timestamp
 */

import { getDb, closeDb } from "@/lib/db/connection";
import { rankings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";

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

async function backupCurrentRankings() {
  console.log("\n💾 Backup Current Rankings\n");
  console.log("=".repeat(80));

  const db = getDb();

  try {
    // Get current rankings
    console.log("\n📥 Loading current rankings from database...");
    const currentRankings = await db
      .select()
      .from(rankings)
      .where(eq(rankings.isCurrent, true))
      .limit(1);

    if (currentRankings.length === 0) {
      console.log("⚠️  No current rankings found in database");
      console.log("   Nothing to backup. This is expected if no rankings exist yet.");
      return;
    }

    const current = currentRankings[0];
    console.log(`✓ Found current rankings:`);
    console.log(`   Period: ${current.period}`);
    console.log(`   Algorithm Version: ${current.algorithmVersion}`);
    console.log(`   Published At: ${current.publishedAt?.toISOString() || "Not set"}`);

    // Get all rankings for comprehensive backup
    console.log("\n📚 Loading all rankings for comprehensive backup...");
    const allRankings = await db.select().from(rankings);
    console.log(`✓ Found ${allRankings.length} total ranking periods in database`);

    // Prepare backup data
    const backupData: BackupData = {
      timestamp: new Date().toISOString(),
      database_endpoint: process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] || "unknown",
      current_ranking: current,
      all_rankings: allRankings,
      metadata: {
        backup_version: "1.0",
        script_version: "v7.3-deployment",
        created_by: "backup-current-rankings.ts",
      },
    };

    // Create backup directory if it doesn't exist
    const backupDir = path.join(process.cwd(), ".ranking-backups");
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
      console.log(`\n✓ Created backup directory: ${backupDir}`);
    }

    // Generate backup filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFilename = `rankings-backup-${current.period}-v${current.algorithmVersion}-${timestamp}.json`;
    const backupPath = path.join(backupDir, backupFilename);

    // Write backup file
    console.log(`\n💾 Writing backup to file...`);
    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));

    // Get file size
    const stats = fs.statSync(backupPath);
    const fileSizeKB = (stats.size / 1024).toFixed(2);

    console.log(`✓ Backup created successfully`);
    console.log(`\n📄 Backup Details:`);
    console.log(`   File: ${backupFilename}`);
    console.log(`   Path: ${backupPath}`);
    console.log(`   Size: ${fileSizeKB} KB`);
    console.log(`   Current Ranking: ${current.period} (v${current.algorithmVersion})`);
    console.log(`   Total Periods: ${allRankings.length}`);

    // Create a "latest" symlink for easy access
    const latestPath = path.join(backupDir, "latest-backup.json");
    try {
      if (fs.existsSync(latestPath)) {
        fs.unlinkSync(latestPath);
      }
      fs.symlinkSync(backupFilename, latestPath);
      console.log(`✓ Created symlink: latest-backup.json`);
    } catch (symlinkError) {
      // Symlink creation might fail on some systems, not critical
      console.log(`⚠️  Could not create symlink (not critical)`);
    }

    // List existing backups
    const existingBackups = fs.readdirSync(backupDir)
      .filter(f => f.startsWith("rankings-backup-") && f.endsWith(".json"))
      .sort()
      .reverse();

    if (existingBackups.length > 1) {
      console.log(`\n📦 Previous Backups (${existingBackups.length - 1} older):`);
      existingBackups.slice(1, 4).forEach(file => {
        const filePath = path.join(backupDir, file);
        const fileStats = fs.statSync(filePath);
        const sizeKB = (fileStats.size / 1024).toFixed(2);
        console.log(`   • ${file} (${sizeKB} KB)`);
      });

      if (existingBackups.length > 4) {
        console.log(`   ... and ${existingBackups.length - 4} more`);
      }
    }

    console.log("\n" + "=".repeat(80));
    console.log("✅ Backup Complete");
    console.log("=".repeat(80));

    console.log("\n📋 Next Steps:");
    console.log("   • Backup is ready for rollback if needed");
    console.log("   • Proceed with deployment: npx tsx scripts/generate-v73-rankings.ts");
    console.log("   • After deployment, verify: npx tsx scripts/verify-v73-deployment.ts");

    console.log("\n🔄 To Restore from Backup:");
    console.log(`   npx tsx scripts/restore-rankings-backup.ts "${backupPath}"`);

    console.log();

  } catch (error) {
    console.error("\n❌ Backup Error:", error);
    console.error("\nFailed to create backup");
    throw error;
  } finally {
    await closeDb();
  }
}

// Run backup
backupCurrentRankings()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Fatal Error:", error);
    process.exit(1);
  });
