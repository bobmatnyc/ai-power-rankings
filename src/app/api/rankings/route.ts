import { NextResponse } from "next/server";
import { payloadDirect } from "@/lib/payload-direct";
import { loggers } from "@/lib/logger";
import { loadCacheWithFallback } from "@/lib/cache/load-cache";
import { CacheManager } from "@/lib/cache/cache-manager";

// News-enhanced ranking types
interface ToolRanking {
  tool_id: string;
  tool_name: string;
  position: number;
  score: number;
  tier: string;
  base_score: number;
  news_impact_score: number;
  news_articles_count: number;
  recent_funding_rounds: number;
  recent_product_launches: number;
}

// Ranking weights for v6-news algorithm
const WEIGHTS = {
  newsImpact: 0.3,
  baseScore: 0.7,
};

// Category base scores
const CATEGORY_SCORES: Record<string, number> = {
  "autonomous-agent": 75,
  "ai-assistant": 70,
  "ide-assistant": 65,
  "code-editor": 60,
  "open-source-framework": 55,
  "app-builder": 50,
  "code-generation": 50,
  "code-review": 45,
  "testing-tool": 45,
};

function calculateTier(position: number): string {
  if (position <= 5) {
    return "S";
  }
  if (position <= 15) {
    return "A";
  }
  if (position <= 25) {
    return "B";
  }
  if (position <= 35) {
    return "C";
  }
  return "D";
}

async function getNewsEnhancedRankings(): Promise<ToolRanking[]> {
  try {
    // Get all tools
    let toolsResponse;
    try {
      toolsResponse = await payloadDirect.getTools({
        limit: 1000, // Get all tools
        sort: "name",
      });
    } catch (error) {
      loggers.ranking.error("Failed to fetch tools in getNewsEnhancedRankings", { error });
      return [];
    }

    if (!toolsResponse || !toolsResponse.docs) {
      loggers.ranking.error("Invalid tools response", { toolsResponse });
      return [];
    }

    const tools = toolsResponse.docs;

    if (!tools || tools.length === 0) {
      loggers.ranking.error("No tools found for news rankings");
      return [];
    }

    // Get all news
    const newsResponse = await payloadDirect.getNews({
      limit: 1000, // Get recent news
      sort: "-published_at",
    });

    if (!newsResponse || !newsResponse.docs) {
      loggers.ranking.error("Invalid news response", { newsResponse });
      return [];
    }

    const news = newsResponse.docs;

    if (!news) {
      loggers.ranking.error("No news found for rankings");
      return [];
    }

    const rankings: ToolRanking[] = [];

    for (const tool of tools) {
      // Get news for this tool
      const toolNews = news.filter((article: any) => {
        // Check if this tool is in the related_tools
        if (article.related_tools && Array.isArray(article.related_tools)) {
          return article.related_tools.some((relatedTool: any) => {
            // Handle both string IDs and object references
            const toolRef = typeof relatedTool === "string" ? relatedTool : relatedTool.id;
            return toolRef === tool.id || toolRef === tool.slug;
          });
        }
        return false;
      });

      // Filter recent news (last 12 months)
      const recentNews = toolNews.filter((article: any) => {
        const publishedDate = new Date(article.published_at);
        const daysSince = (Date.now() - publishedDate.getTime()) / (1000 * 60 * 60 * 24);
        return daysSince <= 365;
      });

      // Calculate news metrics
      const fundingNews = recentNews.filter((n: any) => n.category === "funding");
      const productNews = recentNews.filter(
        (n: any) => n.category === "product-launch" || n.category === "technical-achievement"
      );

      // Base score from category
      const baseScore = CATEGORY_SCORES[tool.category] || 50;

      // News impact calculation
      let newsScore = 0;
      if (recentNews.length > 0) {
        const totalImportance = recentNews.reduce(
          (sum: number, n: any) =>
            sum + (n.impact_level === "high" ? 8 : n.impact_level === "medium" ? 5 : 3),
          0
        );
        const avgImportance = totalImportance / recentNews.length;

        // Calculate volume bonus with logarithmic scale for better distribution
        const volumeBonus = Math.log(recentNews.length + 1) * 15; // Logarithmic scale

        newsScore =
          avgImportance * 8 + // Base importance
          fundingNews.length * 25 + // Funding multiplier
          productNews.length * 15 + // Product launch multiplier
          volumeBonus; // Volume bonus (logarithmic)

        // Apply recency decay
        const avgDaysOld =
          recentNews.reduce((sum: number, n: any) => {
            const days = (Date.now() - new Date(n.published_at).getTime()) / (1000 * 60 * 60 * 24);
            return sum + days;
          }, 0) / recentNews.length;

        const decayFactor = 1 / (1 + Math.pow(avgDaysOld / 365, 1.2));
        newsScore = newsScore * decayFactor;
      }

      // Combined score
      const totalScore = baseScore * WEIGHTS.baseScore + newsScore * WEIGHTS.newsImpact;

      rankings.push({
        tool_id: tool.id,
        tool_name: tool.name,
        position: 0, // Will be set after sorting
        score: totalScore,
        tier: "", // Will be set after positioning
        base_score: baseScore,
        news_impact_score: newsScore,
        news_articles_count: recentNews.length,
        recent_funding_rounds: fundingNews.length,
        recent_product_launches: productNews.length,
      });
    }

    // Sort by total score and assign positions
    rankings.sort((a, b) => b.score - a.score);
    rankings.forEach((ranking, index) => {
      ranking.position = index + 1;
      ranking.tier = calculateTier(ranking.position);
    });

    return rankings;
  } catch (error) {
    loggers.ranking.error("Error calculating news-enhanced rankings", { error });
    return [];
  }
}

export async function GET(): Promise<NextResponse> {
  try {
    // Debug logging for preview environment
    if (process.env["VERCEL_ENV"] === "preview") {
      console.log("Preview environment detected");
      console.log("Has DB URL:", !!process.env["SUPABASE_DATABASE_URL"]);
      console.log("DB URL prefix:", process.env["SUPABASE_DATABASE_URL"]?.substring(0, 50));
    }

    // Check if we should use cache-first approach
    // Temporarily enabled for production due to database stability issues
    const useCacheFirst =
      process.env["USE_CACHE_FALLBACK"] === "true" ||
      process.env["VERCEL_ENV"] === "preview" ||
      true; // Enable for all environments temporarily

    // For preview environments or when cache is enabled, return cached data immediately
    if (useCacheFirst) {
      loggers.ranking.info("Using cache-first approach for rankings");
      console.log("Loading rankings from cache");

      const cachedRankingsData = await loadCacheWithFallback("rankings");
      const cacheInfo = await new CacheManager().getInfo("rankings");
      
      // Return the cached data with metadata
      const cachedResponse = {
        ...cachedRankingsData,
        _cached: true,
        _cachedAt: cacheInfo.lastModified || new Date().toISOString(),
        _cacheReason: "Cache-first approach (database stability mode)",
        _cacheSource: cacheInfo.source,
      };

      return NextResponse.json(cachedResponse);
    }

    // For production, try to get live rankings
    const rankings = await getNewsEnhancedRankings();

    // If no rankings available, use cached data as fallback
    if (!rankings || rankings.length === 0) {
      loggers.ranking.warn("No live rankings available, falling back to cached data");
      console.log("Using cached rankings data as fallback");

      const cachedRankingsData = await loadCacheWithFallback("rankings");
      const cacheInfo = await new CacheManager().getInfo("rankings");
      
      // Return the cached data with metadata
      const cachedResponse = {
        ...cachedRankingsData,
        _cached: true,
        _cachedAt: cacheInfo.lastModified || new Date().toISOString(),
        _cacheReason: "Database connection unavailable",
        _cacheSource: cacheInfo.source,
      };

      return NextResponse.json(cachedResponse);
    }

    // Get tool details - we already have them from the rankings calculation
    const toolIds = rankings.map((r) => r.tool_id);
    const toolsResponse = await payloadDirect.getTools({
      limit: 1000,
      where: {
        id: { in: toolIds },
      },
    });

    if (!toolsResponse || !toolsResponse.docs) {
      loggers.ranking.error("Invalid tools response for tool details", { toolsResponse });
      return NextResponse.json({ error: "Failed to fetch tool details" }, { status: 500 });
    }

    const tools = toolsResponse.docs;

    const toolMap = new Map(tools?.map((t: any) => [t.id, t]) || []);

    // Previous rankings (simulated for now - in production, fetch from ranking_cache)
    const previousRankings: Record<string, number> = {
      "claude-code": 1,
      cursor: 2,
      devin: 3,
      windsurf: 4,
      "github-copilot": 5,
      v0: 6,
      "bolt-new": 7,
      lovable: 8,
      "replit-agent": 9,
      aider: 10,
      "chatgpt-canvas": 11,
      "claude-artifacts": 12,
      jules: 15,
      "openai-codex-cli": 20,
    };

    // Format response with news-enhanced data
    const formattedRankings = rankings
      .map((ranking) => {
        const tool = toolMap.get(ranking.tool_id) as any;
        if (!tool) {
          return null;
        }

        // Fix tool names
        let displayName = tool["display_name"] || tool["name"];
        if (tool["id"] === "claude-artifacts") {
          displayName = "Claude.ai";
        }

        // Calculate ranking change
        const previousRank = previousRankings[tool["id"]];
        const rankChange = previousRank ? previousRank - ranking.position : null;

        // Determine change reason
        let changeReason = "";
        if (rankChange !== null && rankChange !== 0) {
          if (ranking.recent_funding_rounds > 0) {
            changeReason = `${ranking.recent_funding_rounds} funding round${ranking.recent_funding_rounds > 1 ? "s" : ""} boosted ranking`;
          } else if (ranking.recent_product_launches > 0) {
            changeReason = `${ranking.recent_product_launches} major product launch${ranking.recent_product_launches > 1 ? "es" : ""}`;
          } else if (ranking.news_articles_count > 5) {
            changeReason = `High news coverage (${ranking.news_articles_count} articles)`;
          } else if (rankChange < 0) {
            changeReason = "Other tools gained momentum";
          } else {
            changeReason = "Improved market position";
          }
        }

        // Extract description text from rich text if needed
        let description = "";
        if (tool["description"] && Array.isArray(tool["description"])) {
          description = tool["description"]
            .map((block: any) => block.children?.map((child: any) => child.text).join(""))
            .join("\n");
        }

        return {
          rank: ranking.position,
          previousRank,
          rankChange,
          changeReason,
          tool: {
            id: tool["id"],
            slug: tool["slug"] || tool["id"], // Use slug if available, fallback to id
            name: displayName,
            category: tool["category"],
            status: tool["status"],
            website_url: tool["website_url"],
            description: description,
          },
          total_score: ranking.score,
          scores: {
            overall: ranking.score,
            base_score: ranking.base_score,
            news_impact: ranking.news_impact_score,
            // Provide backward compatibility for home page
            agentic_capability: Math.min(10, ranking.base_score / 10),
            innovation: Math.min(10, ranking.news_impact_score / 20),
          },
          metrics: {
            news_articles_count: ranking.news_articles_count,
            recent_funding_rounds: ranking.recent_funding_rounds,
            recent_product_launches: ranking.recent_product_launches,
            // Provide backward compatibility
            users: ranking.news_articles_count * 10000, // Estimated
            swe_bench_score: Math.min(100, ranking.base_score * 1.2),
          },
          tier: ranking.tier,
        };
      })
      .filter(Boolean);

    const apiResponse = NextResponse.json({
      rankings: formattedRankings,
      algorithm: {
        version: "v6-news",
        name: "News-Enhanced Rankings",
        date: new Date().toISOString(),
        weights: WEIGHTS,
      },
      stats: {
        total_tools: rankings.length,
        tools_with_news: rankings.filter((r) => r.news_articles_count > 0).length,
        avg_news_boost: rankings.reduce((sum, r) => sum + r.news_impact_score, 0) / rankings.length,
        max_news_impact: Math.max(...rankings.map((r) => r.news_impact_score)),
      },
    });

    // Set cache headers for production
    apiResponse.headers.set(
      "Cache-Control",
      process.env.NODE_ENV === "production"
        ? "public, s-maxage=3600, stale-while-revalidate=1800"
        : "no-cache"
    );

    return apiResponse;
  } catch (error) {
    loggers.ranking.error("Error fetching rankings", { error });
    return NextResponse.json({ error: "Failed to fetch rankings" }, { status: 500 });
  }
}
