import { NextRequest, NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import { loggers } from "@/lib/logger";

export async function POST(request: NextRequest) {
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

    loggers.api.info("Setting live ranking", { period });

    // First, unset all current live rankings
    const currentRankings = await payload.find({
      collection: "rankings",
      where: {
        is_current: {
          equals: true,
        },
      },
      limit: 1000,
    });

    // Update all current rankings to not be current
    for (const ranking of currentRankings.docs) {
      await payload.update({
        collection: "rankings",
        id: ranking.id,
        data: {
          is_current: false,
        },
      });
    }

    // Set the new period as current
    const newCurrentRankings = await payload.find({
      collection: "rankings",
      where: {
        period: {
          equals: period,
        },
      },
      limit: 1000,
    });

    let updatedCount = 0;
    for (const ranking of newCurrentRankings.docs) {
      await payload.update({
        collection: "rankings",
        id: ranking.id,
        data: {
          is_current: true,
        },
      });
      updatedCount++;
    }

    if (updatedCount === 0) {
      return NextResponse.json(
        { error: "No rankings found for the specified period" },
        { status: 404 }
      );
    }

    loggers.api.info("Live ranking set successfully", { 
      period,
      tools_updated: updatedCount 
    });

    return NextResponse.json({
      success: true,
      period,
      tools_updated: updatedCount,
    });

  } catch (error) {
    loggers.api.error("Failed to set live ranking", { error });
    return NextResponse.json(
      { error: "Failed to set live ranking" },
      { status: 500 }
    );
  }
}