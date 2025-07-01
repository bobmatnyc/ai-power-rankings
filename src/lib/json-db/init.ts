/**
 * Initialize JSON database and start automated processes
 */

import { backupManager } from "./backup-manager";
import { loggers } from "../logger";

let initialized = false;

export async function initializeJsonDb() {
  if (initialized) {
    return;
  }

  try {
    // Start automated backups
    if (process.env.NODE_ENV === "production") {
      backupManager.startAutomatedBackups();
      loggers.db.info("JSON database initialized with automated backups");
    } else {
      loggers.db.info("JSON database initialized (automated backups disabled in development)");
    }

    initialized = true;
  } catch (error) {
    loggers.db.error("Failed to initialize JSON database", { error });
  }
}

// Do not auto-initialize in production - let it be called explicitly
// This prevents issues with serverless environments where setInterval
// can keep the process alive indefinitely
