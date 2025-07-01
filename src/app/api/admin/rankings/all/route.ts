import { NextRequest, NextResponse } from "next/server";
import { getRankingsRepo } from "@/lib/json-db";
import { loggers } from "@/lib/logger";

// GET all rankings for admin tools manager
export async function GET(_request: NextRequest) {
  try {
    // TODO: Add authentication check here

    const rankingsRepo = getRankingsRepo();
    const periods = await rankingsRepo.getAvailablePeriods();
    
    // Get all rankings from all periods
    const allRankings: any[] = [];
    
    for (const period of periods) {
      const periodData = await rankingsRepo.getRankingsForPeriod(period);
      if (periodData && periodData.rankings) {
        // Transform rankings to match the expected format
        periodData.rankings.forEach((ranking: any) => {
          allRankings.push({
            id: `${period}-${ranking.tool_id}`,
            period: period,
            tool_id: ranking.tool_id,
            position: ranking.position,
            score: ranking.score,
            movement: ranking.movement?.direction || "same",
            movement_positions: ranking.movement?.change || 0,
            previous_position: ranking.movement?.previous_position,
            score_breakdown: ranking.factor_scores || {},
            algorithm_version: periodData.algorithm_version,
            created_at: periodData.created_at
          });
        });
      }
    }

    return NextResponse.json({
      rankings: allRankings,
      total: allRankings.length,
      periods: periods,
      _source: "json-db",
    });
  } catch (error) {
    loggers.api.error("Get all rankings error", { error });

    return NextResponse.json(
      {
        error: "Failed to fetch rankings",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}