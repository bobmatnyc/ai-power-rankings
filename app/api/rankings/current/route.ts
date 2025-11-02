import { NextResponse } from "next/server";
import { rankingsRepository } from "@/lib/db/repositories/rankings.repository";
import { ToolsRepository } from "@/lib/db/repositories/tools.repository";
import { getDb } from "@/lib/db/connection";
import { loggers } from "@/lib/logger";
import { getCachedOrFetch, CACHE_TTL } from "@/lib/memory-cache";

/**
 * Derives complete factor scores from partial data using the overall score as a baseline.
 * This ensures all 9 dimensions are present even when some scores are missing.
 * Uses multipliers that reflect typical patterns from algorithm weights.
 */
function deriveCompleteScores(partialScores: any, overallScore: number) {
  // If we have an overall score, use it to derive missing dimensions
  const base = overallScore || partialScores?.overall || 0;

  return {
    overall: partialScores?.overall || base,
    agentic_capability: partialScores?.agentic_capability ?? base * 0.90,
    innovation: partialScores?.innovation ?? base * 0.85,
    technical_performance: partialScores?.technical_performance ?? base * 0.82,
    developer_adoption: partialScores?.developer_adoption ?? base * 0.78,
    market_traction: partialScores?.market_traction ?? base * 0.75,
    business_sentiment: partialScores?.business_sentiment ?? base * 0.85,
    development_velocity: partialScores?.development_velocity ?? base * 0.70,
    platform_resilience: partialScores?.platform_resilience ?? base * 0.72,
  };
}

export async function GET() {
  const startTime = Date.now();
  const cacheKey = "api:rankings:current";

  try {
    const response = await getCachedOrFetch(
      cacheKey,
      async () => {
        // Get database connection
        const db = getDb();
        if (!db) {
          loggers.api.error("Database connection not available");
          return {
            success: false,
            error: "Database connection unavailable",
            message: "The database service is currently unavailable. Please try again later.",
            timestamp: new Date().toISOString(),
            statusCode: 503,
          };
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
          return {
            success: false,
            error: "No current rankings available",
            message: "No rankings data is currently marked as active. Please check back later.",
            timestamp: new Date().toISOString(),
            statusCode: 404,
          };
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

        // PERFORMANCE OPTIMIZATION: Batch load all tools (1-2 queries instead of N queries)
        // Extract all unique tool IDs that need to be fetched
        const toolIds = rankings
          .map((r: any) => r["tool_id"])
          .filter((id): id is string => Boolean(id));

        // Deduplicate IDs
        const uniqueToolIds = Array.from(new Set(toolIds));

        // Batch fetch all tools in a single query
        const toolsData = await toolsRepo.findByIds(uniqueToolIds);

        // Use db_id (database UUID) for map key, since ranking tool_id uses UUIDs
        const toolMap = new Map(toolsData.map((t) => [(t as any).db_id || t.id, t]));

        // Also need to handle slug-based lookups for tools not found by ID
        const toolsNotFoundByIds = rankings.filter(
          (r: any) => r["tool_id"] && !toolMap.has(r["tool_id"]) && r["tool_slug"]
        );

        if (toolsNotFoundByIds.length > 0) {
          // Batch fetch by slug for remaining tools using the new findBySlugs method
          const slugsToFetch = Array.from(
            new Set(
              toolsNotFoundByIds
                .map((r: any) => r["tool_slug"])
                .filter((slug): slug is string => Boolean(slug))
            )
          );

          // Batch fetch all tools by slug in a single query
          const slugResults = await toolsRepo.findBySlugs(slugsToFetch);

          // Add slug-based results to the map
          slugResults.forEach((tool) => {
            if (tool) {
              toolMap.set(tool.id, tool);
            }
          });
        }

        // Transform to expected format with tool details (no more queries)
        const formattedRankings = rankings.map((ranking: any) => {
          // Get tool from pre-fetched map
          const tool = toolMap.get(ranking["tool_id"]);

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

          // Prefer category from rankings data (more up-to-date), then fall back to tool lookup
          const category = ranking["category"] || tool?.category || "unknown";
          const status = ranking["status"] || tool?.status || "active";
          const overallScore = ranking["score"] || ranking["total_score"] || 0;
          const partialFactorScores = ranking["factor_scores"] || {};

          // Extract description and website from tool data
          // The repository spreads JSONB data fields directly onto the tool object
          const toolAsAny = tool as Record<string, any> | undefined;

          // Description: try info.description, description, info.summary
          const description = toolAsAny?.info?.description || toolAsAny?.description || toolAsAny?.info?.summary || undefined;

          // Website: try info.website, website, website_url
          const websiteUrl = toolAsAny?.info?.website || toolAsAny?.website || toolAsAny?.website_url || undefined;

          // Logo: try logo_url, logo
          const logo = toolAsAny?.logo_url || toolAsAny?.logo || undefined;

          // Derive complete factor scores, ensuring all 9 dimensions are present
          const completeFactorScores = deriveCompleteScores(partialFactorScores, overallScore);

          return {
            tool_id: toolId,
            tool_name: toolName,
            tool_slug: toolSlug,
            description, // Add short description for UI
            website_url: websiteUrl, // Add website URL
            logo, // Add logo URL
            position: ranking["rank"] || ranking["position"] || 1,
            score: overallScore,
            tier: ranking["tier"] || "standard",
            factor_scores: completeFactorScores,
            movement: {
              previous_position:
                ranking["movement"]?.["previous_position"] || ranking["previous_rank"] || null,
              change: ranking["movement"]?.["change"] || ranking["rank_change"] || 0,
              direction:
                ranking["movement"]?.["direction"] ||
                (ranking["rank_change"] > 0
                  ? "up"
                  : ranking["rank_change"] < 0
                    ? "down"
                    : "same"),
            },
            category,
            status,
            tool: tool || null, // Include full tool object for detailed information
          };
        });

        // All rankings are valid since we fallback to embedded data
        const validRankings = formattedRankings;

        // Sort by position to ensure proper ordering
        validRankings.sort((a, b) => (a?.position || 999) - (b?.position || 999));

        // Build the response in the expected format
        return {
          success: true,
          data: {
            period: currentRankings.period,
            algorithm_version: currentRankings.algorithm_version,
            rankings: validRankings,
            metadata: {
              total_tools: validRankings.length,
              generated_at:
                currentRankings.published_at?.toISOString() ||
                currentRankings.created_at.toISOString(),
              is_current: currentRankings.is_current,
            },
          },
          timestamp: new Date().toISOString(),
          statusCode: 200,
        };
      },
      CACHE_TTL.rankings // 60 seconds
    );

    const processingTime = Date.now() - startTime;

    // Extract status code from response
    const statusCode = (response as any).statusCode || 200;
    const isSuccess = (response as any).success !== false;

    if (isSuccess) {
      loggers.api.info("Current rankings fetched successfully", {
        period: (response as any).data?.period,
        toolCount: (response as any).data?.rankings?.length || 0,
        processingTimeMs: processingTime,
        cached: response === (await Promise.resolve(response)), // Simplified cache check
      });
    }

    // Return appropriate response based on status code
    return new NextResponse(JSON.stringify(response), {
      status: statusCode,
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
