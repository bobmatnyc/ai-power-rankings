import { NextRequest, NextResponse } from "next/server";
import { getRankingsRepo } from "@/lib/json-db";
import { loggers } from "@/lib/logger";

// GET all ranking periods
export async function GET(_request: NextRequest) {
  try {
    // TODO: Add authentication check here

    const rankingsRepo = getRankingsRepo();
    const periods = await rankingsRepo.getAvailablePeriods();
    const currentPeriod = await rankingsRepo.getCurrentPeriod();

    // Get detailed info for each period
    const periodsWithDetails = await Promise.all(
      periods.map(async (period) => {
        const data = await rankingsRepo.getRankingsForPeriod(period);

        return {
          period,
          display_name:
            period.replace("-", " ").charAt(0).toUpperCase() + period.replace("-", " ").slice(1),
          is_current: period === currentPeriod,
          rankings_count: data?.rankings.length || 0,
          algorithm_version: data?.algorithm_version,
          created_at: data?.created_at,
          preview_date: data?.preview_date,
        };
      })
    );

    // Sort by period descending (newest first)
    periodsWithDetails.sort((a, b) => b.period.localeCompare(a.period));

    return NextResponse.json({
      periods: periodsWithDetails,
      current: currentPeriod,
      total: periodsWithDetails.length,
      _source: "json-db",
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
