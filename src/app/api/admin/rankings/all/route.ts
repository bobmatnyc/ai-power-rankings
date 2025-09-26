import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { RankingsRepository } from "@/lib/db/repositories/rankings.repository";
import { loggers } from "@/lib/logger";

// GET all rankings for admin tools manager
export async function GET(_request: NextRequest) {
  // Check admin authentication
  const authResult = await requireAdmin();
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const rankingsRepo = new RankingsRepository();
    const allPeriods = await rankingsRepo.findAll();

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

    for (const periodData of allPeriods) {
      const rankings = periodData.data?.rankings || [];

      // Transform rankings to match the expected format
      rankings.forEach((ranking: any) => {
        allRankings.push({
          id: `${periodData.period}-${ranking.tool_id}`,
          period: periodData.period,
          tool_id: ranking.tool_id,
          position: ranking.position ?? 0,
          score: ranking.score ?? 0,
          movement: ranking.movement?.direction || "same",
          movement_positions: ranking.movement?.change || 0,
          previous_position: ranking.movement?.previous_position,
          score_breakdown: ranking.factor_scores || {},
          algorithm_version: periodData.algorithm_version,
          created_at: periodData.created_at.toISOString(),
        });
      });
    }

    return NextResponse.json({
      rankings: allRankings,
      total: allRankings.length,
      periods: allPeriods.map(p => p.period),
      current_period: allPeriods.find(p => p.is_current)?.period || null,
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