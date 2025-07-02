import { NextResponse } from "next/server";
import { getRankingsRepo } from "@/lib/json-db";

export async function GET() {
  try {
    const rankingsRepo = getRankingsRepo();

    // Get available periods from rankings repository
    const availablePeriods = await rankingsRepo.getAvailablePeriods();
    const currentPeriod = await rankingsRepo.getCurrentPeriod();

    const periodData = availablePeriods.map((period) => {
      return {
        period: period,
        is_current: period === currentPeriod,
        status: period === currentPeriod ? "current" : "archived",
        display_name: period, // Using period as display name for now
        calculation_date: null, // Would need ranking periods repository
        ranking_count: 0, // Would need to count rankings per period
      };
    });

    return NextResponse.json({
      total: availablePeriods.length,
      periods: periodData,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
