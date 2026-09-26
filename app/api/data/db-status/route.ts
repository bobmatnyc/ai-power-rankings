import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getDb, testConnection } from "@/lib/db/connection";

/**
 * GET /api/data/db-status
 *
 * Why: Reports the database name, host and connection errors, so only an
 * admin may read it. It used to accept any request that carried a session
 * cookie, whatever the cookie's value.
 * What: `requireAdmin()` verifies the Clerk session first (401 anonymous,
 * 403 non-admin); only then is the database touched or described.
 * Test: `tests/unit/auth-hardening.test.ts`.
 */
export async function GET() {
  const authResult = await requireAdmin();
  if (authResult.error) {
    return authResult.error;
  }

  try {
    // Get database configuration
    const databaseUrl = process.env["DATABASE_URL"];
    const nodeEnv = process.env["NODE_ENV"] || "development";

    // Parse database URL for safe info
    const dbInfo = parseDatabaseUrl(databaseUrl);

    // Test actual connection
    let isConnected = false;
    let connectionError = null;
    try {
      isConnected = await testConnection();
    } catch (connError) {
      console.error("[data/db-status] Connection test failed:", connError);
      connectionError = connError instanceof Error ? connError.message : "Connection test failed";
    }

    // Get current database instance status
    let hasActiveInstance = false;
    try {
      const db = getDb();
      hasActiveInstance = db !== null;
    } catch (dbError) {
      console.error("[data/db-status] Error getting database instance:", dbError);
    }

    // Prepare response with safe information
    const status = {
      // Connection status
      connected: isConnected,
      enabled: true, // Always using database now
      configured: Boolean(databaseUrl && !databaseUrl.includes("YOUR_PASSWORD")),
      hasActiveInstance,
      connectionError,

      // Environment info
      environment: dbInfo.environment,
      nodeEnv,

      // Database details (safe to expose)
      database: dbInfo.database,
      maskedHost: dbInfo.maskedHost,
      provider: dbInfo.provider,

      // Additional metadata
      timestamp: new Date().toISOString(),
      authMethod: "clerk",

      // Status summary
      status: isConnected
        ? "connected"
        : !databaseUrl
          ? "not_configured"
          : "disconnected",

      // Display type for UI
      type: "postgresql",
      displayEnvironment: dbInfo.environment,
    };

    console.log("[data/db-status] Returning database status");
    return NextResponse.json(status, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("[data/db-status] Error getting database status:", error);

    const errorResponse = {
      error: "Failed to get database status",
      message: error instanceof Error ? error.message : "Unknown error",
      connected: false,
      status: "error",
      timestamp: new Date().toISOString(),
      authMethod: "clerk",
      stack:
        process.env["NODE_ENV"] === "development" && error instanceof Error
          ? error.stack
          : undefined,
    };

    return NextResponse.json(errorResponse, {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}

/**
 * Parse database URL to extract safe connection info
 * @param url Database connection string
 * @returns Parsed connection info with sensitive data removed
 */
function parseDatabaseUrl(url: string | undefined) {
  if (!url) {
    return {
      environment: "not_configured",
      database: "N/A",
      maskedHost: "N/A",
      provider: "N/A",
    };
  }

  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname || "";

    // Determine environment based on hostname patterns
    let environment: "development" | "production" = "production";
    if (
      hostname.includes("ep-bold-sunset") ||
      hostname.includes("ep-autumn-glitter") ||
      hostname.includes("localhost") ||
      hostname.includes("127.0.0.1") ||
      hostname.includes("dev") ||
      hostname.includes("test")
    ) {
      environment = "development";
    }

    if (hostname.includes("ep-wispy-fog")) {
      environment = "production";
    }

    // Extract database name from pathname
    const database = urlObj.pathname.slice(1).split("?")[0] || "default";

    // Use full hostname (no masking)
    const maskedHost = hostname;

    // Detect provider from hostname
    let provider = "postgresql";
    if (hostname.includes("neon")) {
      provider = "neon";
    } else if (hostname.includes("supabase")) {
      provider = "supabase";
    } else if (hostname.includes("aws")) {
      provider = "aws-rds";
    } else if (hostname.includes("azure")) {
      provider = "azure";
    } else if (hostname.includes("google")) {
      provider = "gcp";
    }

    return {
      environment,
      database,
      maskedHost,
      provider,
    };
  } catch (error) {
    console.error("Error parsing database URL:", error);
    return {
      environment: "unknown" as const,
      database: "parse_error",
      maskedHost: "parse_error",
      provider: "unknown",
    };
  }
}

// Use Node.js runtime
export const runtime = "nodejs";
