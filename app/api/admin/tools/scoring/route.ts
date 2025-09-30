import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/connection";
import { toolScoringService } from "@/lib/services/tool-scoring.service";
import { loggers } from "@/lib/logger";

/**
 * GET /api/admin/tools/scoring
 * Get all tools with their scoring data
 */
export async function GET(): Promise<NextResponse> {
  try {
    const db = getDb();
    if (!db) {
      return NextResponse.json(
        { error: "Database connection unavailable" },
        { status: 503 }
      );
    }

    const toolsWithScores = await toolScoringService.getToolsWithScores();

    return NextResponse.json({
      success: true,
      data: toolsWithScores,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    loggers.api.error("Error fetching tools scoring data", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json(
      {
        error: "Failed to fetch scoring data",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/tools/scoring
 * Update scoring for a specific tool
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const db = getDb();
    if (!db) {
      return NextResponse.json(
        { error: "Database connection unavailable" },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { toolId, baseline_score, delta_score } = body;

    if (!toolId) {
      return NextResponse.json(
        { error: "Tool ID is required" },
        { status: 400 }
      );
    }

    // Update baseline score if provided
    if (baseline_score) {
      await toolScoringService.updateBaselineScore(toolId, baseline_score);
    }

    // Update delta score if provided
    if (delta_score) {
      await toolScoringService.updateDeltaScore(toolId, delta_score);
    }

    // Get updated scoring data
    const updatedScoring = await toolScoringService.getToolScoring(toolId);

    return NextResponse.json({
      success: true,
      data: updatedScoring,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    loggers.api.error("Error updating tool scoring", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json(
      {
        error: "Failed to update scoring",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/tools/scoring
 * Initialize baseline scores from current data
 */
export async function PUT(): Promise<NextResponse> {
  try {
    const db = getDb();
    if (!db) {
      return NextResponse.json(
        { error: "Database connection unavailable" },
        { status: 503 }
      );
    }

    await toolScoringService.initializeBaselinesFromCurrent();

    return NextResponse.json({
      success: true,
      message: "Baseline scores initialized successfully",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    loggers.api.error("Error initializing baseline scores", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json(
      {
        error: "Failed to initialize baseline scores",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}