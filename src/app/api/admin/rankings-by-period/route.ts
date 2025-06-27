import { NextRequest, NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import { loggers } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period");

    if (!period) {
      return NextResponse.json(
        { error: "Period parameter is required" },
        { status: 400 }
      );
    }

    const payload = await getPayload({ config });

    loggers.api.info("Fetching rankings for period", { period });

    // Get all rankings for this period
    const { docs: rankings } = await payload.find({
      collection: "rankings",
      where: {
        period: {
          equals: period,
        },
      },
      limit: 1000,
      sort: "position",
    });

    if (rankings.length === 0) {
      return NextResponse.json(
        { error: "No rankings found for the specified period" },
        { status: 404 }
      );
    }

    // Transform rankings to include tool information
    const rankingsWithTools = rankings.map(ranking => {
      const tool = ranking["tool"];
      const toolInfo = typeof tool === "object" ? tool : null;
      
      return {
        id: ranking.id,
        position: ranking["position"],
        score: ranking["score"],
        tool_id: ranking["tool_id"],
        tool_name: toolInfo?.["name"] || "Unknown Tool",
        tool_slug: toolInfo?.["slug"] || "",
        status: toolInfo?.["status"] || "unknown",
        // Factor scores
        agentic_capability: ranking["agentic_capability"],
        innovation: ranking["innovation"],
        technical_performance: ranking["technical_performance"],
        developer_adoption: ranking["developer_adoption"],
        market_traction: ranking["market_traction"],
        business_sentiment: ranking["business_sentiment"],
        development_velocity: ranking["development_velocity"],
        platform_resilience: ranking["platform_resilience"],
      };
    });

    loggers.api.info("Retrieved rankings for period", { 
      period,
      total_rankings: rankingsWithTools.length 
    });

    return NextResponse.json({
      success: true,
      period,
      rankings: rankingsWithTools,
      total: rankingsWithTools.length,
    });

  } catch (error) {
    loggers.api.error("Failed to get rankings by period", { error });
    return NextResponse.json(
      { error: "Failed to retrieve rankings" },
      { status: 500 }
    );
  }
}