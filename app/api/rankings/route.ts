import { NextResponse } from "next/server";
import { uncachedJsonResponse } from "@/lib/api-cache";
import { getDb } from "@/lib/db/connection";
import { loggers } from "@/lib/logger";
import { loadCurrentRankings } from "@/lib/rankings/current-rankings";
import { parseRankingListParam, RANKING_LISTS, rankingListMeta } from "@/lib/rankings/lists";

/**
 * `GET /api/rankings[?list=<list>]`: one list's current board (#186).
 *
 * Why: #186 replaces the one global board with one board per list. D51: with no list
 *   parameter the response is the coding-harness board, and every response names the
 *   list it holds, so a caller never mistakes one board for another.
 * What: `list` (or its alias `kind`, the issue's name) is a list id (`harness`,
 *   `model`, `productivity`) or its URL slug. An unknown value is 400 and lists the
 *   valid ones. The body is the #192 shape plus `list` and `list_meta` (entry count,
 *   D53 indexable flag and tier scheme, D54 provisional-note flag) and `list_source`
 *   (`list` for the list's own row, `combined` for the legacy board split by list).
 * Test: `tests/unit/api-rankings-per-list-186.test.ts`,
 *   `tests/unit/home-live-rankings-192.test.tsx`.
 */
// #186: Next.js route exports require a non-optional Request
export async function GET(request: Request): Promise<NextResponse> {
  // #186: D51 — an absent list parameter means the coding-harness board.
  const params = new URL(request.url).searchParams;
  const rawList = params.get("list");
  const rawKind = params.get("kind");
  const parsed = parseRankingListParam(rawList ?? rawKind);
  // #186: a present-but-empty list, or list and kind naming different lists, is an error, never the default.
  const kindParsed = rawList !== null && rawKind !== null ? parseRankingListParam(rawKind) : null;
  if ((rawList ?? rawKind)?.trim() === "" || (kindParsed && (!kindParsed.ok || (parsed.ok && kindParsed.list !== parsed.list)))) {
    return NextResponse.json(
      { error: "Unknown list", message: "list must name one list, and agree with kind when both are given", lists: [...RANKING_LISTS] },
      { status: 400 }
    );
  }
  if (!parsed.ok) {
    return NextResponse.json(
      { error: "Unknown list", message: parsed.error, lists: [...RANKING_LISTS] },
      { status: 400 }
    );
  }
  const { list } = parsed;

  try {
    // Only use mock data in test environment
    if (process.env.NODE_ENV === "test") {
      // Dynamic import for test-only mock data
      const { getMockRankingsResponse } = await import("@/lib/test-utils/mock-rankings");
      const mockResponse = getMockRankingsResponse();
      return uncachedJsonResponse(
        { ...mockResponse, list, list_meta: rankingListMeta(list, mockResponse.rankings.length) },
        200
      );
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
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    loggers.api.debug("Getting rankings from database");

    // See #192: the home page reads the same snapshot rows through this function.
    const current = await loadCurrentRankings(list);
    if (!current) {
      loggers.api.warn("No current rankings found in database");

      // Return a proper empty response structure
      return uncachedJsonResponse(
        {
          rankings: [],
          list, // #186: D51, the response names its list
          list_meta: rankingListMeta(list, 0),
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
        200
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

    return uncachedJsonResponse(
      {
        rankings: validRankings,
        // #186: D51 names the list; list_meta carries the D53 and D54 rules for it.
        list,
        // #329: D63 — the models list is indexed only with 10+ active rows carrying metrics.
        list_meta: rankingListMeta(list, validRankings.length, current.metricRowCount),
        list_source: current.source,
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
      200 // #311: no-store, so the edge never serves a board from before a publish
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
          { status: 503, headers: { "Cache-Control": "no-store" } }
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
      { status: 500, headers: { "Cache-Control": "no-store" } } // #311: never cache a failure
    );
  }
}
