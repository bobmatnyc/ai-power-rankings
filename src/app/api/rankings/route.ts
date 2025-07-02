import { NextResponse } from "next/server";
import { loggers } from "@/lib/logger";
import { getRankingsRepo, getToolsRepo } from "@/lib/json-db";
import { cachedJsonResponse } from "@/lib/api-cache";
import type { RankingEntry } from "@/lib/json-db/schemas";

export async function GET(): Promise<NextResponse> {
  try {
    loggers.api.debug("Getting rankings from JSON repository");

    const rankingsRepo = getRankingsRepo();
    const toolsRepo = getToolsRepo();

    // Get current rankings
    const currentRankings = await rankingsRepo.getCurrentRankings();

    if (!currentRankings) {
      return NextResponse.json({ error: "No current rankings available" }, { status: 404 });
    }

    // Transform to expected format with tool details
    const formattedRankings = await Promise.all(
      currentRankings.rankings.map(async (ranking: RankingEntry) => {
        const tool = await toolsRepo.getById(ranking.tool_id);

        if (!tool) {
          return null;
        }

        return {
          rank: ranking.position,
          previousRank: ranking.movement?.previous_position || null,
          rankChange: ranking.movement?.change || 0,
          changeReason: ranking.change_analysis?.primary_reason || "",
          tool: {
            id: tool.id,
            slug: tool.slug,
            name: tool.name,
            category: tool.category,
            status: tool.status,
            website_url: tool.info?.website || "",
            description: tool.info?.description || "",
          },
          total_score: ranking.score,
          scores: {
            overall: ranking.score,
            base_score: ranking.score,
            news_impact: ranking.factor_scores?.innovation || 0,
            agentic_capability: ranking.factor_scores?.agentic_capability / 10 || 5,
            innovation: ranking.factor_scores?.innovation / 10 || 5,
          },
          metrics: {
            news_articles_count: 0, // Not available in current data
            recent_funding_rounds: 0,
            recent_product_launches: 0,
            users: ranking.factor_scores?.developer_adoption * 1000 || 10000,
            swe_bench_score:
              tool.info?.metrics?.swe_bench_score ||
              ranking.factor_scores?.technical_performance ||
              null,
          },
          tier: ranking.tier,
        };
      })
    );

    // Filter out null values
    const validRankings = formattedRankings.filter(Boolean);

    return cachedJsonResponse(
      {
        rankings: validRankings,
        algorithm: {
          version: currentRankings.algorithm_version,
          name: "JSON-Based Rankings",
          date: currentRankings.created_at,
          weights: { newsImpact: 0.3, baseScore: 0.7 },
        },
        stats: {
          total_tools: validRankings.length,
          tools_with_news: 0,
          avg_news_boost: 0,
          max_news_impact: 0,
        },
        _source: "json-db",
        _timestamp: new Date().toISOString(),
      },
      "/api/rankings"
    );
  } catch (error) {
    loggers.api.error("Error fetching rankings", { error });
    return NextResponse.json({ error: "Failed to fetch rankings" }, { status: 500 });
  }
}
