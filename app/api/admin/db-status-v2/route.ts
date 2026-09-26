import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getDb, testConnection } from "@/lib/db/connection";

// Force Node.js runtime instead of Edge Runtime
export const runtime = "nodejs";

export async function GET() {
  try {
    console.log("[db-status-v2] Starting request");

    // Check admin authentication
    const authResult = await requireAdmin();
    if (authResult.error) {
      return authResult.error;
    }

    // Get database status
    const databaseUrl = process.env["DATABASE_URL"];

    // Test connection
    const isConnected = await testConnection();
    const db = getDb();

    return NextResponse.json({
      status: "ok",
      connected: isConnected,
      enabled: true, // Always using database now
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
