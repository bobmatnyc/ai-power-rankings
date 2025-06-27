import { NextRequest, NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import { loggers } from "@/lib/logger";

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { period } = body;

    if (!period) {
      return NextResponse.json(
        { error: "Missing required field: period" },
        { status: 400 }
      );
    }

    const payload = await getPayload({ config });

    loggers.api.info("Deleting ranking period", { period });

    // First check if this is the current live ranking
    const currentRankings = await payload.find({
      collection: "rankings",
      where: {
        period: {
          equals: period,
        },
        is_current: {
          equals: true,
        },
      },
      limit: 1,
    });

    if (currentRankings.docs.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete the current live ranking. Please set a different ranking as live first." },
        { status: 400 }
      );
    }

    // Get all rankings for this period
    const rankingsToDelete = await payload.find({
      collection: "rankings",
      where: {
        period: {
          equals: period,
        },
      },
      limit: 1000,
    });

    if (rankingsToDelete.docs.length === 0) {
      return NextResponse.json(
        { error: "No rankings found for the specified period" },
        { status: 404 }
      );
    }

    // Delete all rankings for this period
    let deletedCount = 0;
    for (const ranking of rankingsToDelete.docs) {
      try {
        await payload.delete({
          collection: "rankings",
          id: ranking.id,
        });
        deletedCount++;
      } catch (error) {
        loggers.api.error("Failed to delete ranking", { 
          ranking_id: ranking.id,
          tool_id: ranking["tool_id"],
          error 
        });
      }
    }

    loggers.api.info("Ranking period deleted successfully", { 
      period,
      deleted_count: deletedCount 
    });

    return NextResponse.json({
      success: true,
      period,
      deleted_count: deletedCount,
    });

  } catch (error) {
    loggers.api.error("Failed to delete ranking period", { error });
    return NextResponse.json(
      { error: "Failed to delete ranking period" },
      { status: 500 }
    );
  }
}