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

// Auto-initialize on import in production
if (process.env.NODE_ENV === "production") {
  initializeJsonDb();
}
