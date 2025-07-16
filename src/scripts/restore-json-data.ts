#!/usr/bin/env tsx

/**
 * Restore JSON Data Script
 * Restores JSON data from a backup
 */

import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { format, parseISO } from "date-fns";
import { loggers } from "../lib/logger";

const JSON_DATA_DIR = path.join(process.cwd(), "data", "json");
const BACKUP_DIR = path.join(process.cwd(), "data", "backups");

interface BackupMetadata {
  timestamp: string;
  backupName: string;
  files: number;
  size: number;
}

async function listBackups(): Promise<string[]> {
  try {
    const entries = await fs.readdir(BACKUP_DIR);
    return entries
      .filter((name) => name.startsWith("backup-"))
      .sort()
      .reverse();
  } catch (error) {
    loggers.backup.error("Error listing backups", { error });
    return [];
  }
}

async function getBackupMetadata(backupName: string): Promise<BackupMetadata | null> {
  try {
    const metadataPath = path.join(BACKUP_DIR, backupName, "backup-metadata.json");
    const content = await fs.readFile(metadataPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function createCurrentBackup() {
  const timestamp = format(new Date(), "yyyy-MM-dd-HHmmss");
  const backupName = `pre-restore-${timestamp}`;
  const backupPath = path.join(BACKUP_DIR, backupName);

  loggers.backup.info(`Creating backup of current data: ${backupName}`);

  await copyDirectory(JSON_DATA_DIR, backupPath);

  return backupName;
}

async function copyDirectory(src: string, dest: string) {
  await fs.mkdir(dest, { recursive: true });

  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else if (entry.name.endsWith(".json")) {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function restoreBackup(backupName: string) {
  try {
    const backupPath = path.join(BACKUP_DIR, backupName);

    // Check if backup exists
    try {
      await fs.access(backupPath);
    } catch {
      throw new Error(`Backup not found: ${backupName}`);
    }

    // Create backup of current data before restore
    const preRestoreBackup = await createCurrentBackup();
    loggers.backup.info(`Created pre-restore backup: ${preRestoreBackup}`);

    // Clear current JSON data directory
    loggers.backup.info("Clearing current JSON data...");
    await fs.rm(JSON_DATA_DIR, { recursive: true, force: true });

    // Restore from backup
    loggers.backup.info(`Restoring from backup: ${backupName}`);
    await copyDirectory(backupPath, JSON_DATA_DIR);

    // Verify restoration
    const restoredFiles = await countFiles(JSON_DATA_DIR);
    loggers.backup.info("Restore completed", { restoredFiles });

    return {
      backupName,
      preRestoreBackup,
      restoredFiles,
    };
  } catch (error) {
    loggers.backup.error("Restore failed", { error });
    throw error;
  }
}

async function countFiles(dir: string): Promise<number> {
  let count = 0;
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      count += await countFiles(path.join(dir, entry.name));
    } else if (entry.name.endsWith(".json")) {
      count++;
    }
  }

  return count;
}

async function formatFileSize(bytes: number): Promise<string> {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

async function interactiveRestore() {
  const backups = await listBackups();

  if (backups.length === 0) {
    console.log("❌ No backups found");
    return;
  }

  // Get metadata for each backup
  console.log("\nAvailable backups:");
  for (let i = 0; i < backups.length; i++) {
    const backupName = backups[i];
    const metadata = await getBackupMetadata(backupName);
    if (metadata) {
      const date = format(parseISO(metadata.timestamp), "yyyy-MM-dd HH:mm:ss");
      const size = await formatFileSize(metadata.size);
      console.log(`${i + 1}. ${backupName} (${date}, ${metadata.files} files, ${size})`);
    } else {
      console.log(`${i + 1}. ${backupName}`);
    }
  }

  // Simple prompt without inquirer
  console.log("\nEnter the number of the backup to restore (or 0 to cancel):");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question("> ", async (answer) => {
    const choice = parseInt(answer);
    rl.close();

    if (choice === 0 || choice > backups.length || Number.isNaN(choice)) {
      console.log("❌ Restore cancelled");
      return;
    }

    const selectedBackup = backups[choice - 1];

    console.log(`\nYou selected: ${selectedBackup}`);
    console.log("Current data will be backed up first. Continue? (y/N)");

    const rl2 = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl2.question("> ", async (confirm) => {
      rl2.close();

      if (confirm.toLowerCase() !== "y") {
        console.log("❌ Restore cancelled");
        return;
      }

      try {
        const result = await restoreBackup(selectedBackup);
        console.log("✅ Restore completed successfully");
        console.log(`   Pre-restore backup: ${result.preRestoreBackup}`);
        console.log(`   Restored ${result.restoredFiles} files`);
      } catch (error) {
        console.error("❌ Restore failed:", error);
      }
    });
  });
}

// Run if called directly
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length > 0 && args[0].startsWith("--backup=")) {
    // Direct restore with backup name
    const backupName = args[0].replace("--backup=", "");
    restoreBackup(backupName)
      .then((result) => {
        console.log("✅ Restore completed successfully");
        console.log(`   Pre-restore backup: ${result.preRestoreBackup}`);
        console.log(`   Restored ${result.restoredFiles} files`);
        process.exit(0);
      })
      .catch((error) => {
        console.error("❌ Restore failed:", error);
        process.exit(1);
      });
  } else if (args.includes("--latest")) {
    // Restore latest backup
    listBackups()
      .then((backups) => {
        if (backups.length === 0) {
          throw new Error("No backups found");
        }
        return restoreBackup(backups[0]);
      })
      .then((result) => {
        console.log("✅ Restore completed successfully");
        console.log(`   Pre-restore backup: ${result.preRestoreBackup}`);
        console.log(`   Restored ${result.restoredFiles} files`);
        process.exit(0);
      })
      .catch((error) => {
        console.error("❌ Restore failed:", error);
        process.exit(1);
      });
  } else {
    // Interactive mode
    interactiveRestore();
  }
}

export { restoreBackup, listBackups };
