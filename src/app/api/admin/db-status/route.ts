import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth-helper";
import { getDb, testConnection } from "@/lib/db/connection";

// Force Node.js runtime instead of Edge Runtime
export const runtime = "nodejs";

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
      host: "N/A",
      provider: "N/A",
      maskedHost: "N/A",
    };
  }

  try {
    // Parse the connection URL
    const urlObj = new URL(url);

    // Determine environment based on hostname patterns
    let environment: "development" | "production" = "production";
    const hostname = urlObj.hostname || "";

    // Check for development patterns - specifically check for development database hostnames
    if (
      hostname.includes("ep-bold-sunset") || // Specific Neon dev instance
      hostname.includes("ep-autumn-glitter") || // Additional Neon dev instance
      hostname.includes("localhost") ||
      hostname.includes("127.0.0.1") ||
      hostname.includes("dev") ||
      hostname.includes("test")
    ) {
      environment = "development";
    }

    // Production patterns - explicitly check for production database hostnames
    if (hostname.includes("ep-wispy-fog")) {
      environment = "production";
    }

    // Extract database name from pathname
    const database = urlObj.pathname.slice(1).split("?")[0] || "default";

    // Create masked hostname for security
    let maskedHost = hostname;
    if (hostname && hostname !== "localhost" && hostname !== "127.0.0.1") {
      // For Neon hosts like ep-bold-sunset-123456.aws.neon.tech
      const parts = hostname.split(".");
      if (parts.length >= 3 && parts[0]) {
        const firstPart = parts[0].split("-");
        if (firstPart.length >= 3 && firstPart[0] && firstPart[1]) {
          // Mask the identifier part but keep the descriptive prefix
          maskedHost = `${firstPart[0]}-${firstPart[1]}-******.${parts.slice(1).join(".")}`;
        } else {
          // For other formats, mask after first segment
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
      host: hostname,
      maskedHost,
      provider,
    };
  } catch (error) {
    console.error("Error parsing database URL:", error);
    return {
      environment: "unknown" as const,
      database: "parse_error",
      host: "parse_error",
      maskedHost: "parse_error",
      provider: "unknown",
    };
  }
}

export async function GET() {
  try {
    // Log start of request for debugging
    console.log("[db-status] Starting GET request");
    console.log("[db-status] Auth disabled:", process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true");

    // Check admin authentication with error handling
    let isAuth = false;
    try {
      console.log("[db-status] Checking authentication...");
      isAuth = await isAuthenticated();
      console.log("[db-status] Authentication result:", isAuth);
    } catch (authError) {
      console.error("[db-status] Authentication check failed:", authError);
      console.error("[db-status] Auth error stack:", authError instanceof Error ? authError.stack : "No stack");

      // Return specific error for auth failures
      return NextResponse.json(
        {
          error: "Authentication check failed",
          message: authError instanceof Error ? authError.message : "Unknown authentication error",
          details: process.env["NODE_ENV"] === "development" ?
            (authError instanceof Error ? authError.stack : String(authError)) : undefined
        },
        { status: 500 }
      );
    }

    if (!isAuth) {
      console.log("[db-status] User not authenticated, returning 401");
      return NextResponse.json({ error: "Unauthorized - Admin session required" }, { status: 401 });
    }

    console.log("[db-status] User authenticated, proceeding with database status check");

    // Get database configuration
    const databaseUrl = process.env["DATABASE_URL"];
    const useDatabase = process.env["USE_DATABASE"] === "true";
    const nodeEnv = process.env["NODE_ENV"] || "development";

    // Parse database URL for safe info
    const dbInfo = parseDatabaseUrl(databaseUrl);

    // Test actual connection
    const isConnected = await testConnection();

    // Get current database instance status
    const db = getDb();
    const hasActiveInstance = db !== null;

    // Prepare response with safe information
    const status = {
      // Connection status
      connected: isConnected,
      enabled: useDatabase,
      configured: Boolean(databaseUrl && !databaseUrl.includes("YOUR_PASSWORD")),
      hasActiveInstance,

      // Environment info
      environment: dbInfo.environment,
      nodeEnv,

      // Database details (safe to expose)
      database: dbInfo.database,
      host: dbInfo.host,
      maskedHost: dbInfo.maskedHost,
      provider: dbInfo.provider,

      // Additional metadata
      timestamp: new Date().toISOString(),

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

    console.log("[db-status] Returning status response");
    return NextResponse.json(status);
  } catch (error) {
    console.error("[db-status] Error getting database status:", error);
    console.error("[db-status] Error stack:", error instanceof Error ? error.stack : "No stack");
    return NextResponse.json(
      {
        error: "Failed to get database status",
        message: error instanceof Error ? error.message : "Unknown error",
        connected: false,
        status: "error",
      },
      { status: 500 }
    );
  }
}
