/**
 * Database Connection Module
 * Manages PostgreSQL connection using Drizzle ORM and Neon
 */

// Only load dotenv in development environments
// In production (Vercel), environment variables are set via the dashboard
const NODE_ENV = process.env["NODE_ENV"] || "development";

if (NODE_ENV === "development") {
  // Load environment variables from .env files in development only
  try {
    const dotenv = require("dotenv");
    dotenv.config({ path: ".env.local" });
    dotenv.config({ path: ".env" });
  } catch (error) {
    // Fail silently if dotenv is not available
    console.warn("dotenv not available, skipping .env file loading");
  }
}

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
// Explicitly import article tables to ensure they're included
import { articleProcessingLogs, articleRankingsChanges, articles } from "./article-schema";
import * as schema from "./schema";

// Singleton pattern for database connection
let db: ReturnType<typeof drizzle> | null = null;
let sql: ReturnType<typeof neon> | null = null;

/**
 * Get database connection
 * Returns null if database is disabled or not configured
 */
export function getDb() {
  // Read environment variables at runtime, not build time
  const DATABASE_URL = process.env["DATABASE_URL"];
  const USE_DATABASE = process.env["USE_DATABASE"] === "true";

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
    // Create Neon SQL client (DATABASE_URL is guaranteed to exist here)
    sql = neon(DATABASE_URL);

    // Create Drizzle instance with schema
    // Ensure article tables are included
    const fullSchema = {
      ...schema,
      articles,
      articleProcessingLogs,
      articleRankingsChanges,
    };
    db = drizzle(sql, { schema: fullSchema });

    console.log("✅ Database connection established");
    return db;
  } catch (error) {
    console.error("❌ Failed to connect to database:", error);

    // Log additional context in production for debugging
    if (NODE_ENV === "production") {
      console.error("Production database connection failure details:", {
        hasUrl: !!DATABASE_URL,
        urlLength: DATABASE_URL?.length || 0,
        useDatabase: USE_DATABASE,
        nodeEnv: NODE_ENV,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        errorStack: error instanceof Error ? error.stack?.substring(0, 500) : "No stack",
      });
    }

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
    const DATABASE_URL = process.env["DATABASE_URL"];
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

    // Additional logging for production debugging
    if (NODE_ENV === "production") {
      console.error("Production connection test failure:", {
        hasDatabase: !!database,
        hasSql: !!sql,
        hasUrl: !!process.env["DATABASE_URL"],
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }

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
