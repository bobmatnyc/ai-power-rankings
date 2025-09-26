import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { RankingsRepository } from "@/lib/db/repositories/rankings.repository";
import { loggers } from "@/lib/logger";

// GET all ranking periods
export async function GET(_request: NextRequest) {
  // Check admin authentication
  const authResult = await requireAdmin();
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const rankingsRepo = new RankingsRepository();
    const allRankings = await rankingsRepo.findAll();
    const currentRanking = await rankingsRepo.getCurrentRankings();

    // Get detailed info for each period
    const periodsWithDetails = allRankings.map((ranking) => {
      const rankingsCount = ranking.data?.rankings?.length || 0;

      return {
        period: ranking.period,
        display_name:
          ranking.period.replace("-", " ").charAt(0).toUpperCase() +
          ranking.period.replace("-", " ").slice(1),
        is_current: ranking.is_current,
        rankings_count: rankingsCount,
        algorithm_version: ranking.algorithm_version,
        created_at: ranking.created_at.toISOString(),
        published_at: ranking.published_at?.toISOString() || null,
        preview_date: ranking.data?.preview_date || null,
      };
    });

    // Already sorted by period descending from the repository

    return NextResponse.json({
      periods: periodsWithDetails,
      current: currentRanking?.period || null,
      total: periodsWithDetails.length,
    });
  } catch (error) {
    loggers.api.error("Get ranking periods error", { error });

    return NextResponse.json(
      {
        error: "Failed to fetch ranking periods",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}