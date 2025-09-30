import { NextResponse } from "next/server";
import { isAuthenticatedManual } from "@/lib/manual-auth";
import { getDb, testConnection } from "@/lib/db/connection";

/**
 * Database status endpoint using manual authentication
 * This bypasses Clerk's middleware to avoid HTML error responses
 */
export async function GET() {
  try {
    console.log("[db-status-manual] Starting database status check");

    // Check authentication using manual approach
    const isAuth = await isAuthenticatedManual();
    console.log("[db-status-manual] Manual authentication result:", isAuth);

    if (!isAuth) {
      console.log("[db-status-manual] User not authenticated, returning 401");
      return NextResponse.json(
        {
          error: "Unauthorized",
          message: "Admin session required",
          authenticated: false,
          timestamp: new Date().toISOString(),
        },
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    console.log("[db-status-manual] User authenticated, checking database status");

    // Get database configuration
    const databaseUrl = process.env["DATABASE_URL"];
    const useDatabase = process.env["USE_DATABASE"] === "true";
    const nodeEnv = process.env["NODE_ENV"] || "development";

    // Parse database URL for safe info
    const dbInfo = parseDatabaseUrl(databaseUrl);

    // Test actual connection
    let isConnected = false;
    let connectionError = null;
    try {
      isConnected = await testConnection();
    } catch (connError) {
      console.error("[db-status-manual] Connection test failed:", connError);
      connectionError = connError instanceof Error ? connError.message : "Connection test failed";
    }

    // Get current database instance status
    let hasActiveInstance = false;
    try {
      const db = getDb();
      hasActiveInstance = db !== null;
    } catch (dbError) {
      console.error("[db-status-manual] Error getting database instance:", dbError);
    }

    // Prepare response with safe information
    const status = {
      // Connection status
      connected: isConnected,
      enabled: useDatabase,
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
      authMethod: "manual-cookie",

      // Status summary
      status: isConnected
        ? "connected"
        : !useDatabase
          ? "disabled"
          : !databaseUrl
            ? "not_configured"
            : "disconnected",

      // Display type for UI
      type: !useDatabase ? "json" : "postgresql",
      displayEnvironment: !useDatabase ? "local" : dbInfo.environment,
    };

    console.log("[db-status-manual] Returning database status");
    return NextResponse.json(status, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("[db-status-manual] Error getting database status:", error);

    const errorResponse = {
      error: "Failed to get database status",
      message: error instanceof Error ? error.message : "Unknown error",
      connected: false,
      status: "error",
      timestamp: new Date().toISOString(),
      authMethod: "manual-cookie",
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

    // Create masked hostname for security
    let maskedHost = hostname;
    if (hostname && hostname !== "localhost" && hostname !== "127.0.0.1") {
      const parts = hostname.split(".");
      if (parts.length >= 3 && parts[0]) {
        const firstPart = parts[0].split("-");
        if (firstPart.length >= 3 && firstPart[0] && firstPart[1]) {
          maskedHost = `${firstPart[0]}-${firstPart[1]}-******.${parts.slice(1).join(".")}`;
        } else {
          maskedHost = `${parts[0].substring(0, 10)}******.${parts.slice(1).join(".")}`;
        }
      } else if (hostname.length > 8) {
        maskedHost = `${hostname.substring(0, 8)}******`;
      }
    }

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
