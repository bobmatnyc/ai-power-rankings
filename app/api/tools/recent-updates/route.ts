/**
 * API Endpoint: Recently Updated Tools
 *
 * Fetches tools that have been updated within a specified time period.
 * Used by the "What's New" modal to show recent changes.
 *
 * @route GET /api/tools/recent-updates
 * @query {number} days - Number of days to look back (default: 7, min: 1, max: 365)
 *
 * @returns {Object} Response object
 * @returns {boolean} response.success - Whether the request was successful
 * @returns {Array} response.tools - Array of recently updated tools
 * @returns {number} response.count - Number of tools returned
 * @returns {string} response.timestamp - ISO timestamp of response
 *
 * @example
 * // Default query (last 7 days)
 * fetch('/api/tools/recent-updates')
 *
 * @example
 * // Custom time period (last 30 days)
 * fetch('/api/tools/recent-updates?days=30')
 */

import { NextResponse } from "next/server";
import { ToolsRepository } from "@/lib/db/repositories/tools.repository";
import { getDb } from "@/lib/db/connection";
import { loggers } from "@/lib/logger";
import { gte, desc, eq, and } from "drizzle-orm";
import { tools } from "@/lib/db/schema";

export async function GET(request: Request) {
  const startTime = Date.now();

  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const daysParam = searchParams.get("days");
    const days = daysParam ? parseInt(daysParam, 10) : 7;

    // Validate days parameter
    if (isNaN(days) || days < 1 || days > 365) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid days parameter",
          message: "Days parameter must be a number between 1 and 365",
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Get database connection
    const db = getDb();
    if (!db) {
      loggers.api.error("Database connection not available");
      return NextResponse.json(
        {
          success: false,
          error: "Database connection unavailable",
          message: "The database service is currently unavailable. Please try again later.",
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }

    loggers.api.debug(`Fetching tools updated in the last ${days} days`);

    // Calculate the date threshold
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - days);

    // Query tools updated after the threshold date (active only)
    const recentTools = await db
      .select({
        id: tools.id,
        name: tools.name,
        slug: tools.slug,
        category: tools.category,
        updatedAt: tools.updatedAt,
        data: tools.data,
      })
      .from(tools)
      .where(
        and(
          gte(tools.updatedAt, dateThreshold),
          eq(tools.status, "active")
        )
      )
      .orderBy(desc(tools.updatedAt))
      .limit(10);

    // Format the response
    const formattedTools = recentTools.map((tool) => {
      // Extract description from data JSONB field
      const toolData = tool.data as Record<string, unknown> || {};
      const description = (toolData["description"] as string) || "";

      return {
        id: tool.id,
        name: tool.name,
        slug: tool.slug,
        description: description,
        updatedAt: tool.updatedAt.toISOString(),
        category: tool.category,
      };
    });

    const processingTime = Date.now() - startTime;
    loggers.api.info("Recent tools fetched successfully", {
      count: formattedTools.length,
      days: days,
      processingTimeMs: processingTime,
    });

    const response = {
      success: true,
      tools: formattedTools,
      count: formattedTools.length,
      timestamp: new Date().toISOString(),
    };

    // Add caching headers for performance
    return new NextResponse(JSON.stringify(response), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
        "X-Processing-Time": `${processingTime}ms`,
      },
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;

    loggers.api.error("Error fetching recent tools", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      processingTimeMs: processingTime,
    });

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch recent tools",
        message: error instanceof Error ? error.message : "An unexpected error occurred",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Enable CORS for this endpoint
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
