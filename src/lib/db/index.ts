/**
 * Database Module Entry Point
 * Exports the configured database connection
 */

import { getDb } from "./connection";

// Get the database connection
const database = getDb();

// Export the database connection (may be null if not configured)
export const db = database;

// Re-export schema for convenience
export * from "./schema";
