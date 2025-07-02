import { type NextRequest, NextResponse } from "next/server";
import { RankingsRepository } from "@/lib/json-db/rankings-repository";
import { loggers } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { period } = body;

    if (!period) {
      return NextResponse.json({ error: "Missing required field: period" }, { status: 400 });
    }

    const rankingsRepo = RankingsRepository.getInstance();

    loggers.api.info("Setting live ranking", { period });

    // Check if the period exists
    const periodRankings = await rankingsRepo.getRankingsForPeriod(period);
    if (!periodRankings) {
      return NextResponse.json(
        { error: "No rankings found for the specified period" },
        { status: 404 }
      );
    }

    // Set the new period as current
    await rankingsRepo.setCurrentPeriod(period);

    loggers.api.info("Live ranking set successfully", {
      period,
      tools_updated: periodRankings.rankings.length,
    });

    return NextResponse.json({
      success: true,
      period,
      tools_updated: periodRankings.rankings.length,
    });
  } catch (error) {
    loggers.api.error("Failed to set live ranking", { error });
    return NextResponse.json({ error: "Failed to set live ranking" }, { status: 500 });
  }
}
