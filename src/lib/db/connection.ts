/**
 * Database Connection Module
 * Manages PostgreSQL connection using Drizzle ORM and Neon
 *
 * Database Branching Strategy:
 * - Development: Uses DATABASE_URL_DEVELOPMENT (fallback to DATABASE_URL)
 * - Production: Always uses DATABASE_URL
 * - Staging: Uses DATABASE_URL_STAGING (if available)
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
  } catch {
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
 * Get the appropriate database URL based on environment
 * Implements database branching strategy for different environments
 */
function getDatabaseUrl(): string | undefined {
  const nodeEnv = NODE_ENV;

  // Development environment
  if (nodeEnv === "development") {
    const devUrl = process.env["DATABASE_URL_DEVELOPMENT"];
    const fallbackUrl = process.env["DATABASE_URL"];

    if (devUrl && !devUrl.includes("YOUR_PASSWORD")) {
      console.log("🔧 Using DATABASE_URL_DEVELOPMENT (development branch)");
      return devUrl;
    } else if (fallbackUrl && !fallbackUrl.includes("YOUR_PASSWORD")) {
      console.log("⚠️ DATABASE_URL_DEVELOPMENT not found, falling back to DATABASE_URL");
      return fallbackUrl;
    }
    return undefined;
  }

  // Staging environment
  if ((nodeEnv as string) === "staging") {
    const stagingUrl = process.env["DATABASE_URL_STAGING"];
    const fallbackUrl = process.env["DATABASE_URL"];

    if (stagingUrl && !stagingUrl.includes("YOUR_PASSWORD")) {
      console.log("🚦 Using DATABASE_URL_STAGING (staging branch)");
      return stagingUrl;
    } else if (fallbackUrl && !fallbackUrl.includes("YOUR_PASSWORD")) {
      console.log("⚠️ DATABASE_URL_STAGING not found, falling back to DATABASE_URL");
      return fallbackUrl;
    }
    return undefined;
  }

  // Production environment
  const prodUrl = process.env["DATABASE_URL"];
  if (prodUrl && !prodUrl.includes("YOUR_PASSWORD")) {
    console.log("🚀 Using DATABASE_URL (production branch)");
    return prodUrl;
  }

  return undefined;
}

/**
 * Get database connection
 * Returns null if database is not configured
 * ALWAYS uses database - no JSON fallback
 */
export function getDb() {
  // Get appropriate database URL based on environment
  const DATABASE_URL = getDatabaseUrl();

  // Check if database URL is configured
  if (!DATABASE_URL) {
    console.error("❌ CRITICAL: Database URL not configured for environment:", NODE_ENV);
    console.error("Database connection is REQUIRED - no JSON fallback available");
    throw new Error(`Database connection required but not configured for environment: ${NODE_ENV}`);
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
    console.log("📍 Environment:", NODE_ENV);
    console.log("🔗 Database host:", DATABASE_URL.split("@")[1]?.split("/")[0] || "unknown");
    return db;
  } catch (error) {
    console.error("❌ Failed to connect to database:", error);

    // Log additional context in production for debugging
    if (NODE_ENV === "production") {
      console.error("Production database connection failure details:", {
        hasUrl: !!DATABASE_URL,
        urlLength: DATABASE_URL?.length || 0,
        nodeEnv: NODE_ENV,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        errorStack: error instanceof Error ? error.stack?.substring(0, 500) : "No stack",
      });
    }

    // Always throw error - no fallback to JSON
    throw new Error(`Failed to establish database connection: ${error instanceof Error ? error.message : "Unknown error"}`);
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
    const DATABASE_URL = getDatabaseUrl();
    if (!sql) {
      if (!DATABASE_URL) {
        throw new Error(`No database URL available for environment: ${NODE_ENV}`);
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
        hasUrl: !!getDatabaseUrl(),
        environment: NODE_ENV,
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
