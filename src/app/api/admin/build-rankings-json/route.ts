import { type NextRequest, NextResponse } from "next/server";
import { loggers } from "@/lib/logger";
import { getRankingsRepo } from "@/lib/json-db";
import type { RankingPeriod } from "@/lib/json-db/schemas";

interface ProvidedRanking {
  tool_id: string;
  tool_name: string;
  score?: number;
  new_score?: number;
  factor_changes?: {
    agentic_capability?: number;
    innovation?: number;
    technical_performance?: number;
    developer_adoption?: number;
    market_traction?: number;
    business_sentiment?: number;
    development_velocity?: number;
    platform_resilience?: number;
  };
  movement?: "up" | "down" | "same";
  current_position?: number;
  position_change?: number;
  change_analysis?: {
    primary_reason?: string;
    narrative_explanation?: string;
  };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { period, algorithm_version = "v6.0", preview_date, rankings } = body;

    loggers.api.info("Build rankings JSON request received", {
      period,
      rankings_count: rankings?.length,
    });

    if (!period || !rankings) {
      return NextResponse.json({ error: "Period and rankings are required" }, { status: 400 });
    }

    const rankingsRepo = getRankingsRepo();

    // Build the ranking period data
    const rankingPeriod: RankingPeriod = {
      period,
      algorithm_version,
      is_current: false,
      created_at: new Date().toISOString(),
      preview_date,
      rankings: rankings.map((r: ProvidedRanking, index: number) => ({
        tool_id: r.tool_id,
        tool_name: r.tool_name,
        position: index + 1,
        score: r.new_score || r.score || 0,
        tier: getTier(r.new_score || r.score || 0),
        factor_scores: {
          agentic_capability: r.factor_changes?.agentic_capability || 50,
          innovation: r.factor_changes?.innovation || 50,
          technical_performance: r.factor_changes?.technical_performance || 50,
          developer_adoption: r.factor_changes?.developer_adoption || 50,
          market_traction: r.factor_changes?.market_traction || 50,
          business_sentiment: r.factor_changes?.business_sentiment || 50,
          development_velocity: r.factor_changes?.development_velocity || 50,
          platform_resilience: r.factor_changes?.platform_resilience || 50,
        },
        movement: r.movement
          ? {
              previous_position: r.current_position || null,
              change: r.position_change || 0,
              direction: r.movement as "up" | "down" | "same",
            }
          : undefined,
        change_analysis: r.change_analysis,
      })),
    };

    // Save the rankings
    await rankingsRepo.saveRankingsForPeriod(rankingPeriod);

    loggers.api.info("Rankings built and saved", {
      period,
      tools_count: rankingPeriod.rankings.length,
    });

    return NextResponse.json({
      success: true,
      period,
      message: "Rankings built and saved successfully",
      tools_count: rankingPeriod.rankings.length,
    });
  } catch (error) {
    loggers.api.error("Failed to build rankings", { error });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

function getTier(score: number): "S" | "A" | "B" | "C" | "D" | null {
  if (score >= 90) {
    return "S";
  }
  if (score >= 80) {
    return "A";
  }
  if (score >= 70) {
    return "B";
  }
  if (score >= 60) {
    return "C";
  }
  if (score >= 50) {
    return "D";
  }
  return null;
}
