import { NextResponse } from "next/server";
import { supabase } from "@/lib/database";
import { loggers } from "@/lib/logger";

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
    const { data: tools, error: toolsError } = await supabase
      .from("tools")
      .select("*")
      .order("name");

    if (toolsError || !tools) {
      loggers.ranking.error("Error fetching tools for news rankings", { error: toolsError });
      return [];
    }

    // Get all news
    const { data: news, error: newsError } = await supabase
      .from("news_updates")
      .select("*")
      .order("published_at", { ascending: false });

    if (newsError || !news) {
      loggers.ranking.error("Error fetching news for rankings", { error: newsError });
      return [];
    }

    const rankings: ToolRanking[] = [];

    for (const tool of tools) {
      // Get news for this tool
      const toolNews = news.filter(
        (article) =>
          article.related_tools?.includes(tool.id) || article.related_tools?.includes(tool.slug)
      );

      // Filter recent news (last 12 months)
      const recentNews = toolNews.filter((article) => {
        const publishedDate = new Date(article.published_at);
        const daysSince = (Date.now() - publishedDate.getTime()) / (1000 * 60 * 60 * 24);
        return daysSince <= 365;
      });

      // Calculate news metrics
      const fundingNews = recentNews.filter((n) => n.category === "funding");
      const productNews = recentNews.filter(
        (n) => n.category === "product-launch" || n.category === "technical-achievement"
      );

      // Base score from category
      const baseScore = CATEGORY_SCORES[tool.category] || 50;

      // News impact calculation
      let newsScore = 0;
      if (recentNews.length > 0) {
        const totalImportance = recentNews.reduce((sum, n) => sum + (n.importance_score || 5), 0);
        const avgImportance = totalImportance / recentNews.length;

        newsScore =
          avgImportance * 8 + // Base importance
          fundingNews.length * 25 + // Funding multiplier
          productNews.length * 15 + // Product launch multiplier
          Math.min(recentNews.length * 2, 20); // Volume bonus (capped)

        // Apply recency decay
        const avgDaysOld =
          recentNews.reduce((sum, n) => {
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
    // Get news-enhanced rankings using the v6-news algorithm
    const rankings = await getNewsEnhancedRankings();

    if (!rankings || rankings.length === 0) {
      loggers.ranking.error("No news-enhanced rankings available");
      return NextResponse.json({ error: "Failed to fetch rankings" }, { status: 500 });
    }

    // Get tool details
    const toolIds = rankings.map((r) => r.tool_id);
    const { data: tools } = await supabase
      .from("tools")
      .select("id, name, slug, category, status, website_url, description")
      .in("id", toolIds);

    const toolMap = new Map(tools?.map((t) => [t.id, t]) || []);

    // Format response with news-enhanced data
    const formattedRankings = rankings
      .map((ranking) => {
        const tool = toolMap.get(ranking.tool_id);
        if (!tool) {
          return null;
        }

        // Fix tool names
        let displayName = tool.name;
        if (tool.id === "claude-artifacts") {
          displayName = "Claude.ai";
        }

        return {
          rank: ranking.position,
          tool: {
            id: tool.id,
            name: displayName,
            category: tool.category,
            status: tool.status,
            website_url: tool.website_url,
            description: tool.description,
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

    return NextResponse.json({
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
  } catch (error) {
    loggers.ranking.error("Error fetching rankings", { error });
    return NextResponse.json({ error: "Failed to fetch rankings" }, { status: 500 });
  }
}
