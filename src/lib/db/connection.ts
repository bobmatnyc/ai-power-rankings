/**
 * Database Connection Module
 * Manages PostgreSQL connection using Drizzle ORM and Neon
 */

// Load environment variables from .env files FIRST
import * as dotenv from "dotenv";

// Load environment-specific config
const NODE_ENV = process.env["NODE_ENV"] || "development";

if (NODE_ENV === "production") {
  // In production, load .env.production.local first, then .env.production
  dotenv.config({ path: ".env.production.local" });
  dotenv.config({ path: ".env.production" });
} else {
  // In development, load .env.local first, then .env
  dotenv.config({ path: ".env.local" });
  dotenv.config({ path: ".env" });
}

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Environment variables with fallback
const DATABASE_URL = process.env["DATABASE_URL"];
const USE_DATABASE = process.env["USE_DATABASE"] === "true";

// Singleton pattern for database connection
let db: ReturnType<typeof drizzle> | null = null;
let sql: ReturnType<typeof neon> | null = null;

/**
 * Get database connection
 * Returns null if database is disabled or not configured
 */
export function getDb() {
  // Return null if database is disabled
  if (!USE_DATABASE) {
    return null;
  }

  // Check if database URL is configured
  if (!DATABASE_URL || DATABASE_URL.includes("YOUR_PASSWORD")) {
    console.warn("Database URL not configured. Using JSON file storage.");
    return null;
  }

  // Return existing connection if available
  if (db) {
    return db;
  }

  try {
    // Create Neon SQL client
    sql = neon(DATABASE_URL);

    // Create Drizzle instance with schema
    db = drizzle(sql, { schema });

    console.log("✅ Database connection established");
    return db;
  } catch (error) {
    console.error("❌ Failed to connect to database:", error);
    return null;
  }
}

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
  const database = getDb();

  if (!database) {
    console.log("Database is disabled or not configured");
    return false;
  }

  try {
    // Simple query to test connection
    if (!sql) {
      if (!DATABASE_URL) {
        throw new Error("DATABASE_URL environment variable is not defined");
      }
      sql = neon(DATABASE_URL);
    }
    const result = await sql`SELECT NOW() as current_time`;
    console.log(
      "✅ Database connection test successful:",
      Array.isArray(result) && result.length > 0 ? result[0] : result
    );
    return true;
  } catch (error) {
    console.error("❌ Database connection test failed:", error);
    return false;
  }
}

/**
 * Close database connection (for cleanup)
 */
export function closeDb() {
  if (sql) {
    sql = null;
  }
  if (db) {
    db = null;
    console.log("Database connection closed");
  }
}

// Export configured database instance
export { db };
