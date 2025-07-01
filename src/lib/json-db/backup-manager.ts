/**
 * Backup Manager
 * Handles automated backups for JSON data
 */

import fs from "fs/promises";
import path from "path";
import { format } from "date-fns";
import { loggers } from "../logger";

export class BackupManager {
  private static instance: BackupManager;
  private backupInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  static getInstance(): BackupManager {
    if (!BackupManager.instance) {
      BackupManager.instance = new BackupManager();
    }
    return BackupManager.instance;
  }

  /**
   * Create a backup before write operations
   */
  async createBackupBeforeWrite(operation: string): Promise<void> {
    try {
      loggers.backup.info(`Creating backup before operation: ${operation}`);
      await this.createBackup();
    } catch (error) {
      loggers.backup.error("Failed to create backup before write", { operation, error });
      // Don't throw - allow write to proceed even if backup fails
    }
  }

  /**
   * Start automated daily backups
   */
  startAutomatedBackups(): void {
    // Skip automated backups in serverless environments
    // These should be handled by external cron jobs or scheduled functions
    if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
      loggers.backup.info("Automated backups disabled in serverless environment");
      return;
    }

    if (this.backupInterval) {
      return; // Already running
    }

    // Run daily at 2 AM
    const runDaily = () => {
      const now = new Date();
      const nextRun = new Date(now);
      nextRun.setDate(nextRun.getDate() + 1);
      nextRun.setHours(2, 0, 0, 0);

      const msUntilNextRun = nextRun.getTime() - now.getTime();

      setTimeout(() => {
        this.performAutomatedBackup();
        // Schedule next run
        this.backupInterval = setInterval(
          () => {
            this.performAutomatedBackup();
          },
          24 * 60 * 60 * 1000
        ); // 24 hours
      }, msUntilNextRun);
    };

    runDaily();
    loggers.backup.info("Automated backups scheduled");
  }

  /**
   * Stop automated backups
   */
  stopAutomatedBackups(): void {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
      this.backupInterval = null;
      loggers.backup.info("Automated backups stopped");
    }
  }

  private async performAutomatedBackup(): Promise<void> {
    try {
      loggers.backup.info("Starting automated backup");
      const backupName = await this.createBackup();
      loggers.backup.info("Automated backup completed", { backupName });
    } catch (error) {
      loggers.backup.error("Automated backup failed", { error });
    }
  }

  /**
   * Create a backup of all JSON data files
   */
  private async createBackup(): Promise<string> {
    const JSON_DATA_DIR = path.join(process.cwd(), "data", "json");
    const BACKUP_DIR = path.join(process.cwd(), "data", "backups");
    const MAX_BACKUPS = 10;

    // Ensure backup directory exists
    await fs.mkdir(BACKUP_DIR, { recursive: true });

    // Create timestamp for backup
    const timestamp = format(new Date(), "yyyy-MM-dd-HHmmss");
    const backupPath = path.join(BACKUP_DIR, `backup-${timestamp}`);

    // Create backup directory
    await fs.mkdir(backupPath, { recursive: true });

    // Copy all JSON files
    const files = await fs.readdir(JSON_DATA_DIR);
    const jsonFiles = files.filter((file) => file.endsWith(".json"));

    for (const file of jsonFiles) {
      const sourcePath = path.join(JSON_DATA_DIR, file);
      const destPath = path.join(backupPath, file);
      await fs.copyFile(sourcePath, destPath);
    }

    // Create metadata
    const metadata = {
      timestamp,
      date: new Date().toISOString(),
      files: jsonFiles,
      fileCount: jsonFiles.length,
    };

    await fs.writeFile(
      path.join(backupPath, "backup-metadata.json"),
      JSON.stringify(metadata, null, 2)
    );

    // Clean up old backups
    await this.cleanupOldBackups(BACKUP_DIR, MAX_BACKUPS);

    loggers.backup.info(`Backup created: ${backupPath}`, {
      fileCount: jsonFiles.length,
    });

    return backupPath;
  }

  /**
   * Clean up old backups keeping only the most recent ones
   */
  private async cleanupOldBackups(backupDir: string, maxBackups: number): Promise<void> {
    try {
      const entries = await fs.readdir(backupDir, { withFileTypes: true });
      const backupDirs = entries
        .filter((entry) => entry.isDirectory() && entry.name.startsWith("backup-"))
        .map((entry) => entry.name)
        .sort()
        .reverse();

      if (backupDirs.length > maxBackups) {
        const toDelete = backupDirs.slice(maxBackups);

        for (const dir of toDelete) {
          const dirPath = path.join(backupDir, dir);
          await fs.rm(dirPath, { recursive: true, force: true });
          loggers.backup.info(`Deleted old backup: ${dir}`);
        }
      }
    } catch (error) {
      loggers.backup.error("Failed to cleanup old backups", { error });
    }
  }
}

// Export singleton instance
export const backupManager = BackupManager.getInstance();
