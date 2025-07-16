#!/usr/bin/env tsx

/**
 * Backup JSON Data Script
 * Creates timestamped backups of all JSON data files
 */

import fs from "node:fs/promises";
import path from "node:path";
import { format } from "date-fns";
import { loggers } from "../lib/logger";

const JSON_DATA_DIR = path.join(process.cwd(), "data", "json");
const BACKUP_DIR = path.join(process.cwd(), "data", "backups");
const MAX_BACKUPS = 10; // Keep only the last 10 backups

async function ensureDirectories() {
  await fs.mkdir(BACKUP_DIR, { recursive: true });
}

async function getBackupName(): Promise<string> {
  const timestamp = format(new Date(), "yyyy-MM-dd-HHmmss");
  return `backup-${timestamp}`;
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

async function cleanOldBackups() {
  try {
    const backups = await fs.readdir(BACKUP_DIR);
    const backupDirs = backups
      .filter((name) => name.startsWith("backup-"))
      .sort()
      .reverse();

    // Remove old backups beyond MAX_BACKUPS
    const toRemove = backupDirs.slice(MAX_BACKUPS);

    for (const dir of toRemove) {
      const backupPath = path.join(BACKUP_DIR, dir);
      await fs.rm(backupPath, { recursive: true, force: true });
      loggers.backup.info(`Removed old backup: ${dir}`);
    }
  } catch (error) {
    loggers.backup.error("Error cleaning old backups", { error });
  }
}

async function createBackup() {
  try {
    await ensureDirectories();

    const backupName = await getBackupName();
    const backupPath = path.join(BACKUP_DIR, backupName);

    loggers.backup.info(`Creating backup: ${backupName}`);

    // Copy all JSON data
    await copyDirectory(JSON_DATA_DIR, backupPath);

    // Create backup metadata
    const metadata = {
      timestamp: new Date().toISOString(),
      backupName,
      files: await countFiles(backupPath),
      size: await getDirectorySize(backupPath),
    };

    await fs.writeFile(
      path.join(backupPath, "backup-metadata.json"),
      JSON.stringify(metadata, null, 2)
    );

    // Clean old backups
    await cleanOldBackups();

    loggers.backup.info("Backup completed successfully", metadata);

    return backupName;
  } catch (error) {
    loggers.backup.error("Backup failed", { error });
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

async function getDirectorySize(dir: string): Promise<number> {
  let size = 0;
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      size += await getDirectorySize(fullPath);
    } else {
      const stats = await fs.stat(fullPath);
      size += stats.size;
    }
  }

  return size;
}

// Run if called directly
if (require.main === module) {
  createBackup()
    .then((backupName) => {
      console.log(`✅ Backup created: ${backupName}`);
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Backup failed:", error);
      process.exit(1);
    });
}

export { createBackup };
