import { NextResponse } from "next/server";
import { CacheManager } from "@/lib/cache/cache-manager";
import { loadCacheWithFallback } from "@/lib/cache/load-cache";
import { getRankingsRepo, getToolsRepo } from "@/lib/json-db";
import { loggers } from "@/lib/logger";

// Type definitions for cached rankings data
interface CachedRankingItem {
  tool_id: string;
  tool_name: string;
  rank: number;
  score: number;
  movement?: {
    previous_position: number;
    change: number;
    direction: string;
  };
  factor_scores: {
    agenticCapability?: number;
    innovation?: number;
    technicalPerformance?: number;
    developerAdoption?: number;
    marketTraction?: number;
    businessSentiment?: number;
    developmentVelocity?: number;
    platformResilience?: number;
    technicalCapability?: number;
    communitySentiment?: number;
  };
  sentiment_analysis?: {
    rawSentiment: number;
    adjustedSentiment: number;
    newsImpact: number;
    notes: string;
  };
  algorithm_version: string;
  position: number;
}

interface CachedRankingsData {
  period: string;
  date: string;
  algorithm_version: string;
  algorithm_name: string;
  rankings: CachedRankingItem[];
  _cached?: boolean;
  _cachedAt?: string;
  _cacheReason?: string;
  _cacheSource?: string;
}

export async function GET(): Promise<NextResponse> {
  try {
    // Check if we should use cache-first approach
    const useCacheFirst =
      process.env["USE_CACHE_FALLBACK"] === "true" ||
      process.env["VERCEL_ENV"] === "preview" ||
      true; // Enable for all environments temporarily

    // For preview environments or when cache is enabled, return cached data immediately
    if (useCacheFirst) {
      loggers.ranking.debug("Using cache-first approach for rankings");

      const cachedRankingsData = (await loadCacheWithFallback("rankings")) as CachedRankingsData;
      const cacheInfo = await new CacheManager().getInfo("rankings");

      // Return the cached data with metadata
      const cachedResponse: CachedRankingsData = {
        ...cachedRankingsData,
        _cached: true,
        _cachedAt: cacheInfo.lastModified || new Date().toISOString(),
        _cacheReason: "Cache-first approach (database stability mode)",
        _cacheSource: cacheInfo.source,
      };

      return NextResponse.json(cachedResponse);
    }

    // Get rankings from JSON database
    const rankingsRepo = getRankingsRepo();
    const toolsRepo = getToolsRepo();
    // Companies not needed for this endpoint

    // Get current period
    const currentPeriod = await rankingsRepo.getCurrentPeriod();

    if (!currentPeriod) {
      loggers.ranking.warn("No current ranking period set, falling back to cache");

      const cachedRankingsData = (await loadCacheWithFallback("rankings")) as CachedRankingsData;
      const cacheInfo = await new CacheManager().getInfo("rankings");

      const cachedResponse: CachedRankingsData = {
        ...cachedRankingsData,
        _cached: true,
        _cachedAt: cacheInfo.lastModified || new Date().toISOString(),
        _cacheReason: "No current ranking period",
        _cacheSource: cacheInfo.source,
      };

      return NextResponse.json(cachedResponse);
    }

    // Get rankings for current period
    const periodData = await rankingsRepo.getRankingsForPeriod(currentPeriod);

    if (!periodData || !periodData.rankings || periodData.rankings.length === 0) {
      loggers.ranking.warn("No rankings available for current period, falling back to cache");

      const cachedRankingsData = (await loadCacheWithFallback("rankings")) as CachedRankingsData;
      const cacheInfo = await new CacheManager().getInfo("rankings");

      const cachedResponse: CachedRankingsData = {
        ...cachedRankingsData,
        _cached: true,
        _cachedAt: cacheInfo.lastModified || new Date().toISOString(),
        _cacheReason: "No rankings data available",
        _cacheSource: cacheInfo.source,
      };

      return NextResponse.json(cachedResponse);
    }

    // Get all tools and companies for enrichment
    const tools = await toolsRepo.getAll();
    const toolMap = new Map(tools.map((t) => [t.id, t]));

    // Companies not needed for this endpoint

    // Format rankings with tool details
    const formattedRankings = periodData.rankings
      .map((ranking) => {
        const tool = toolMap.get(ranking.tool_id);

        if (!tool) {
          loggers.ranking.warn("Tool not found for ranking", { toolId: ranking.tool_id });
          return null;
        }

        // Get company name
        // Company info not needed for this response

        // Calculate ranking change
        let rankChange = null;
        let changeReason = "";

        if (ranking.movement) {
          if (ranking.movement.direction === "up") {
            rankChange = ranking.movement.change;
          } else if (ranking.movement.direction === "down") {
            rankChange = -ranking.movement.change;
          }

          changeReason =
            ranking.change_analysis?.primary_reason ||
            ranking.change_analysis?.narrative_explanation ||
            "";
        }

        return {
          rank: ranking.position,
          previousRank: ranking.movement?.previous_position,
          rankChange,
          changeReason,
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
            base_score: ranking.factor_scores.agentic_capability || 50,
            news_impact: 0, // Not available in current data
            // Provide factor scores
            agentic_capability: ranking.factor_scores.agentic_capability || 5,
            innovation: ranking.factor_scores.innovation || 5,
          },
          metrics: {
            news_articles_count: 0,
            recent_funding_rounds: 0,
            recent_product_launches: 0,
            // These would come from metrics if available
            users: null,
            swe_bench_score: null,
          },
          tier: ranking.tier,
        };
      })
      .filter(Boolean);

    const apiResponse = NextResponse.json({
      rankings: formattedRankings,
      algorithm: {
        version: periodData.algorithm_version,
        name: "AI Power Rankings Algorithm",
        date: periodData.created_at,
        weights: {
          newsImpact: 0.3,
          baseScore: 0.7,
        },
      },
      stats: {
        total_tools: formattedRankings.length,
        tools_with_news: 0, // Would need to calculate from news data
        avg_news_boost: 0,
        max_news_impact: 0,
      },
      _source: "json-db",
      _period: currentPeriod,
    });

    // Set cache headers for production
    apiResponse.headers.set(
      "Cache-Control",
      process.env["NODE_ENV"] === "production"
        ? "public, s-maxage=3600, stale-while-revalidate=1800"
        : "no-cache"
    );

    return apiResponse;
  } catch (error) {
    loggers.ranking.error("Error fetching rankings", { error });

    // Fall back to cached data on error
    try {
      const cachedRankingsData = (await loadCacheWithFallback("rankings")) as CachedRankingsData;
      const cacheInfo = await new CacheManager().getInfo("rankings");

      const cachedResponse: CachedRankingsData = {
        ...cachedRankingsData,
        _cached: true,
        _cachedAt: cacheInfo.lastModified || new Date().toISOString(),
        _cacheReason: "Database error fallback",
        _cacheSource: cacheInfo.source,
      };

      return NextResponse.json(cachedResponse);
    } catch (cacheError) {
      loggers.ranking.error("Cache fallback also failed", { cacheError });
      return NextResponse.json({ error: "Failed to fetch rankings" }, { status: 500 });
    }
  }
}
