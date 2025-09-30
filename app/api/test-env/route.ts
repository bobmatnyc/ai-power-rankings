import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, testConnection } from "@/lib/db/connection";

export async function GET() {
  const apiKey = process.env["OPENROUTER_API_KEY"];
  const databaseUrl = process.env["DATABASE_URL"];
  const useDatabase = process.env["USE_DATABASE"] === "true";

  // Test database connection
  let dbStatus = "not_configured";
  let dbDetails = {};

  if (useDatabase && databaseUrl) {
    try {
      const isConnected = await testConnection();
      if (isConnected) {
        dbStatus = "connected";

        // Get database info
        const db = getDb();
        if (db) {
          // Count tools in database
          const toolsCount = await db.execute(sql`SELECT COUNT(*) as count FROM tools`);
          const newsCount = await db.execute(sql`SELECT COUNT(*) as count FROM news`);
          const rankingsCount = await db.execute(sql`SELECT COUNT(*) as count FROM rankings`);

          dbDetails = {
            toolsCount: toolsCount.rows[0]?.["count"] || 0,
            newsCount: newsCount.rows[0]?.["count"] || 0,
            rankingsCount: rankingsCount.rows[0]?.["count"] || 0,
            databaseHost: databaseUrl.includes("neon.tech") ? "neon" : "unknown",
            isProduction: !!databaseUrl.includes("ep-wispy-fog"),
          };
        }
      }
    } catch (error) {
      dbStatus = "error";
      dbDetails = { error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  return NextResponse.json({
    openRouter: {
      hasKey: Boolean(apiKey),
      keyPrefix: apiKey ? apiKey.substring(0, 15) : null,
      keySuffix: apiKey ? apiKey.substring(apiKey.length - 4) : null,
      keyLength: apiKey ? apiKey.length : 0,
    },
    database: {
      useDatabase,
      status: dbStatus,
      details: dbDetails,
      urlConfigured: Boolean(databaseUrl),
      urlContainsNeon: databaseUrl ? databaseUrl.includes("neon.tech") : false,
    },
    environment: {
      nodeEnv: process.env["NODE_ENV"],
      vercelEnv: process.env["VERCEL_ENV"],
    },
  });
}
