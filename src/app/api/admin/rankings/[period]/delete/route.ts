import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { RankingsRepository } from "@/lib/db/repositories/rankings.repository";
import { loggers } from "@/lib/logger";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ period: string }> }
) {
  // Check admin authentication
  const authResult = await requireAdmin();
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const { period } = await params;

    loggers.api.debug("Deleting ranking period", { period });

    const rankingsRepo = new RankingsRepository();

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