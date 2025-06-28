import { NextRequest, NextResponse } from "next/server";
import { getRankingsRepo } from "@/lib/json-db";
import { loggers } from "@/lib/logger";
import type { RankingPeriod } from "@/lib/json-db/schemas";

type Params = {
  params: {
    period: string;
  };
};

// GET rankings for a specific period
export async function GET(request: NextRequest, { params }: Params) {
  try {
    // TODO: Add authentication check here
    
    const rankingsRepo = getRankingsRepo();
    const periodData = await rankingsRepo.getRankingsForPeriod(params.period);
    
    if (!periodData) {
      return NextResponse.json(
        { error: "Rankings not found for period" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      period: periodData,
      _source: "json-db",
    });
  } catch (error) {
    loggers.api.error("Get rankings by period error", { error, period: params.period });
    
    return NextResponse.json(
      {
        error: "Failed to fetch rankings",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// UPDATE rankings for a period (save/update)
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    // TODO: Add authentication check here
    
    const body = await request.json();
    const rankingsRepo = getRankingsRepo();
    
    const rankingPeriod: RankingPeriod = {
      period: params.period,
      algorithm_version: body.algorithm_version || "v6-news",
      is_current: body.is_current || false,
      created_at: body.created_at || new Date().toISOString(),
      preview_date: body.preview_date,
      rankings: body.rankings || [],
    };
    
    await rankingsRepo.saveRankingsForPeriod(rankingPeriod);
    
    // If marking as current, update the current period
    if (body.is_current) {
      await rankingsRepo.setCurrentPeriod(params.period);
    }
    
    return NextResponse.json({
      success: true,
      period: rankingPeriod,
      message: "Rankings saved successfully",
    });
  } catch (error) {
    loggers.api.error("Update rankings error", { error, period: params.period });
    
    return NextResponse.json(
      {
        error: "Failed to update rankings",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// DELETE rankings for a period
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    // TODO: Add authentication check here
    
    const rankingsRepo = getRankingsRepo();
    
    // Don't allow deleting the current period
    const currentPeriod = await rankingsRepo.getCurrentPeriod();
    if (params.period === currentPeriod) {
      return NextResponse.json(
        { error: "Cannot delete the current ranking period" },
        { status: 400 }
      );
    }
    
    const success = await rankingsRepo.deletePeriod(params.period);
    
    if (!success) {
      return NextResponse.json(
        { error: "Failed to delete ranking period" },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: "Ranking period deleted successfully",
    });
  } catch (error) {
    loggers.api.error("Delete rankings error", { error, period: params.period });
    
    return NextResponse.json(
      {
        error: "Failed to delete rankings",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}