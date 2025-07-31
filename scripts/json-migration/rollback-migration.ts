#!/usr/bin/env tsx

/**
 * JSON Database Migration Rollback Script
 *
 * Rollback mechanism for JSON database migration
 * Part of Epic EP-001: Migrate to Static JSON Database Architecture
 */

import path from "node:path";
import { prompt } from "enquirer";
import fs from "fs-extra";
import { initializeRepositories } from "../../src/lib/json-db";
import { loggers } from "../../src/lib/logger";

const logger = loggers.migration;

interface RollbackOptions {
  backupPath?: string;
  collections?: string[];
  confirmPrompt?: boolean;
}

class MigrationRollback {
  private backupDir: string;

  constructor() {
    this.backupDir = path.join(process.cwd(), "data", "json", "backups");
  }

  async rollback(options: RollbackOptions = {}): Promise<void> {
    try {
      logger.info("Starting migration rollback...");

      // Initialize repositories
      await initializeRepositories();

      // Get backup to restore from
      const backupPath = await this.selectBackup(options.backupPath);
      if (!backupPath) {
        logger.error("No backup selected for rollback");
        return;
      }

      // Confirm rollback
      if (options.confirmPrompt !== false) {
        const confirmed = await this.confirmRollback(backupPath);
        if (!confirmed) {
          logger.info("Rollback cancelled by user");
          return;
        }
      }

      // Create rollback backup of current state
      await this.createRollbackBackup();

      // Perform rollback
      const collections = options.collections || ["companies", "tools", "rankings", "news"];
      await this.restoreFromBackup(backupPath, collections);

      logger.info("Migration rollback completed successfully");
    } catch (error) {
      logger.error("Migration rollback failed", { error });
      throw error;
    }
  }

  private async selectBackup(providedPath?: string): Promise<string | null> {
    if (providedPath) {
      if (await fs.pathExists(providedPath)) {
        return providedPath;
      } else {
        logger.error("Provided backup path does not exist", { path: providedPath });
        return null;
      }
    }

    // List available backups
    const backups = await this.listAvailableBackups();
    if (backups.length === 0) {
      logger.error("No backups available for rollback");
      return null;
    }

    // Interactive backup selection
    const choices = backups.map((backup) => ({
      name: `${backup.name} (${backup.date})`,
      value: backup.path,
    }));

    const response = await prompt({
      type: "select",
      name: "backup",
      message: "Select backup to restore from:",
      choices,
    } as any);

    return (response as any).backup;
  }

  private async listAvailableBackups(): Promise<
    Array<{
      name: string;
      path: string;
      date: string;
    }>
  > {
    if (!(await fs.pathExists(this.backupDir))) {
      return [];
    }

    const files = await fs.readdir(this.backupDir, { withFileTypes: true });
    const backups = [];

    for (const file of files) {
      if (file.isDirectory()) {
        const backupPath = path.join(this.backupDir, file.name);
        const stat = await fs.stat(backupPath);

        backups.push({
          name: file.name,
          path: backupPath,
          date: stat.mtime.toISOString(),
        });
      }
    }

    return backups.sort((a, b) => b.date.localeCompare(a.date));
  }

  private async confirmRollback(backupPath: string): Promise<boolean> {
    logger.warn("CAUTION: This will overwrite current JSON data with backup data");
    logger.info("Backup path:", { path: backupPath });

    const response = await prompt({
      type: "confirm",
      name: "confirmed",
      message: "Are you sure you want to proceed with the rollback?",
      initial: false,
    } as any);

    return (response as any).confirmed;
  }

  private async createRollbackBackup(): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const rollbackBackupDir = path.join(this.backupDir, `pre-rollback-${timestamp}`);

    await fs.ensureDir(rollbackBackupDir);

    // Backup current JSON files
    const dataDir = path.join(process.cwd(), "data", "json");
    const collectionsToBackup = ["tools", "rankings", "news", "companies"];

    for (const collection of collectionsToBackup) {
      const sourcePath = path.join(dataDir, collection);
      const targetPath = path.join(rollbackBackupDir, collection);

      if (await fs.pathExists(sourcePath)) {
        await fs.copy(sourcePath, targetPath);
        logger.info(`Backed up ${collection} data`, { target: targetPath });
      }
    }

    // Create rollback metadata
    const metadata = {
      timestamp,
      type: "pre-rollback-backup",
      note: "Automatic backup created before rollback operation",
    };

    await fs.writeJson(path.join(rollbackBackupDir, "metadata.json"), metadata, { spaces: 2 });

    logger.info("Pre-rollback backup created", { path: rollbackBackupDir });
  }

  private async restoreFromBackup(backupPath: string, collections: string[]): Promise<void> {
    const dataDir = path.join(process.cwd(), "data", "json");

    for (const collection of collections) {
      try {
        const backupCollectionPath = path.join(backupPath, collection);
        const targetCollectionPath = path.join(dataDir, collection);

        if (await fs.pathExists(backupCollectionPath)) {
          // Remove current data
          if (await fs.pathExists(targetCollectionPath)) {
            await fs.remove(targetCollectionPath);
          }

          // Restore from backup
          await fs.copy(backupCollectionPath, targetCollectionPath);
          logger.info(`Restored ${collection} from backup`);
        } else {
          logger.warn(`No backup data found for ${collection}`);
        }
      } catch (error) {
        logger.error(`Failed to restore ${collection}`, { error });
        throw error;
      }
    }
  }

  async clearAllJsonData(): Promise<void> {
    const confirmed = await prompt({
      type: "confirm",
      name: "confirmed",
      message: "DANGER: This will delete ALL JSON data. Are you absolutely sure?",
      initial: false,
    } as any);

    if (!(confirmed as any).confirmed) {
      logger.info("Clear operation cancelled");
      return;
    }

    const dataDir = path.join(process.cwd(), "data", "json");
    const collectionsToRemove = ["tools", "rankings", "news", "companies"];

    for (const collection of collectionsToRemove) {
      const collectionPath = path.join(dataDir, collection);
      if (await fs.pathExists(collectionPath)) {
        await fs.remove(collectionPath);
        logger.info(`Removed ${collection} data`);
      }
    }

    logger.info("All JSON data cleared");
  }

  async listBackups(): Promise<void> {
    const backups = await this.listAvailableBackups();

    if (backups.length === 0) {
      logger.info("No backups available");
      return;
    }

    logger.info("Available backups:");
    for (const backup of backups) {
      logger.info(`  ${backup.name} (${backup.date})`);
    }
  }
}

// CLI interface
if (require.main === module) {
  const rollback = new MigrationRollback();
  const command = process.argv[2];

  switch (command) {
    case "rollback":
      rollback
        .rollback({
          backupPath: process.argv[3],
          confirmPrompt: true,
        })
        .then(() => {
          logger.info("Rollback completed successfully");
          process.exit(0);
        })
        .catch((error) => {
          logger.error("Rollback failed", { error });
          process.exit(1);
        });
      break;

    case "list":
      rollback
        .listBackups()
        .then(() => process.exit(0))
        .catch((error) => {
          logger.error("List backups failed", { error });
          process.exit(1);
        });
      break;

    case "clear":
      rollback
        .clearAllJsonData()
        .then(() => {
          logger.info("Clear completed");
          process.exit(0);
        })
        .catch((error) => {
          logger.error("Clear failed", { error });
          process.exit(1);
        });
      break;

    default:
      console.log("Usage:");
      console.log("  tsx scripts/json-migration/rollback-migration.ts rollback [backup-path]");
      console.log("  tsx scripts/json-migration/rollback-migration.ts list");
      console.log("  tsx scripts/json-migration/rollback-migration.ts clear");
      process.exit(1);
  }
}

export { MigrationRollback };
