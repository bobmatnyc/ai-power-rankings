import { NextRequest, NextResponse } from "next/server";
import { getRankingsRepo } from "@/lib/json-db";
import { loggers } from "@/lib/logger";

// POST - Set a ranking period as current
export async function POST(request: NextRequest) {
  try {
    // TODO: Add authentication check here

    const body = await request.json();
    const { period } = body;

    if (!period) {
      return NextResponse.json({ error: "Period is required" }, { status: 400 });
    }

    const rankingsRepo = getRankingsRepo();

    // Check if period exists
    const periodData = await rankingsRepo.getRankingsForPeriod(period);
    if (!periodData) {
      return NextResponse.json({ error: "Ranking period not found" }, { status: 404 });
    }

    // Set as current period
    await rankingsRepo.setCurrentPeriod(period);

    // Update the period data to mark it as current
    periodData.is_current = true;
    await rankingsRepo.saveRankingsForPeriod(periodData);

    // Get all periods and mark others as not current
    const allPeriods = await rankingsRepo.getAvailablePeriods();
    for (const otherPeriod of allPeriods) {
      if (otherPeriod !== period) {
        const otherData = await rankingsRepo.getRankingsForPeriod(otherPeriod);
        if (otherData && otherData.is_current) {
          otherData.is_current = false;
          await rankingsRepo.saveRankingsForPeriod(otherData);
        }
      }
    }

    return NextResponse.json({
      success: true,
      period,
      message: `Successfully set ${period} as the current ranking period`,
    });
  } catch (error) {
    loggers.api.error("Set current rankings error", { error });

    return NextResponse.json(
      {
        error: "Failed to set current rankings",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
