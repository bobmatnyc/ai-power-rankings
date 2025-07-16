import path from "node:path";
import fs from "fs-extra";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import { loggers } from "@/lib/logger";
import { backupManager } from "./backup-manager";

export abstract class BaseRepository<T> {
  protected db: Low<T>;
  protected dbPath: string;
  protected logger = loggers.db;

  constructor(filePath: string, defaultData: T) {
    this.dbPath = filePath;

    // Ensure directory exists
    const dir = path.dirname(filePath);
    fs.ensureDirSync(dir);

    // Initialize lowdb
    const adapter = new JSONFile<T>(filePath);
    this.db = new Low<T>(adapter, defaultData);
  }

  /**
   * Read data from file
   */
  protected async read(): Promise<void> {
    try {
      await this.db.read();
    } catch (error) {
      this.logger.error("Failed to read database", { path: this.dbPath, error });
      throw error;
    }
  }

  /**
   * Write data to file with atomic operation
   */
  protected async write(): Promise<void> {
    try {
      // Create backup before write using backup manager
      const operation = `write-${path.basename(this.dbPath)}`;
      await backupManager.createBackupBeforeWrite(operation);

      await this.db.write();
      this.logger.info("Database written successfully", { path: this.dbPath });
    } catch (error) {
      this.logger.error("Failed to write database", { path: this.dbPath, error });

      // Attempt to restore from backup
      const backupPath = `${this.dbPath}.backup`;
      if (await fs.pathExists(backupPath)) {
        await fs.copy(backupPath, this.dbPath);
        this.logger.info("Restored from backup", { path: this.dbPath });
      }

      throw error;
    }
  }

  /**
   * Initialize database
   */
  async initialize(): Promise<void> {
    await this.read();
  }

  /**
   * Get all data
   */
  async getData(): Promise<T> {
    await this.read();
    return this.db.data;
  }

  /**
   * Update data with callback
   */
  async update(updater: (data: T) => void | Promise<void>): Promise<void> {
    await this.read();
    await updater(this.db.data);
    await this.write();
  }

  /**
   * Create backup
   */
  async backup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = `${this.dbPath}.${timestamp}.backup`;

    if (await fs.pathExists(this.dbPath)) {
      await fs.copy(this.dbPath, backupPath);
      this.logger.info("Backup created", { path: backupPath });
      return backupPath;
    }

    return "";
  }

  /**
   * Restore from backup
   */
  async restore(backupPath: string): Promise<void> {
    if (await fs.pathExists(backupPath)) {
      await fs.copy(backupPath, this.dbPath);
      await this.read();
      this.logger.info("Restored from backup", { from: backupPath, to: this.dbPath });
    } else {
      throw new Error(`Backup file not found: ${backupPath}`);
    }
  }

  /**
   * Get file size
   */
  async getFileSize(): Promise<number> {
    if (await fs.pathExists(this.dbPath)) {
      const stats = await fs.stat(this.dbPath);
      return stats.size;
    }
    return 0;
  }

  /**
   * Validate data (to be implemented by subclasses)
   */
  abstract validate(data: T): Promise<boolean>;
}
