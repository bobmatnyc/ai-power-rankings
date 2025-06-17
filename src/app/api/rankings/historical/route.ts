import { NextRequest, NextResponse } from "next/server";
import {
  calculateHistoricalRankings,
  getAvailableMonths,
  type HistoricalRankingRequest,
} from "@/lib/historical-rankings";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const month = searchParams.get("month");

    // If no month specified, return available months
    if (!month) {
      const months = await getAvailableMonths();
      return NextResponse.json({
        available_months: months,
        earliest_month: months[months.length - 1],
        latest_month: months[0],
        total_months: months.length,
      });
    }

    // Validate month format
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "Invalid month format. Use YYYY-MM" }, { status: 400 });
    }

    // Get additional parameters
    const algorithmVersion = searchParams.get("algorithm_version") || "v3.2";
    const includeNewsImpact = searchParams.get("include_news_impact") !== "false";
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Calculate historical rankings
    const rankingRequest: HistoricalRankingRequest = {
      month,
      algorithmVersion,
      includeNewsImpact,
    };

    logger.info("Calculating historical rankings:", rankingRequest);

    const rankings = await calculateHistoricalRankings(rankingRequest);

    // Apply pagination
    const paginatedRankings = rankings.slice(offset, offset + limit);

    return NextResponse.json({
      month,
      algorithm_version: algorithmVersion,
      includes_news_impact: includeNewsImpact,
      total_tools: rankings.length,
      rankings: paginatedRankings,
      pagination: {
        limit,
        offset,
        total: rankings.length,
        has_more: offset + limit < rankings.length,
      },
    });
  } catch (error) {
    logger.error("Error calculating historical rankings:", error);
    return NextResponse.json({ error: "Failed to calculate historical rankings" }, { status: 500 });
  }
}

// POST endpoint for comparing multiple months
export async function POST(request: NextRequest) {
  try {
    const { months, tool_ids, include_news_impact = true } = await request.json();

    if (!months || !Array.isArray(months) || months.length === 0) {
      return NextResponse.json({ error: "months array is required" }, { status: 400 });
    }

    // Validate all months
    for (const month of months) {
      if (!/^\d{4}-\d{2}$/.test(month)) {
        return NextResponse.json(
          { error: `Invalid month format: ${month}. Use YYYY-MM` },
          { status: 400 }
        );
      }
    }

    // Calculate rankings for each month
    const monthlyRankings = await Promise.all(
      months.map(async (month) => {
        const rankings = await calculateHistoricalRankings({
          month,
          includeNewsImpact: include_news_impact,
        });

        // Filter by tool_ids if provided
        const filteredRankings =
          tool_ids && tool_ids.length > 0
            ? rankings.filter((r) => tool_ids.includes(r.tool_id))
            : rankings;

        return {
          month,
          rankings: filteredRankings,
        };
      })
    );

    // Create comparison matrix
    const comparisonMatrix: Record<string, any> = {};

    if (tool_ids && tool_ids.length > 0) {
      // Tool-centric view
      for (const toolId of tool_ids) {
        comparisonMatrix[toolId] = {
          tool_id: toolId,
          rankings_over_time: monthlyRankings.map((mr) => {
            const ranking = mr.rankings.find((r) => r.tool_id === toolId);
            return {
              month: mr.month,
              position: ranking?.position || null,
              score: ranking?.score || null,
              news_impact: ranking?.news_summary || null,
            };
          }),
        };
      }
    } else {
      // Month-centric view
      for (const mr of monthlyRankings) {
        comparisonMatrix[mr.month] = {
          month: mr.month,
          top_10: mr.rankings.slice(0, 10).map((r) => ({
            position: r.position,
            tool_id: r.tool_id,
            tool_name: r.tool_name,
            score: r.score,
            news_article_count: r.news_summary?.article_count || 0,
          })),
        };
      }
    }

    return NextResponse.json({
      months,
      tool_ids: tool_ids || "all",
      comparison: comparisonMatrix,
    });
  } catch (error) {
    logger.error("Error comparing historical rankings:", error);
    return NextResponse.json({ error: "Failed to compare historical rankings" }, { status: 500 });
  }
}
