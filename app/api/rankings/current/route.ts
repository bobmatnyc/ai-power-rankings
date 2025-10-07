import { NextResponse } from "next/server";
import { rankingsRepository } from "@/lib/db/repositories/rankings.repository";
import { ToolsRepository } from "@/lib/db/repositories/tools.repository";
import { getDb } from "@/lib/db/connection";
import { loggers } from "@/lib/logger";

export async function GET() {
  const startTime = Date.now();

  try {
    // Get database connection
    const db = getDb();
    if (!db) {
      loggers.api.error("Database connection not available");
      return NextResponse.json(
        {
          success: false,
          error: "Database connection unavailable",
          message: "The database service is currently unavailable. Please try again later.",
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }

    loggers.api.debug("Getting current rankings from database");

    const toolsRepo = new ToolsRepository();

    // Get current rankings from database
    let currentRankings;
    try {
      currentRankings = await rankingsRepository.getCurrentRankings();
    } catch (dbError) {
      loggers.api.error("Database query failed for getCurrentRankings", {
        error: dbError instanceof Error ? dbError.message : "Unknown error",
        stack: dbError instanceof Error ? dbError.stack : undefined,
      });
      throw dbError; // Re-throw to be caught by outer try-catch
    }

    if (!currentRankings) {
      loggers.api.warn("No current rankings found in database");
      return NextResponse.json(
        {
          success: false,
          error: "No current rankings available",
          message: "No rankings data is currently marked as active. Please check back later.",
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // Parse the JSONB data which contains the rankings array
    const rankingsData = currentRankings.data;
    let rankings = [];

    // Handle different data structures that might be in the JSONB field
    if (Array.isArray(rankingsData)) {
      rankings = rankingsData;
    } else if (rankingsData && typeof rankingsData === "object") {
      if (rankingsData["rankings"] && Array.isArray(rankingsData["rankings"])) {
        rankings = rankingsData["rankings"];
      } else if (rankingsData["data"] && Array.isArray(rankingsData["data"])) {
        rankings = rankingsData["data"];
      }
    }

    // Transform to expected format with tool details
    const formattedRankings = await Promise.all(
      rankings.map(async (ranking: any) => {
        // Try to find tool by ID or slug for additional metadata
        let tool = null;

        if (ranking["tool_id"]) {
          tool = await toolsRepo.findById(ranking["tool_id"]);
        }

        if (!tool && ranking["tool_slug"]) {
          tool = await toolsRepo.findBySlug(ranking["tool_slug"]);
        }

        // Use tool data from DB if available, otherwise use ranking data
        // Rankings data already contains tool_name, so we don't need to fail if tool not found
        const toolId = tool?.id || ranking["tool_id"];
        const toolName = tool?.name || ranking["tool_name"] || "Unknown Tool";

        // Force DB slug if tool was successfully fetched
        let toolSlug = toolId; // default to UUID
        if (tool && tool.slug) {
          toolSlug = tool.slug; // prefer DB slug from database
        } else if (ranking["tool_slug"]) {
          toolSlug = ranking["tool_slug"]; // fallback to ranking data
        }

        const category = tool?.category || "unknown";
        const status = tool?.status || "active";

        return {
          tool_id: toolId,
          tool_name: toolName,
          tool_slug: toolSlug,
          position: ranking["rank"] || ranking["position"] || 1,
          score: ranking["score"] || ranking["total_score"] || 0,
          tier: ranking["tier"] || "standard",
          factor_scores: ranking["factor_scores"] || {},
          movement: {
            previous_position:
              ranking["movement"]?.["previous_position"] || ranking["previous_rank"] || null,
            change: ranking["movement"]?.["change"] || ranking["rank_change"] || 0,
            direction:
              ranking["movement"]?.["direction"] ||
              (ranking["rank_change"] > 0 ? "up" : ranking["rank_change"] < 0 ? "down" : "same"),
          },
          category,
          status,
        };
      })
    );

    // All rankings are valid since we fallback to embedded data
    const validRankings = formattedRankings;

    // Sort by position to ensure proper ordering
    validRankings.sort((a, b) => (a?.position || 999) - (b?.position || 999));

    // Build the response in the expected format
    const response = {
      success: true,
      data: {
        period: currentRankings.period,
        algorithm_version: currentRankings.algorithm_version,
        rankings: validRankings,
        metadata: {
          total_tools: validRankings.length,
          generated_at: currentRankings.published_at?.toISOString() || currentRankings.created_at.toISOString(),
          is_current: currentRankings.is_current,
        },
      },
      timestamp: new Date().toISOString(),
    };

    const processingTime = Date.now() - startTime;
    loggers.api.info("Current rankings fetched successfully", {
      period: currentRankings.period,
      toolCount: validRankings.length,
      processingTimeMs: processingTime,
    });

    // Add caching headers for performance
    return new NextResponse(JSON.stringify(response), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        "X-Processing-Time": `${processingTime}ms`,
      },
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;

    loggers.api.error("Error fetching current rankings", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      processingTimeMs: processingTime,
    });

    console.error("Error fetching rankings:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch rankings data",
        message: error instanceof Error ? error.message : "An unexpected error occurred",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Enable CORS for this endpoint
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
