import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getDb, testConnection } from "@/lib/db/connection";

// Force Node.js runtime instead of Edge Runtime
export const runtime = "nodejs";

export async function GET() {
  try {
    console.log("[db-status-v2] Starting request");

    // Check if auth is disabled
    const isAuthDisabled = process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";
    console.log("[db-status-v2] Auth disabled:", isAuthDisabled);

    if (!isAuthDisabled) {
      // Use Clerk auth directly
      console.log("[db-status-v2] Checking auth...");
      const authResult = await auth();
      console.log("[db-status-v2] Auth result - userId:", authResult?.userId);

      if (!authResult?.userId) {
        return NextResponse.json(
          { error: "Unauthorized", message: "Authentication required" },
          { status: 401 }
        );
      }

      // For now, skip admin check to isolate the issue
      console.log("[db-status-v2] User authenticated, proceeding...");
    }

    // Get database status
    const databaseUrl = process.env["DATABASE_URL"];
    const useDatabase = process.env["USE_DATABASE"] === "true";

    // Test connection
    const isConnected = await testConnection();
    const db = getDb();

    return NextResponse.json({
      status: "ok",
      connected: isConnected,
      enabled: useDatabase,
      configured: Boolean(databaseUrl && !databaseUrl.includes("YOUR_PASSWORD")),
      hasActiveInstance: db !== null,
      timestamp: new Date().toISOString(),
      version: "v2",
    });
  } catch (error) {
    console.error("[db-status-v2] Error:", error);
    return NextResponse.json(
      {
        error: "Failed",
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
