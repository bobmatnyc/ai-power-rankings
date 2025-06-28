import { NextResponse } from "next/server";
import { RankingsRepository } from "@/lib/json-db/rankings-repository";
import { loggers } from "@/lib/logger";

export async function GET() {
  try {
    const rankingsRepo = RankingsRepository.getInstance();
    
    // Get all available periods
    const periods = await rankingsRepo.getPeriods();
    const currentPeriod = await rankingsRepo.getCurrentPeriod();
    
    // Build period metadata
    const periodData = await Promise.all(
      periods.map(async (period) => {
        const rankings = await rankingsRepo.getRankingsForPeriod(period);
        return {
          id: period,
          period,
          algorithm_version: rankings?.algorithm_version || "v6.0",
          created_at: rankings?.created_at || new Date().toISOString(),
          is_current: period === currentPeriod,
          total_tools: rankings?.rankings.length || 0,
        };
      })
    );

    loggers.api.info("Retrieved ranking periods", { 
      total_periods: periodData.length,
      current_period: currentPeriod || "none",
      periods_order: periods
    });

    return NextResponse.json({
      success: true,
      periods: periodData,
      total: periodData.length,
    });

  } catch (error) {
    loggers.api.error("Failed to get ranking periods", { error });
    return NextResponse.json(
      { error: "Failed to retrieve ranking periods" },
      { status: 500 }
    );
  }
}