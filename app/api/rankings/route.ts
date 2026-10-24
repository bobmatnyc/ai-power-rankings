import { NextResponse } from "next/server";
import { cachedJsonResponse } from "@/lib/api-cache";
import { getDb } from "@/lib/db/connection";
import { loggers } from "@/lib/logger";
import { loadCurrentRankings } from "@/lib/rankings/current-rankings";

export async function GET(): Promise<NextResponse> {
  try {
    // Only use mock data in test environment
    if (process.env.NODE_ENV === "test") {
      // Dynamic import for test-only mock data
      const { getMockRankingsResponse } = await import("@/lib/test-utils/mock-rankings");
      const mockResponse = getMockRankingsResponse();
      return cachedJsonResponse(mockResponse, "/api/rankings");
    }

    // Get database connection - will throw if not available
    const db = getDb();
    if (!db) {
      // Should never reach here as getDb() throws for non-test environments
      loggers.api.error("Database connection not available");
      return NextResponse.json(
        {
          error: "Database connection unavailable",
          message: "The database service is currently unavailable. Please try again later.",
        },
        { status: 503 }
      );
    }

    loggers.api.debug("Getting rankings from database");

    // See #192: the home page reads the same snapshot rows through this function.
    const current = await loadCurrentRankings();
    if (!current) {
      loggers.api.warn("No current rankings found in database");

      // Return a proper empty response structure
      return cachedJsonResponse(
        {
          rankings: [],
          algorithm: {
            version: "v1.0",
            name: "No Rankings Available",
            date: new Date().toISOString(),
            weights: { newsImpact: 0.3, baseScore: 0.7 },
          },
          stats: {
            total_tools: 0,
            tools_with_news: 0,
            avg_news_boost: 0,
            max_news_impact: 0,
          },
          _source: "empty",
          _timestamp: new Date().toISOString(),
          _message: "No rankings data available. Please check back later.",
        },
        "/api/rankings"
      );
    }

    // See #192: joined to tools and sorted by rank in lib/rankings/current-rankings.ts.
    const { snapshot: currentRankings, rankings: validRankings } = current;

    // Calculate statistics
    const toolsWithNews = validRankings.filter(
      (r) => r?.metrics?.news_articles_count && r.metrics.news_articles_count > 0
    ).length;

    const newsImpacts = validRankings
      .map((r) => r?.scores?.news_impact || 0)
      .filter((impact) => impact > 0);

    const avgNewsBoost =
      newsImpacts.length > 0 ? newsImpacts.reduce((a, b) => a + b, 0) / newsImpacts.length : 0;

    const maxNewsImpact = newsImpacts.length > 0 ? Math.max(...newsImpacts) : 0;

    return cachedJsonResponse(
      {
        rankings: validRankings,
        // published_at reflects when the current snapshot was actually published,
        // so the public UI can surface an honest "Rankings as of <date>" marker
        // (falls back to created_at for legacy rows that predate published_at).
        published_at: (currentRankings.published_at ?? currentRankings.created_at).toISOString(),
        period: currentRankings.period,
        algorithm: {
          version: currentRankings.algorithm_version || "v1.0",
          name: "Database Rankings",
          date: currentRankings.created_at.toISOString(),
          weights: { newsImpact: 0.3, baseScore: 0.7 },
        },
        stats: {
          total_tools: validRankings.length,
          tools_with_news: toolsWithNews,
          avg_news_boost: avgNewsBoost,
          max_news_impact: maxNewsImpact,
        },
        _source: "database",
        _timestamp: new Date().toISOString(),
        _cacheVersion: "2025-09-26-db", // Force cache refresh with new database source
      },
      "/api/rankings"
    );
  } catch (error) {
    loggers.api.error("Error fetching rankings", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    // In development, provide more helpful error messages
    if (process.env.NODE_ENV === "development") {
      console.error("Rankings API Error Details:");
      console.error("  Error:", error);

      // If it's a database connection error, provide setup instructions
      const errorMessage = error instanceof Error ? error.message.toLowerCase() : "";
      if (
        errorMessage.includes("database") ||
        errorMessage.includes("connection") ||
        errorMessage.includes("required for development")
      ) {
        return NextResponse.json(
          {
            error: "Database connection required",
            message: "Database connection is REQUIRED for development. Please configure your database.",
            instructions: [
              "1. Copy .env.example to .env.local",
              "2. Set DATABASE_URL with your database connection string",
              "3. Visit https://neon.tech to create a free PostgreSQL database"
            ],
            details: {
              type: error instanceof Error ? error.constructor.name : typeof error,
              message: error instanceof Error ? error.message : String(error)
            }
          },
          { status: 503 }
        );
      }
    }

    return NextResponse.json(
      {
        error: "Failed to fetch rankings",
        message: process.env.NODE_ENV === "development"
          ? `Error: ${error instanceof Error ? error.message : "Unknown error"}`
          : "An error occurred while fetching rankings. Please try again later.",
        details: process.env.NODE_ENV === "development" ? {
          type: error instanceof Error ? error.constructor.name : typeof error,
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack?.split("\n").slice(0, 5) : undefined,
        } : undefined,
      },
      { status: 500 }
    );
  }
}
