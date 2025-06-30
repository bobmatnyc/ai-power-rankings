import { NextRequest, NextResponse } from "next/server";
import { getRankingsRepo, getToolsRepo, getNewsRepo } from "@/lib/json-db";
import { loggers } from "@/lib/logger";
import type { RankingEntry } from "@/lib/json-db/schemas";

// Ranking weights for v6-news algorithm
const WEIGHTS = {
  newsImpact: 0.5, // Increased from 0.3 to give news more impact
  baseScore: 0.5, // Decreased from 0.7 to reduce base score dominance
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
  "ai-coding-tool": 50, // Default
};

function calculateTier(position: number): "S" | "A" | "B" | "C" | "D" {
  if (position <= 5) return "S";
  if (position <= 15) return "A";
  if (position <= 25) return "B";
  if (position <= 35) return "C";
  return "D";
}

// POST - Build new rankings
export async function POST(request: NextRequest) {
  try {
    // TODO: Add authentication check here

    const body = await request.json();
    const { period, preview_date } = body;

    if (!period) {
      return NextResponse.json(
        { error: "Period is required (YYYY-MM-DD or YYYY-MM format)" },
        { status: 400 }
      );
    }

    const toolsRepo = getToolsRepo();
    const newsRepo = getNewsRepo();
    const rankingsRepo = getRankingsRepo();

    // Get all active tools
    const allTools = await toolsRepo.getAll();
    let activeTools = allTools.filter((tool) => tool.status === "active");

    // If preview_date is provided, filter tools that didn't exist yet
    if (preview_date) {
      const cutoffDate = new Date(preview_date);
      const beforeFilter = activeTools.length;
      activeTools = activeTools.filter((tool) => {
        // Use launch_date if available, otherwise fall back to created_at
        const toolDate = tool.launch_date ? new Date(tool.launch_date) : new Date(tool.created_at);
        return toolDate <= cutoffDate;
      });
      const afterFilter = activeTools.length;

      if (beforeFilter !== afterFilter) {
        loggers.api.info(
          `Filtered tools from ${beforeFilter} to ${afterFilter} based on launch/creation date (cutoff: ${preview_date})`
        );
      }
    }

    // Get all news articles
    const allNews = await newsRepo.getAll();

    // Calculate rankings for each tool
    const toolRankings: Array<{
      tool_id: string;
      tool_name: string;
      score: number;
      base_score: number;
      news_impact_score: number;
      news_articles_count: number;
      recent_funding_rounds: number;
      recent_product_launches: number;
    }> = [];

    for (const tool of activeTools) {
      // Get news for this tool
      const toolNews = allNews.filter((article) => article.tool_mentions?.includes(tool.id));

      // Filter recent news (last 12 months from preview date or now)
      const cutoffDate = preview_date ? new Date(preview_date) : new Date();
      const oneYearAgo = new Date(cutoffDate);
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      // For period-based rankings, also consider a 3-month window for more variation
      const threeMonthsAgo = new Date(period);
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      const recentNews = toolNews.filter((article) => {
        const publishedDate = new Date(article.published_date);
        return publishedDate >= oneYearAgo && publishedDate <= cutoffDate;
      });

      // Get news from the last 3 months for more time-sensitive scoring
      const recentThreeMonthNews = toolNews.filter((article) => {
        const publishedDate = new Date(article.published_date);
        return publishedDate >= threeMonthsAgo && publishedDate <= new Date(period);
      });

      // Calculate news metrics
      const fundingNews = recentNews.filter(
        (n) =>
          n.title.toLowerCase().includes("funding") ||
          n.title.toLowerCase().includes("raised") ||
          n.title.toLowerCase().includes("investment")
      );

      const productNews = recentNews.filter(
        (n) =>
          n.title.toLowerCase().includes("launch") ||
          n.title.toLowerCase().includes("release") ||
          n.title.toLowerCase().includes("announce") ||
          n.title.toLowerCase().includes("introduces")
      );

      // Base score from category
      const baseScore = CATEGORY_SCORES[tool.category] || 50;

      // News impact calculation with time-based variation
      let newsScore = 0;
      if (recentNews.length > 0) {
        // Base importance varies by recent activity
        const recentActivityBonus = recentThreeMonthNews.length * 10;

        // Calculate volume bonus with logarithmic scale
        const volumeBonus = Math.log(recentNews.length + 1) * 15;

        // Three-month momentum bonus
        const momentumBonus = Math.min(recentThreeMonthNews.length * 20, 100);

        newsScore =
          recentActivityBonus + // Recent activity bonus
          fundingNews.length * 30 + // Increased funding multiplier
          productNews.length * 20 + // Increased product launch multiplier
          volumeBonus + // Volume bonus
          momentumBonus; // Three-month momentum

        // Apply recency decay based on average age of THREE-MONTH news
        if (recentThreeMonthNews.length > 0) {
          const avgDaysOld =
            recentThreeMonthNews.reduce((sum, n) => {
              const days =
                (new Date(period).getTime() - new Date(n.published_date).getTime()) /
                (1000 * 60 * 60 * 24);
              return sum + days;
            }, 0) / recentThreeMonthNews.length;

          // Stronger decay for more recent periods
          const decayFactor = 1 / (1 + Math.pow(avgDaysOld / 90, 1.5));
          newsScore = newsScore * decayFactor;
        } else {
          // No recent news = bigger penalty
          newsScore = newsScore * 0.3;
        }
      }

      // Combined score with small random variation to break ties
      const randomVariation = (Math.random() - 0.5) * 0.5; // +/- 0.25 points
      const totalScore =
        baseScore * WEIGHTS.baseScore + newsScore * WEIGHTS.newsImpact + randomVariation;

      toolRankings.push({
        tool_id: tool.id,
        tool_name: tool.name,
        score: totalScore,
        base_score: baseScore,
        news_impact_score: newsScore,
        news_articles_count: recentNews.length,
        recent_funding_rounds: fundingNews.length,
        recent_product_launches: productNews.length,
      });
    }

    // Sort by total score descending
    toolRankings.sort((a, b) => b.score - a.score);

    // Get previous rankings - find the period before this one
    const allPeriods = await rankingsRepo.getAvailablePeriods();
    const currentPeriodIndex = allPeriods.indexOf(period);
    let previousRankingsMap = new Map<string, number>();

    if (currentPeriodIndex >= 0 && currentPeriodIndex < allPeriods.length - 1) {
      // Get the previous period (remember periods are sorted descending)
      const previousPeriodKey = allPeriods[currentPeriodIndex + 1];
      if (previousPeriodKey) {
        const previousPeriod = await rankingsRepo.getRankingsForPeriod(previousPeriodKey);

        if (previousPeriod) {
          previousRankingsMap = new Map(
            previousPeriod.rankings.map((r) => [r.tool_id, r.position])
          );
        }
      }
    }

    // Create ranking entries
    const rankings: RankingEntry[] = toolRankings.map((ranking, index) => {
      const position = index + 1;
      const previousPosition = previousRankingsMap.get(ranking.tool_id);

      let movement = undefined;
      if (previousPosition) {
        const change = previousPosition - position;
        movement = {
          previous_position: previousPosition,
          change: Math.abs(change),
          direction: (change > 0 ? "up" : change < 0 ? "down" : "same") as "up" | "down" | "same",
        };
      } else {
        movement = {
          change: 0,
          direction: "new" as const,
        };
      }

      return {
        tool_id: ranking.tool_id,
        tool_name: ranking.tool_name,
        position,
        score: ranking.score,
        tier: calculateTier(position),
        factor_scores: {
          agentic_capability: ranking.base_score,
          innovation: 0,
          technical_performance: 0,
          developer_adoption: 0,
          market_traction: 0,
          business_sentiment: 0,
          development_velocity: 0,
          platform_resilience: 0,
        },
        movement,
        change_analysis:
          ranking.recent_funding_rounds > 0 ||
          ranking.recent_product_launches > 0 ||
          ranking.news_articles_count > 5
            ? {
                primary_reason:
                  ranking.recent_funding_rounds > 0
                    ? "Recent funding announcement"
                    : ranking.recent_product_launches > 0
                      ? "Major product launch"
                      : "High news coverage",
              }
            : undefined,
      };
    });

    // Save the rankings
    await rankingsRepo.saveRankingsForPeriod({
      period,
      algorithm_version: "v6-news",
      is_current: false, // Don't automatically make it current
      created_at: new Date().toISOString(),
      preview_date,
      rankings,
    });

    return NextResponse.json({
      success: true,
      period,
      rankings_count: rankings.length,
      stats: {
        tools_with_news: toolRankings.filter((r) => r.news_articles_count > 0).length,
        avg_news_boost:
          toolRankings.reduce((sum, r) => sum + r.news_impact_score, 0) / toolRankings.length,
        max_news_impact: Math.max(...toolRankings.map((r) => r.news_impact_score)),
      },
      message: `Rankings built successfully for ${period}`,
    });
  } catch (error) {
    loggers.api.error("Build rankings error", { error });

    return NextResponse.json(
      {
        error: "Failed to build rankings",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
