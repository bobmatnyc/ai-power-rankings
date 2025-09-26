import { NextResponse } from "next/server";
import { cachedJsonResponse } from "@/lib/api-cache";
import { getDb } from "@/lib/db/connection";
import { rankingsRepository } from "@/lib/db/repositories/rankings.repository";
import { ToolsRepository } from "@/lib/db/repositories/tools.repository";
import { loggers } from "@/lib/logger";

export async function GET(): Promise<NextResponse> {
  try {
    // Ensure database connection is available
    const db = getDb();
    if (!db) {
      loggers.api.error("Database connection not available");
      return NextResponse.json(
        {
          error: "Database connection unavailable",
          message: "The database service is currently unavailable. Please try again later."
        },
        { status: 503 }
      );
    }

    loggers.api.debug("Getting rankings from database");

    const toolsRepo = new ToolsRepository();

    // Get current rankings from database
    const currentRankings = await rankingsRepository.getCurrentRankings();

    if (!currentRankings) {
      loggers.api.warn("No current rankings found in database");
      return NextResponse.json(
        { error: "No current rankings available" },
        { status: 404 }
      );
    }

    // Parse the JSONB data which contains the rankings array
    const rankingsData = currentRankings.data;
    let rankings = [];

    // Handle different data structures that might be in the JSONB field
    if (Array.isArray(rankingsData)) {
      rankings = rankingsData;
    } else if (rankingsData && typeof rankingsData === 'object') {
      if (rankingsData.rankings && Array.isArray(rankingsData.rankings)) {
        rankings = rankingsData.rankings;
      } else if (rankingsData.data && Array.isArray(rankingsData.data)) {
        rankings = rankingsData.data;
      }
    }

    // Transform to expected format with tool details
    const formattedRankings = await Promise.all(
      rankings.map(async (ranking: any) => {
        // Try to find tool by ID or slug
        let tool = null;

        if (ranking.tool_id) {
          tool = await toolsRepo.findById(ranking.tool_id);
        }

        if (!tool && ranking.tool_slug) {
          tool = await toolsRepo.findBySlug(ranking.tool_slug);
        }

        if (!tool) {
          loggers.api.warn("Tool not found for ranking", {
            toolId: ranking.tool_id,
            toolSlug: ranking.tool_slug
          });
          return null;
        }

        // Parse tool info from database
        const toolInfo = tool.info || {};

        return {
          rank: ranking.rank || ranking.position || 1,
          previousRank: ranking.movement?.previous_position || ranking.previous_rank || null,
          rankChange: ranking.movement?.change || ranking.rank_change || 0,
          changeReason: ranking.change_analysis?.primary_reason || ranking.change_reason || "",
          tool: {
            id: tool.id,
            slug: tool.slug,
            name: tool.name,
            category: tool.category,
            status: tool.status,
            website_url: toolInfo.website || "",
            description: toolInfo.description || "",
          },
          total_score: ranking.score || ranking.total_score || 0,
          scores: {
            overall: ranking.score || ranking.total_score || 0,
            base_score: ranking.base_score || ranking.score || 0,
            news_impact: ranking.factor_scores?.innovation || ranking.scores?.news_impact || 0,
            agentic_capability:
              (ranking.factor_scores?.agenticCapability ??
                ranking.factor_scores?.agentic_capability ??
                ranking.scores?.agentic_capability ??
                50) / 10 || 5,
            innovation:
              (ranking.factor_scores?.innovation ??
                ranking.scores?.innovation ??
                50) / 10 || 5,
          },
          metrics: {
            news_articles_count: ranking.metrics?.news_articles_count || 0,
            recent_funding_rounds: ranking.metrics?.recent_funding_rounds || 0,
            recent_product_launches: ranking.metrics?.recent_product_launches || 0,
            users:
              ranking.metrics?.users ||
              (ranking.factor_scores?.developerAdoption ??
                ranking.factor_scores?.developer_adoption ??
                50) * 1000 || 10000,
            swe_bench_score:
              ranking.metrics?.swe_bench_score ||
              toolInfo.metrics?.swe_bench?.verified ||
              toolInfo.metrics?.swe_bench?.lite ||
              toolInfo.metrics?.swe_bench?.full ||
              null,
          },
          tier: ranking.tier || "standard",
        };
      })
    );

    // Filter out null values (tools that weren't found)
    const validRankings = formattedRankings.filter(Boolean);

    // Sort by rank to ensure proper ordering
    validRankings.sort((a, b) => (a?.rank || 999) - (b?.rank || 999));

    // Calculate statistics
    const toolsWithNews = validRankings.filter(r =>
      r?.metrics?.news_articles_count && r.metrics.news_articles_count > 0
    ).length;

    const newsImpacts = validRankings
      .map(r => r?.scores?.news_impact || 0)
      .filter(impact => impact > 0);

    const avgNewsBoost = newsImpacts.length > 0
      ? newsImpacts.reduce((a, b) => a + b, 0) / newsImpacts.length
      : 0;

    const maxNewsImpact = newsImpacts.length > 0
      ? Math.max(...newsImpacts)
      : 0;

    return cachedJsonResponse(
      {
        rankings: validRankings,
        algorithm: {
          version: currentRankings.algorithm_version || "v1.0",
          name: "Database Rankings",
          date: currentRankings.created_at.toISOString(),
          weights: { newsImpact: 0.3, baseScore: 0.7 },
        },
        stats: {
          total_tools: validRankings.length,
          tools_with_news: toolsWithNews,
          avg_news_boost: avgNewsBoost,
          max_news_impact: maxNewsImpact,
        },
        _source: "database",
        _timestamp: new Date().toISOString(),
        _cacheVersion: "2025-09-26-db", // Force cache refresh with new database source
      },
      "/api/rankings"
    );
  } catch (error) {
    loggers.api.error("Error fetching rankings", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        error: "Failed to fetch rankings",
        message: "An error occurred while fetching rankings. Please try again later."
      },
      { status: 500 }
    );
  }
}