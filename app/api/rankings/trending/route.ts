/**
 * Trending Rankings API Endpoint
 *
 * WHY: This endpoint processes historical ranking data to provide trending
 * analysis for chart visualization. It reads all available ranking periods
 * from the database and analyzes them to show how tools have moved in and out of the top 10.
 *
 * DESIGN DECISION: We use PostgreSQL database instead of JSON files because:
 * - All historical data is now stored in the database for consistency
 * - This is a read-only operation with caching for performance
 * - Database provides better scalability and reliability
 * - Maintains consistency with the new database-first architecture
 *
 * PERFORMANCE CONSIDERATIONS:
 * - Reads all ranking periods from database (~8 months of data)
 * - Processing takes ~50ms for full dataset
 * - Results are cached in-memory for 1 hour to reduce database load
 * - Cache headers set for CDN-level caching
 * - Supports time range filtering to reduce payload size
 *
 * @fileoverview API endpoint for trending analysis of historical rankings
 */

import { type NextRequest, NextResponse } from "next/server";
import { loggers } from "@/lib/logger";
import {
  analyzeTrendingData,
  filterTrendingDataByTimeRange,
  type RankingPeriod,
} from "@/lib/trending-analyzer";
import { rankingsRepository } from "@/lib/db/repositories/rankings.repository";
import cacheInstance, { CACHE_TTL } from "@/lib/memory-cache";

/**
 * Reads all historical ranking periods from the database.
 *
 * IMPLEMENTATION NOTE: We fetch all rankings from PostgreSQL and transform
 * them to the RankingPeriod format expected by the trending analyzer.
 * The database stores rankings in JSONB format with the structure:
 * { period: "2025-09", data: { rankings: [...] } }
 */
async function readHistoricalRankings(): Promise<RankingPeriod[]> {
  try {
    // Fetch all rankings from database
    const allRankings = await rankingsRepository.findAll();

    if (!allRankings || allRankings.length === 0) {
      loggers.api.warn("No rankings found in database");
      return [];
    }

    // Transform database format to RankingPeriod format
    const periods: RankingPeriod[] = allRankings
      .map((ranking) => {
        try {
          // Extract rankings array from JSONB data
          // The data structure can be either:
          // 1. { rankings: [...] } - nested structure
          // 2. [...] - direct array
          // 3. { period: "...", rankings: [...] } - full structure
          let rankings;
          if (Array.isArray(ranking.data)) {
            rankings = ranking.data;
          } else if (ranking.data && Array.isArray(ranking.data.rankings)) {
            rankings = ranking.data.rankings;
          } else {
            loggers.api.warn("Invalid ranking data structure", {
              period: ranking.period,
              dataType: typeof ranking.data,
            });
            return null;
          }

          // Validate that rankings is a proper array
          if (!Array.isArray(rankings) || rankings.length === 0) {
            loggers.api.warn("No rankings array found", { period: ranking.period });
            return null;
          }

          // Transform rankings to ensure tool_name is present
          // Database stores tool_slug, but trending analyzer expects tool_name
          const transformedRankings = rankings.map((entry: any) => {
            return {
              ...entry,
              tool_name: entry.tool_name || entry.tool_slug || entry.tool_id,
              position: entry.position || entry.rank,
            };
          });

          return {
            period: ranking.period,
            date: ranking.period, // Use period as date
            rankings: transformedRankings,
            algorithm_version: ranking.algorithm_version,
          } as RankingPeriod;
        } catch (error) {
          loggers.api.error("Failed to transform ranking data", {
            period: ranking.period,
            error,
          });
          return null;
        }
      })
      .filter((p): p is RankingPeriod => p !== null);

    loggers.api.info("Successfully loaded historical rankings from database", {
      periodsCount: periods.length,
      dateRange:
        periods.length > 0
          ? {
              start: Math.min(...periods.map((p) => new Date(p.period).getTime())),
              end: Math.max(...periods.map((p) => new Date(p.period).getTime())),
            }
          : null,
    });

    return periods;
  } catch (error) {
    loggers.api.error("Failed to read historical rankings from database", { error });
    throw new Error("Unable to load historical ranking data");
  }
}

/**
 * GET /api/rankings/trending
 *
 * Returns trending analysis of historical ranking data.
 *
 * Query Parameters:
 * - months: number | 'all' - Time range to analyze (default: 'all')
 *
 * Response Format:
 * ```json
 * {
 *   "periods": ["2025-01", "2025-02", ...],
 *   "tools": [
 *     {
 *       "tool_id": "1",
 *       "tool_name": "Tool Name",
 *       "periods_in_top10": 6,
 *       "best_position": 1,
 *       "current_position": 3
 *     }
 *   ],
 *   "chart_data": [
 *     {
 *       "period": "2025-01",
 *       "date": "Jan 2025",
 *       "1": 1,  // tool_id: position
 *       "2": 2,
 *       "3": null  // not in top 10 this period
 *     }
 *   ],
 *   "metadata": {
 *     "total_periods": 8,
 *     "date_range": { "start": "2025-01", "end": "2025-08" },
 *     "top_tools_count": 15
 *   }
 * }
 * ```
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const monthsParam = searchParams.get("months");

    let timeRange: number | "all" = "all";
    if (monthsParam && monthsParam !== "all") {
      const months = parseInt(monthsParam, 10);
      if (!Number.isNaN(months) && months > 0) {
        timeRange = months;
      }
    }

    // Create cache key based on time range
    const cacheKey = `trending:${timeRange}`;

    // Check cache first
    const cachedData = cacheInstance.get(cacheKey);
    if (cachedData) {
      const processingTime = Date.now() - startTime;
      loggers.api.info("Trending analysis served from cache", {
        timeRange,
        processingTimeMs: processingTime,
      });

      // Set cache headers for performance
      const headers = new Headers({
        "Content-Type": "application/json",
        // Cache for 1 hour since historical data doesn't change frequently
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
        // Add cache status header
        "X-Cache-Status": "HIT",
        // Add ETag for better cache validation
        ETag: `"trending-${(cachedData as any).metadata.total_periods}-${timeRange}"`,
      });

      return new NextResponse(JSON.stringify(cachedData), {
        status: 200,
        headers,
      });
    }

    // Load historical ranking data
    let periods;
    try {
      periods = await readHistoricalRankings();
    } catch (readError) {
      loggers.api.error("Failed to read historical rankings", {
        error: readError instanceof Error ? readError.message : "Unknown error",
        stack: readError instanceof Error ? readError.stack : undefined,
      });

      // Return empty result instead of error
      const processingTime = Date.now() - startTime;
      loggers.api.warn("Returning empty trending data due to read error", {
        processingTimeMs: processingTime,
      });

      return NextResponse.json(
        {
          periods: [],
          tools: [],
          chart_data: [],
          metadata: {
            total_periods: 0,
            date_range: { start: "", end: "" },
            top_tools_count: 0,
          },
          warning: "No historical ranking data available",
        },
        { status: 200 }
      );
    }

    if (periods.length === 0) {
      loggers.api.warn("No historical rankings found in database");

      return NextResponse.json(
        {
          periods: [],
          tools: [],
          chart_data: [],
          metadata: {
            total_periods: 0,
            date_range: { start: "", end: "" },
            top_tools_count: 0,
          },
          warning: "No historical ranking data available",
        },
        { status: 200 }
      );
    }

    // Analyze trending data
    const trendingData = analyzeTrendingData(periods);

    // Apply time range filter if specified
    const finalData =
      timeRange === "all" ? trendingData : filterTrendingDataByTimeRange(trendingData, timeRange);

    // Store in cache (1 hour TTL)
    cacheInstance.set(cacheKey, finalData, 3600000); // 1 hour in milliseconds

    const processingTime = Date.now() - startTime;

    loggers.api.info("Trending analysis completed", {
      timeRange,
      periodsProcessed: periods.length,
      toolsFound: finalData.tools.length,
      chartDataPoints: finalData.chart_data.length,
      processingTimeMs: processingTime,
      cached: true,
    });

    // Set cache headers for performance
    const headers = new Headers({
      "Content-Type": "application/json",
      // Cache for 1 hour since historical data doesn't change frequently
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      // Add cache status header
      "X-Cache-Status": "MISS",
      // Add ETag for better cache validation
      ETag: `"trending-${finalData.metadata.total_periods}-${timeRange}"`,
    });

    return new NextResponse(JSON.stringify(finalData), {
      status: 200,
      headers,
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;

    loggers.api.error("Failed to generate trending analysis", {
      error: error instanceof Error ? error.message : error,
      processingTimeMs: processingTime,
    });

    return NextResponse.json(
      {
        error: "Failed to analyze trending data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS /api/rankings/trending
 *
 * CORS support for the trending endpoint.
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
