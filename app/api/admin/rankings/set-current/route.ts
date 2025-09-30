import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { RankingsRepository } from "@/lib/db/repositories/rankings.repository";
import { loggers } from "@/lib/logger";

// POST - Set a ranking period as current
export async function POST(request: NextRequest) {
  // Check admin authentication
  const authResult = await requireAdmin();
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const body = await request.json();
    const { period } = body;

    if (!period) {
      return NextResponse.json({ error: "Period is required" }, { status: 400 });
    }

    const rankingsRepo = new RankingsRepository();

    // Check if period exists
    const periodData = await rankingsRepo.getByPeriod(period);
    if (!periodData) {
      return NextResponse.json({ error: "Ranking period not found" }, { status: 404 });
    }

    // Set as current period (this will unset all others and set this one as current)
    await rankingsRepo.setAsCurrent(periodData.id);

    loggers.api.info("Successfully set current ranking period", { period });

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
