import { NextRequest, NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import { loggers } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { period, algorithm_version, preview_date, preview_data } = body;

    if (!period || !preview_data) {
      return NextResponse.json(
        { error: "Missing required fields: period and preview_data" },
        { status: 400 }
      );
    }

    const payload = await getPayload({ config });

    loggers.api.info("Building rankings", { 
      period, 
      algorithm_version, 
      preview_date,
      total_tools: preview_data.total_tools 
    });

    // Clear existing rankings for this period
    const existingRankings = await payload.find({
      collection: "rankings",
      where: {
        period: {
          equals: period,
        },
      },
      limit: 1000,
    });

    // Delete existing rankings
    for (const ranking of existingRankings.docs) {
      await payload.delete({
        collection: "rankings",
        id: ranking.id,
      });
    }

    // Create new rankings from preview data
    let toolsSaved = 0;
    
    for (const comparison of preview_data.rankings_comparison) {
      try {
        // Skip dropped tools
        if (comparison.movement === 'dropped' || comparison.new_position === -1) {
          continue;
        }

        await payload.create({
          collection: "rankings",
          data: {
            period,
            algorithm_version: algorithm_version || "v6.0",
            tool: comparison.tool_id, // This is the relationship field
            tool_id: comparison.tool_id,
            tool_name: comparison.tool_name,
            position: comparison.new_position,
            score: comparison.new_score,
            tier: getTierFromPosition(comparison.new_position),
            is_current: false, // Will be set separately when made live
            preview_date: preview_date || new Date().toISOString().slice(0, 10),
            movement: comparison.movement,
            position_change: comparison.position_change || 0,
            score_change: comparison.score_change || 0,
            primary_reason: comparison.change_analysis?.primaryReason || null,
            narrative_explanation: comparison.change_analysis?.narrativeExplanation || null,
            // Save factor scores
            agentic_capability: comparison.factor_changes?.agentic_capability || null,
            innovation: comparison.factor_changes?.innovation || null,
            technical_performance: comparison.factor_changes?.technical_performance || null,
            developer_adoption: comparison.factor_changes?.developer_adoption || null,
            market_traction: comparison.factor_changes?.market_traction || null,
            business_sentiment: comparison.factor_changes?.business_sentiment || null,
            development_velocity: comparison.factor_changes?.development_velocity || null,
            platform_resilience: comparison.factor_changes?.platform_resilience || null,
          },
        });
        toolsSaved++;
      } catch (error) {
        loggers.api.error("Failed to save ranking for tool", { 
          tool_id: comparison.tool_id,
          tool_name: comparison.tool_name,
          error 
        });
      }
    }

    loggers.api.info("Rankings built successfully", { 
      period, 
      tools_saved: toolsSaved,
      preview_date 
    });

    return NextResponse.json({
      success: true,
      period,
      tools_saved: toolsSaved,
      algorithm_version: algorithm_version || "v6.0",
      preview_date,
    });

  } catch (error) {
    loggers.api.error("Failed to build rankings", { error });
    return NextResponse.json(
      { error: "Failed to build rankings" },
      { status: 500 }
    );
  }
}

function getTierFromPosition(position: number): string {
  if (position <= 10) {
    return "S";
  }
  if (position <= 25) {
    return "A";
  }
  if (position <= 50) {
    return "B";
  }
  if (position <= 100) {
    return "C";
  }
  return "D";
}