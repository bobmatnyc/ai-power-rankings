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

import { Pool, neonConfig } from "@neondatabase/serverless";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { drizzle as drizzlePool } from "drizzle-orm/neon-serverless";
// Explicitly import article tables to ensure they're included
import { articleProcessingLogs, articleRankingsChanges, articles } from "./article-schema";
import * as schema from "./schema";

// Configure Neon for optimal performance
neonConfig.fetchConnectionCache = true;
neonConfig.poolQueryViaFetch = true;

// Connection pool for better performance
let pool: Pool | null = null;
// Singleton pattern for database connection - union type of both drizzle instances
let db: ReturnType<typeof drizzle> | ReturnType<typeof drizzlePool> | null = null;
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
 * Get database connection with connection pooling
 * Throws an error if database is not configured (except in test environment)
 */
export function getDb(): typeof db {
  // Skip database initialization during Next.js build phase
  // Environment variables are not fully available during build time
  const isNextJsBuild = process.env["NEXT_PHASE"] === "phase-production-build";
  if (isNextJsBuild) {
    console.log("⏭️  Skipping database connection during Next.js build phase");
    return null;
  }

  // Get appropriate database URL based on environment
  const DATABASE_URL = getDatabaseUrl();

  // Check if database URL is configured
  if (!DATABASE_URL) {
    // Database is REQUIRED for all environments except test
    if (NODE_ENV === "test") {
      // Only allow null database in test environment
      return null;
    }

    // For development, show helpful error but don't allow fallback
    if (NODE_ENV === "development") {
      console.error("❌ Database connection REQUIRED for development");
      console.error("Please configure your database:");
      console.error("1. Copy .env.example to .env.local");
      console.error("2. Set DATABASE_URL with your database connection string");
      console.error("3. Visit https://neon.tech to create a free PostgreSQL database");
      console.error("");
      console.error("Development cannot proceed without a database connection.");
      throw new Error("Database connection required for development. See instructions above.");
    }

    console.error("❌ CRITICAL: Database URL not configured for environment:", NODE_ENV);
    console.error("Database connection is REQUIRED in production/staging environments");
    throw new Error(`Database connection required but not configured for environment: ${NODE_ENV}`);
  }

  // Return existing connection if available
  if (db) {
    return db;
  }

  try {
    // Use connection pooling in production for better performance
    const usePool = NODE_ENV === "production" || (NODE_ENV as string) === "staging";

    if (usePool) {
      // Create connection pool for production/staging
      if (!pool) {
        pool = new Pool({
          connectionString: DATABASE_URL,
          // Connection pool configuration for optimal performance
          max: 10, // Maximum number of connections in the pool
          maxUses: 1000, // Max number of times a connection can be reused
          connectionTimeoutMillis: 10000, // 10 seconds connection timeout
        });
      }

      // Create Drizzle instance with pooled connection
      const fullSchema = {
        ...schema,
        articles,
        articleProcessingLogs,
        articleRankingsChanges,
      };
      db = drizzlePool(pool, { schema: fullSchema });

      console.log("✅ Database connection pool established");
    } else {
      // Use HTTP connection for development (simpler, no pooling needed)
      sql = neon(DATABASE_URL);

      // Create Drizzle instance with schema
      const fullSchema = {
        ...schema,
        articles,
        articleProcessingLogs,
        articleRankingsChanges,
      };
      db = drizzle(sql, { schema: fullSchema });

      console.log("✅ Database connection established (HTTP mode)");
    }

    console.log("📍 Environment:", NODE_ENV);
    // Extract just the endpoint ID (e.g., "ep-dark-firefly-adp1p3v8") from the full host
    const fullHost = DATABASE_URL.split("@")[1]?.split("/")[0] || "unknown";
    const endpointId = fullHost.split("-pooler")[0] || fullHost;
    console.log("🔗 Database endpoint:", endpointId);
    console.log("⚡ Connection mode:", usePool ? "Pooled" : "HTTP");

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

    // Always throw error - no fallbacks allowed except in test environment
    throw new Error(
      `Failed to establish database connection: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
  const database = getDb();

  if (!database) {
    // Only allowed in test environment
    if (NODE_ENV === "test") {
      console.log("Test environment - database connection skipped");
      return false;
    }
    // Should never reach here as getDb() throws for non-test environments
    throw new Error("Database connection required");
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
export async function closeDb() {
  if (pool) {
    await pool.end();
    pool = null;
  }
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
