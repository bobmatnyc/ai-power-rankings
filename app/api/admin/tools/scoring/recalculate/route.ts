import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/connection";
import { toolScoringService } from "@/lib/services/tool-scoring.service";
import { loggers } from "@/lib/logger";

/**
 * POST /api/admin/tools/scoring/recalculate
 * Recalculate all current scores from baseline + delta
 */
export async function POST(): Promise<NextResponse> {
  try {
    const db = getDb();
    if (!db) {
      return NextResponse.json(
        { error: "Database connection unavailable" },
        { status: 503 }
      );
    }

    loggers.api.info("Starting score recalculation for all tools");

    await toolScoringService.recalculateAllScores();

    // Get updated tools with scores
    const toolsWithScores = await toolScoringService.getToolsWithScores();

    return NextResponse.json({
      success: true,
      message: "All tool scores recalculated successfully",
      data: {
        total_tools: toolsWithScores.length,
        tools: toolsWithScores.slice(0, 10), // Return first 10 as sample
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    loggers.api.error("Error recalculating tool scores", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json(
      {
        error: "Failed to recalculate scores",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}