import { type NextRequest, NextResponse } from "next/server";
import { getRankingsRepo } from "@/lib/json-db";
import type { RankingEntry } from "@/lib/json-db/schemas";
import { loggers } from "@/lib/logger";

// GET all rankings for admin tools manager
export async function GET(_request: NextRequest) {
  try {
    // TODO: Add authentication check here

    const rankingsRepo = getRankingsRepo();
    const periods = await rankingsRepo.getAvailablePeriods();

    // Get all rankings from all periods
    const allRankings: Array<{
      id: string;
      period: string;
      tool_id: string;
      position: number;
      score: number;
      movement: string;
      movement_positions: number;
      previous_position?: number;
      score_breakdown: Record<string, number>;
      algorithm_version?: string;
      created_at?: string;
    }> = [];

    for (const period of periods) {
      const periodData = await rankingsRepo.getRankingsForPeriod(period);
      if (periodData?.rankings) {
        // Transform rankings to match the expected format
        periodData.rankings.forEach((ranking: RankingEntry) => {
          allRankings.push({
            id: `${period}-${ranking.tool_id}`,
            period: period,
            tool_id: ranking.tool_id,
            position: ranking.position ?? 0,
            score: ranking.score ?? 0,
            movement: ranking.movement?.direction || "same",
            movement_positions: ranking.movement?.change || 0,
            previous_position: ranking.movement?.previous_position,
            score_breakdown: ranking.factor_scores || {},
            algorithm_version: periodData.algorithm_version,
            created_at: periodData.created_at,
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
