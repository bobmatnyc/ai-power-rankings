import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { RankingsRepository } from "@/lib/db/repositories/rankings.repository";
import { loggers } from "@/lib/logger";

export async function GET() {
  // Check admin authentication
  const authResult = await requireAdmin();
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const rankingsRepo = new RankingsRepository();

    // Get all rankings from database
    const allRankings = await rankingsRepo.findAll();

    // Find current ranking
    const currentRanking = await rankingsRepo.getCurrentRankings();
    const currentPeriod = currentRanking?.period || null;

    // Map periods with their data
    const periodData = allRankings.map((ranking) => {
      const rankingsCount = ranking.data?.rankings?.length || 0;

      return {
        period: ranking.period,
        is_current: ranking.is_current,
        status: ranking.is_current ? "current" : "archived",
        display_name: ranking.period,
        calculation_date: ranking.data?.generated_at || ranking.created_at.toISOString(),
        ranking_count: rankingsCount,
        algorithm_version: ranking.algorithm_version,
      };
    });

    return NextResponse.json({
      total: allRankings.length,
      current_period: currentPeriod,
      periods: periodData,
    });
  } catch (error: unknown) {
    loggers.api.error("Error checking ranking periods:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
