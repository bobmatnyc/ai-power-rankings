/**
 * Test endpoint to verify database branching configuration
 * This endpoint shows which database branch is currently being used
 */

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/connection";

export async function GET() {
  try {
    // Get environment information
    const nodeEnv = process.env["NODE_ENV"] || "development";
    const databaseUrlDev = process.env["DATABASE_URL_DEVELOPMENT"];
    const databaseUrlProd = process.env["DATABASE_URL"];
    const databaseUrlStaging = process.env["DATABASE_URL_STAGING"];

    // Extract host information for display (without credentials)
    const extractHost = (url?: string) => {
      if (!url) return "Not configured";
      try {
        const match = url.match(/@([^/]+)/);
        return match ? match[1] : "Unknown";
      } catch {
        return "Parse error";
      }
    };

    // Get database connection
    const db = getDb();
    let activeDatabase = null;
    let articleCount = 0;
    let toolCount = 0;
    let tablesFound: string[] = [];

    if (db) {
      try {
        // Get article count
        const articlesResult = await db.execute<{ count: number }>(
          "SELECT COUNT(*) as count FROM articles"
        );
        articleCount = articlesResult.rows[0]?.count || 0;

        // Get tool count
        const toolsResult = await db.execute<{ count: number }>(
          "SELECT COUNT(*) as count FROM tools"
        );
        toolCount = toolsResult.rows[0]?.count || 0;

        // Get list of tables
        const tablesResult = await db.execute<{ tablename: string }>(
          `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
        );
        tablesFound = tablesResult.rows.map((row) => row.tablename);

        // Determine which database URL is being used
        if (nodeEnv === "development" && databaseUrlDev) {
          activeDatabase = {
            name: "DATABASE_URL_DEVELOPMENT",
            branch: "development",
            host: extractHost(databaseUrlDev),
          };
        } else if ((nodeEnv as string) === "staging" && databaseUrlStaging) {
          activeDatabase = {
            name: "DATABASE_URL_STAGING",
            branch: "staging",
            host: extractHost(databaseUrlStaging),
          };
        } else if (databaseUrlProd) {
          activeDatabase = {
            name: "DATABASE_URL",
            branch: "production",
            host: extractHost(databaseUrlProd),
          };
        }
      } catch (error) {
        console.error("Database query error:", error);
      }
    }

    return NextResponse.json({
      success: true,
      environment: {
        NODE_ENV: nodeEnv,
        USE_DATABASE: process.env["USE_DATABASE"] === "true",
      },
      databaseConfig: {
        development: {
          configured: !!databaseUrlDev && !databaseUrlDev.includes("YOUR_PASSWORD"),
          host: extractHost(databaseUrlDev),
        },
        production: {
          configured: !!databaseUrlProd && !databaseUrlProd.includes("YOUR_PASSWORD"),
          host: extractHost(databaseUrlProd),
        },
        staging: {
          configured: !!databaseUrlStaging && !databaseUrlStaging.includes("YOUR_PASSWORD"),
          host: extractHost(databaseUrlStaging),
        },
      },
      activeDatabase,
      databaseStatus: {
        connected: !!db,
        tables: tablesFound,
        tableCount: tablesFound.length,
        articleCount,
        toolCount,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Database branch test error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        environment: {
          NODE_ENV: process.env["NODE_ENV"] || "development",
          USE_DATABASE: process.env["USE_DATABASE"] === "true",
        },
      },
      { status: 500 }
    );
  }
}
