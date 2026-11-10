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
import cacheInstance from "@/lib/memory-cache";
import { isMetricGatedList, listOfTool, parseListQuery, RANKING_LISTS, type RankingList } from "@/lib/rankings/lists";
import { gateStoredEntries, measuredPredicate, toolLookup } from "@/lib/rankings/metric-gated-board";
import type { RawRankingEntry } from "@/lib/tools/ranking-entry";
import {
  keepCombinedMembers,
  type MergedHistory,
  mergeTrendingHistory,
  usesCombinedFallback,
} from "@/lib/rankings/trending-history";

type StoredRankingRow = Awaited<ReturnType<typeof rankingsRepository.findAll>>[number];

/**
 * Reads the ranking history of one list from the database.
 *
 * Why: #185 made a list's history its own stored boards, which start at the first v8
 *   publish (2026-11). T76: the coding-harness history before that exists only as the
 *   legacy combined boards, so the chart showed one period.
 * What: reads the list's boards (`findAllForList`). For a list in
 *   `COMBINED_FALLBACK_LISTS` that has at least one board, it also reads the combined
 *   boards (`findAll`) and keeps those earlier than the list's first board. Each period
 *   carries its source. D1c: the combined periods keep only the list's own tools
 *   (`listOfTool`), renumbered. Any failed read or tools lookup throws, so a partial or
 *   unfiltered history is never served.
 * Test: `tests/unit/rankings-current-trending-185.test.ts`, `tests/unit/trending-harness-only-d1c.test.ts`
 */
async function readHistoricalRankings(list: RankingList): Promise<MergedHistory<RankingPeriod>> {
  try {
    const listPeriods = toRankingPeriods(await rankingsRepository.findAllForList(list));
    // T76: history spans the combined-to-per-list boundary
    const combinedPeriods =
      usesCombinedFallback(list) && listPeriods.length > 0
        ? toRankingPeriods(await rankingsRepository.findAll())
        : [];
    const merged = mergeTrendingHistory(listPeriods, combinedPeriods);
    // Both types describe the same stored JSONB rows.
    const raw = (p: RankingPeriod) => p.rankings as unknown as RawRankingEntry[];

    // D1c: the combined boards ranked every kind of tool; their months show only this
    // list's tools (`listOfTool`, as the per-list boards), renumbered. A failed tools
    // lookup throws to the 500 below, never the unfiltered history.
    const combinedOnly = merged.periods.filter((p) => p.source === "combined");
    if (combinedOnly.length > 0) {
      const toolOf = await toolLookup(combinedOnly.flatMap(raw));
      merged.periods = keepCombinedMembers(merged.periods, (entry) => {
        const tool = toolOf(entry as unknown as RawRankingEntry);
        return tool !== undefined && listOfTool(tool["kind"], tool["modality"]) === list;
      });
    }

    // #329: a metric-gated list's history shows measured models only, in every period.
    // One tools lookup covers all periods; a failed lookup throws to the 500 below.
    if (isMetricGatedList(list)) {
      const isMeasured = await measuredPredicate(merged.periods.flatMap(raw));
      for (const p of merged.periods) {
        p.rankings = gateStoredEntries(list, raw(p), isMeasured) as unknown as RankingPeriod["rankings"];
      }
    }

    loggers.api.info("Loaded ranking history", {
      list,
      periodsCount: merged.periods.length,
      combinedPeriods: merged.periods.filter((p) => p.source === "combined").length,
      firstListPeriod: merged.firstListPeriod,
    });
    return merged;
  } catch (error) {
    loggers.api.error("Failed to read historical rankings from database", { error });
    throw new Error("Unable to load historical ranking data");
  }
}

/**
 * Transforms stored ranking rows to the `RankingPeriod` format of the trending analyzer.
 * A row whose JSONB data holds no rankings array is logged and left out.
 */
function toRankingPeriods(allRankings: StoredRankingRow[] | null | undefined): RankingPeriod[] {
  if (!allRankings || allRankings.length === 0) {
    return [];
  }

  return allRankings
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
}

/**
 * GET /api/rankings/trending
 *
 * Returns trending analysis of historical ranking data.
 *
 * Query Parameters:
 * - months: number | 'all' - Time range to analyze (default: 'all')
 * - list (alias kind): #185, the list whose history is analyzed; default the coding
 *   harnesses. Unknown, empty or conflicting is 400.
 *
 * #185: a failed read is 500 with no cached body; it is never an empty 200.
 * T76: the harness history includes the combined boards before its first per-list board.
 *   `period_sources` gives each period's source (`combined` | `list`) and
 *   `metadata.first_list_period` the boundary. A failed combined read is the same 500,
 *   never a 200 holding only the per-list periods.
 * #329: a metric-gated list's periods hold measured models only; a failed tools lookup is 500.
 * Test: `tests/unit/rankings-current-trending-185.test.ts`, `tests/unit/trending-metric-gate-329.test.ts`.
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
 *   "period_sources": [{ "period": "2025-01", "source": "combined" }, ...],
 *   "metadata": {
 *     "total_periods": 8,
 *     "date_range": { "start": "2025-01", "end": "2025-08" },
 *     "top_tools_count": 15,
 *     "first_list_period": "2025-08"
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
    // #185: one list's history, default.
    const parsed = parseListQuery(searchParams);
    if (!parsed.ok) {
      return NextResponse.json(
        { error: "Unknown list", message: parsed.error, lists: [...RANKING_LISTS] },
        { status: 400 }
      );
    }
    const { list } = parsed;

    let timeRange: number | "all" = "all";
    if (monthsParam && monthsParam !== "all") {
      const months = parseInt(monthsParam, 10);
      if (!Number.isNaN(months) && months > 0) {
        timeRange = months;
      }
    }

    // Create cache key based on time range
    const cacheKey = `trending:${list}:${timeRange}`;

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
        ETag: `"trending-${list}-${(cachedData as any).metadata.total_periods}-${timeRange}"`,
      });

      return new NextResponse(JSON.stringify(cachedData), {
        status: 200,
        headers,
      });
    }

    // Load historical ranking data
    let history: MergedHistory<RankingPeriod>;
    try {
      history = await readHistoricalRankings(list);
    } catch (readError) {
      loggers.api.error("Failed to read historical rankings", {
        list,
        error: readError instanceof Error ? readError.message : "Unknown error",
        stack: readError instanceof Error ? readError.stack : undefined,
      });
      // #185: a failed read is an error, never an empty 200 that a cache would keep.
      return NextResponse.json(
        { error: "Failed to read ranking history", list },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    const periods = history.periods;
    if (periods.length === 0) {
      loggers.api.warn("No historical rankings found in database");

      return NextResponse.json(
        {
          list,
          periods: [],
          tools: [],
          chart_data: [],
          period_sources: [],
          metadata: {
            total_periods: 0,
            date_range: { start: "", end: "" },
            top_tools_count: 0,
            first_list_period: null,
          },
          warning: "No historical ranking data available",
        },
        { status: 200 }
      );
    }

    // Analyze trending data
    const trendingData = analyzeTrendingData(periods);

    // Apply time range filter if specified
    const filtered =
      timeRange === "all" ? trendingData : filterTrendingDataByTimeRange(trendingData, timeRange);
    // #185: the response names the list whose history it holds.
    // T76: each period names its source, and the metadata names the method-change boundary.
    const sourceOf = new Map(periods.map((p) => [p.period, p.source]));
    const finalData = {
      list,
      ...filtered,
      period_sources: filtered.periods.map((period) => ({
        period,
        source: sourceOf.get(period),
      })),
      metadata: { ...filtered.metadata, first_list_period: history.firstListPeriod },
    };

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
      ETag: `"trending-${list}-${finalData.metadata.total_periods}-${timeRange}"`,
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
