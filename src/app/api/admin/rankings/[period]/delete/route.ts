import { NextRequest, NextResponse } from "next/server";
import { loggers } from "@/lib/logger";
import { getRankingsRepo } from "@/lib/json-db";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ period: string }> }
) {
  try {
    const { period } = await params;

    loggers.api.debug("Deleting ranking period", { period });

    const rankingsRepo = getRankingsRepo();

    // Check if period exists
    const existingPeriod = await rankingsRepo.getByPeriod(period);
    if (!existingPeriod) {
      return NextResponse.json({ error: "Ranking period not found" }, { status: 404 });
    }

    // Delete the ranking period
    await rankingsRepo.deleteByPeriod(period);

    loggers.api.info("Ranking period deleted successfully", { period });

    return NextResponse.json({
      success: true,
      message: `Ranking period ${period} deleted successfully`,
      period,
    });
  } catch (error) {
    loggers.api.error("Delete ranking period API error", { error, params });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
