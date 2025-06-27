import { NextRequest, NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import { loggers } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { old_period, new_period } = body;

    if (!old_period || !new_period) {
      return NextResponse.json(
        { error: "Missing required fields: old_period and new_period" },
        { status: 400 }
      );
    }

    // Validate new period is not empty
    if (new_period.trim() === "") {
      return NextResponse.json(
        { error: "Period name cannot be empty" },
        { status: 400 }
      );
    }

    const payload = await getPayload({ config });

    loggers.api.info("Renaming ranking period", { old_period, new_period });

    // Check if new period already exists
    const existingRankings = await payload.find({
      collection: "rankings",
      where: {
        period: {
          equals: new_period,
        },
      },
      limit: 1,
    });

    if (existingRankings.docs.length > 0) {
      return NextResponse.json(
        { error: "A ranking period with this name already exists" },
        { status: 400 }
      );
    }

    // Get all rankings for the old period
    const rankingsToUpdate = await payload.find({
      collection: "rankings",
      where: {
        period: {
          equals: old_period,
        },
      },
      limit: 1000,
    });

    if (rankingsToUpdate.docs.length === 0) {
      return NextResponse.json(
        { error: "No rankings found for the specified period" },
        { status: 404 }
      );
    }

    // Update all rankings with the new period
    let updatedCount = 0;
    for (const ranking of rankingsToUpdate.docs) {
      try {
        await payload.update({
          collection: "rankings",
          id: ranking.id,
          data: {
            period: new_period,
          },
        });
        updatedCount++;
      } catch (error) {
        loggers.api.error("Failed to update ranking", { 
          ranking_id: ranking.id,
          tool_id: ranking["tool_id"],
          error 
        });
      }
    }

    loggers.api.info("Ranking period renamed successfully", { 
      old_period,
      new_period,
      updated_count: updatedCount 
    });

    return NextResponse.json({
      success: true,
      old_period,
      new_period,
      updated_count: updatedCount,
    });

  } catch (error) {
    loggers.api.error("Failed to rename ranking period", { error });
    return NextResponse.json(
      { error: "Failed to rename ranking period" },
      { status: 500 }
    );
  }
}