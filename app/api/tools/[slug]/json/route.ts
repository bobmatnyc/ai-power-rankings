import { type NextRequest, NextResponse } from "next/server";
import { eq, desc, and, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/connection";
import { ToolsRepository } from "@/lib/db/repositories/tools.repository";
import { NewsRepository } from "@/lib/db/repositories/news.ts";
import { rankingsRepository } from "@/lib/db/repositories/rankings.repository";
import { loggers } from "@/lib/logger";
import { articles, rankingVersions } from "@/lib/db/schema";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const startTime = Date.now();

  try {
    const { slug } = await params;

    // Ensure database connection is available
    const db = getDb();
    if (!db) {
      loggers.api.error("Database connection not available");
      return NextResponse.json(
        {
          error: "Database connection unavailable",
          message: "The database service is currently unavailable. Please try again later.",
        },
        { status: 503 }
      );
    }

    loggers.api.debug("Getting tool details by slug", { slug });

    const toolsRepo = new ToolsRepository();
    const newsRepo = new NewsRepository();

    // Get the tool by slug
    const tool = await toolsRepo.findBySlug(slug);

    if (!tool) {
      loggers.api.warn("Tool not found", { slug });
      return NextResponse.json(
        {
          error: "Tool not found",
          message: "The requested tool could not be found.",
        },
        { status: 404 }
      );
    }

    // Get current rankings to find this tool's rank and scores
    let ranking = null;
    try {
      const currentRankings = await rankingsRepository.getCurrentRankings();

      if (currentRankings) {
        const rankingsData = currentRankings.data;
        let rankings = [];

        // Handle different data structures
        if (Array.isArray(rankingsData)) {
          rankings = rankingsData;
        } else if (rankingsData && typeof rankingsData === "object") {
          if (rankingsData["rankings"] && Array.isArray(rankingsData["rankings"])) {
            rankings = rankingsData["rankings"];
          } else if (rankingsData["data"] && Array.isArray(rankingsData["data"])) {
            rankings = rankingsData["data"];
          }
        }

        // Find this tool's ranking
        const toolRanking = rankings.find((r: any) =>
          r["tool_id"] === tool.id ||
          r["tool_slug"] === slug ||
          r["tool_name"]?.toLowerCase() === tool.name.toLowerCase()
        );

        if (toolRanking) {
          const factorScores = toolRanking["factor_scores"] || {};

          ranking = {
            rank: toolRanking["rank"] || toolRanking["position"] || 0,
            previousRank: toolRanking["movement"]?.["previous_position"] || toolRanking["previous_rank"],
            rankChange: toolRanking["movement"]?.["change"] || toolRanking["rank_change"] || 0,
            scores: {
              overall: toolRanking["score"] || toolRanking["total_score"] || 0,
              agentic_capability: factorScores["agentic_capability"] || 0,
              innovation: factorScores["innovation"] || 0,
              technical_performance: factorScores["technical_performance"] || 0,
              developer_adoption: factorScores["developer_adoption"] || 0,
              market_traction: factorScores["market_traction"] || 0,
              business_sentiment: factorScores["business_sentiment"] || 0,
              development_velocity: factorScores["development_velocity"] || 0,
              platform_resilience: factorScores["platform_resilience"] || 0,
            },
          };
        }
      }
    } catch (error) {
      loggers.api.warn("Failed to fetch current rankings for tool", {
        toolId: tool.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    // Get rankings history for the last 30 days from ranking_versions table
    let rankingsHistory: Array<{
      position: number;
      score: number;
      period: string;
      ranking_periods: {
        period: string;
        display_name: string;
        calculation_date: string;
      };
    }> = [];

    try {
      // Get last 10 ranking versions ordered by created date
      const historicalRankings = await db
        .select()
        .from(rankingVersions)
        .orderBy(desc(rankingVersions.createdAt))
        .limit(10);

      for (const version of historicalRankings) {
        const snapshot = version.rankingsSnapshot as any;
        let rankings = [];

        // Parse snapshot structure
        if (Array.isArray(snapshot)) {
          rankings = snapshot;
        } else if (snapshot && typeof snapshot === "object") {
          if (snapshot["rankings"] && Array.isArray(snapshot["rankings"])) {
            rankings = snapshot["rankings"];
          } else if (snapshot["data"] && Array.isArray(snapshot["data"])) {
            rankings = snapshot["data"];
          }
        }

        // Find this tool in the snapshot
        const toolInSnapshot = rankings.find((r: any) =>
          r["tool_id"] === tool.id ||
          r["tool_slug"] === slug ||
          r["tool_name"]?.toLowerCase() === tool.name.toLowerCase()
        );

        if (toolInSnapshot) {
          const createdAt = new Date(version.createdAt);
          rankingsHistory.push({
            position: toolInSnapshot["rank"] || toolInSnapshot["position"] || 0,
            score: toolInSnapshot["score"] || toolInSnapshot["total_score"] || 0,
            period: createdAt.toISOString().split('T')[0], // YYYY-MM-DD format
            ranking_periods: {
              period: createdAt.toISOString().split('T')[0],
              display_name: version.version || createdAt.toLocaleDateString(),
              calculation_date: createdAt.toISOString(),
            },
          });
        }
      }
    } catch (error) {
      loggers.api.warn("Failed to fetch rankings history", {
        toolId: tool.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    // Get metric history from articles that mention this tool
    let metricHistory: Array<{
      metric_date: string;
      source_name: string;
      source_url: string;
      metrics: Record<string, { value: number; evidence?: string; confidence?: "high" | "medium" | "low" }>;
      scoring_metrics: Record<string, { value: number; evidence?: string; confidence?: "high" | "medium" | "low" }>;
      published_date: string;
    }> = [];

    try {
      // Query articles that mention this tool
      const toolArticles = await db
        .select()
        .from(articles)
        .where(
          sql`${articles.toolMentions}::jsonb @> ${JSON.stringify([{ name: tool.name }])}::jsonb OR
              ${articles.toolMentions}::jsonb @> ${JSON.stringify([tool.name])}::jsonb`
        )
        .orderBy(desc(articles.publishedDate))
        .limit(20);

      for (const article of toolArticles) {
        const toolMentions = article.toolMentions as any[];

        // Find the specific tool mention data
        let toolMention = toolMentions?.find((m: any) => {
          if (typeof m === 'string') return m.toLowerCase() === tool.name.toLowerCase();
          return m?.name?.toLowerCase() === tool.name.toLowerCase();
        });

        // If we have metric data in the mention
        if (toolMention && typeof toolMention === 'object' && toolMention.metrics) {
          metricHistory.push({
            metric_date: article.publishedDate?.toISOString() || article.createdAt.toISOString(),
            source_name: article.sourceName || "Unknown",
            source_url: article.sourceUrl || "",
            metrics: toolMention.metrics || {},
            scoring_metrics: toolMention.scoring_metrics || {},
            published_date: article.publishedDate?.toISOString() || article.createdAt.toISOString(),
          });
        }
      }
    } catch (error) {
      loggers.api.warn("Failed to fetch metric history", {
        toolId: tool.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    // Get recent news items mentioning this tool
    let newsItems: Array<{
      id: string;
      title: string;
      summary?: string;
      url?: string;
      source?: string;
      published_at: string;
      category?: string;
      type?: string;
    }> = [];

    try {
      // Search for news articles mentioning this tool by name
      const newsArticles = await newsRepo.searchByToolName(tool.name, 10);

      newsItems = newsArticles.map((article: any) => ({
        id: article.id,
        title: article.title,
        summary: article.summary,
        url: article.sourceUrl || article.source_url,
        source: article.source,
        published_at: article.publishedAt || article.published_date || article.createdAt,
        category: article.category,
        type: article.type || "news",
      }));
    } catch (error) {
      loggers.api.warn("Failed to fetch news items for tool", {
        toolId: tool.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    // Extract metrics from tool.info
    const toolInfo = tool.info || {};
    const metrics = {
      users: (toolInfo["metrics"] as any)?.user_count || (toolInfo["metrics"] as any)?.users,
      monthly_arr: (toolInfo["metrics"] as any)?.monthly_arr,
      swe_bench_score: (toolInfo["metrics"] as any)?.swe_bench,
      github_stars: (toolInfo["metrics"] as any)?.github_stars,
      valuation: (toolInfo["business"] as any)?.valuation,
      funding: (toolInfo["business"] as any)?.funding,
      employees: (toolInfo["business"] as any)?.employees,
    };

    // Tool data is spread directly on the tool object from the repository
    const toolData = tool as any;

    // Build response matching ToolDetailData interface
    const response = {
      tool: {
        id: tool.id,
        slug: tool.slug,
        name: tool.name,
        category: tool.category,
        status: tool.status,
        info: tool.info,
        website_url: toolData.website_url || (toolInfo["links"] as any)?.website || (toolInfo as any).website,
        github_repo: toolData.github_repo || (toolInfo["links"] as any)?.github || (toolInfo["technical"] as any)?.github_repo,
        description: toolData.description || (toolInfo["product"] as any)?.description || (toolInfo as any).description,
        tagline: toolData.tagline || (toolInfo["product"] as any)?.tagline || (toolInfo as any).tagline || (toolInfo as any).summary,
        features: toolData.features || (toolInfo as any).features || (toolInfo["product"] as any)?.features,
        supported_languages: toolData.supported_languages || (toolInfo["technical"] as any)?.language_support || (toolInfo["technical"] as any)?.languages,
        ide_support: toolData.ide_support || (toolInfo["technical"] as any)?.ide_integration,
        pricing_model: toolData.pricing_model || (toolInfo["business"] as any)?.pricing_model,
        license_type: (toolInfo as any).license_type,
        logo_url: toolData.logo_url || (toolInfo["metadata"] as any)?.logo_url,
      },
      ranking,
      metrics,
      metricHistory: metricHistory.length > 0 ? metricHistory : undefined,
      rankingsHistory: rankingsHistory.length > 0 ? rankingsHistory : undefined,
      newsItems: newsItems.length > 0 ? newsItems : undefined,
      _source: "database",
      _timestamp: new Date().toISOString(),
    };

    const processingTime = Date.now() - startTime;
    loggers.api.info("Tool details fetched successfully", {
      slug,
      toolId: tool.id,
      hasRanking: !!ranking,
      rankingsHistoryCount: rankingsHistory.length,
      metricHistoryCount: metricHistory.length,
      newsItemsCount: newsItems.length,
      processingTimeMs: processingTime,
    });

    // Return response with cache headers for performance
    return new NextResponse(JSON.stringify(response), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
        "X-Processing-Time": `${processingTime}ms`,
      },
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;

    loggers.api.error("Tool detail API error", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      processingTimeMs: processingTime,
    });

    return NextResponse.json(
      {
        error: "Internal server error",
        message: "An error occurred while fetching tool details. Please try again later.",
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
