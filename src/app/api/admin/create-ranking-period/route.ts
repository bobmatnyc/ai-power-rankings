import { NextRequest, NextResponse } from "next/server";
import { loggers } from "@/lib/logger";

export async function POST(_request: NextRequest) {
  try {

    // For now, this endpoint requires a dedicated ranking periods repository
    // The current rankings repository handles individual ranking entries, not periods
    
    loggers.api.info("Ranking period creation requested but requires dedicated repository");

    return NextResponse.json({
      success: false,
      message: "Ranking period creation not available - requires dedicated RankingPeriodsRepository",
      note: "Current RankingsRepository handles individual rankings, not period metadata",
      suggested_implementation: "Create RankingPeriodsRepository for period management",
    });
  } catch (error: any) {
    loggers.api.error("Error in create-ranking-period endpoint:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
