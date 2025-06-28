import { NextRequest, NextResponse } from "next/server";
import { getRankingsRepo, getToolsRepo, getNewsRepo } from "@/lib/json-db";
import { loggers } from "@/lib/logger";
import type { RankingEntry } from "@/lib/json-db/schemas";

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
  "ai-coding-tool": 50, // Default
};

function calculateTier(position: number): 'S' | 'A' | 'B' | 'C' | 'D' {
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
        { error: "Period is required (YYYY-MM format)" },
        { status: 400 }
      );
    }
    
    const toolsRepo = getToolsRepo();
    const newsRepo = getNewsRepo();
    const rankingsRepo = getRankingsRepo();
    
    // Get all active tools
    const allTools = await toolsRepo.getAll();
    const activeTools = allTools.filter(tool => tool.status === 'active');
    
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
      const toolNews = allNews.filter(article => 
        article.tool_mentions?.includes(tool.id)
      );
      
      // Filter recent news (last 12 months from preview date or now)
      const cutoffDate = preview_date ? new Date(preview_date) : new Date();
      const oneYearAgo = new Date(cutoffDate);
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      
      const recentNews = toolNews.filter(article => {
        const publishedDate = new Date(article.published_date);
        return publishedDate >= oneYearAgo && publishedDate <= cutoffDate;
      });
      
      // Calculate news metrics
      const fundingNews = recentNews.filter(n => 
        n.category === "funding" || 
        n.title.toLowerCase().includes("funding") ||
        n.title.toLowerCase().includes("raised")
      );
      
      const productNews = recentNews.filter(n => 
        n.category === "product" || 
        n.category === "product-launch" ||
        n.title.toLowerCase().includes("launch") ||
        n.title.toLowerCase().includes("release")
      );
      
      // Base score from category
      const baseScore = CATEGORY_SCORES[tool.category] || 50;
      
      // News impact calculation
      let newsScore = 0;
      if (recentNews.length > 0) {
        // Average importance (simplified since we don't have impact_level)
        const avgImportance = 5; // Default medium importance
        
        // Calculate volume bonus with logarithmic scale
        const volumeBonus = Math.log(recentNews.length + 1) * 15;
        
        newsScore = 
          avgImportance * 8 + // Base importance
          fundingNews.length * 25 + // Funding multiplier
          productNews.length * 15 + // Product launch multiplier
          volumeBonus; // Volume bonus
        
        // Apply recency decay
        const avgDaysOld = recentNews.reduce((sum, n) => {
          const days = (cutoffDate.getTime() - new Date(n.published_date).getTime()) / (1000 * 60 * 60 * 24);
          return sum + days;
        }, 0) / recentNews.length;
        
        const decayFactor = 1 / (1 + Math.pow(avgDaysOld / 365, 1.2));
        newsScore = newsScore * decayFactor;
      }
      
      // Combined score
      const totalScore = baseScore * WEIGHTS.baseScore + newsScore * WEIGHTS.newsImpact;
      
      toolRankings.push({
        tool_id: tool.id,
        tool_name: tool.display_name || tool.name,
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
    
    // Get previous rankings if they exist
    const previousPeriod = await rankingsRepo.getRankingsForPeriod(period);
    const previousRankingsMap = new Map(
      previousPeriod?.rankings.map(r => [r.tool_id, r.position])
    );
    
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
          direction: change > 0 ? 'up' : change < 0 ? 'down' : 'same' as const,
        };
      } else {
        movement = {
          change: 0,
          direction: 'new' as const,
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
        change_analysis: {
          primary_reason: ranking.recent_funding_rounds > 0 
            ? "Recent funding announcement"
            : ranking.recent_product_launches > 0
            ? "Major product launch"
            : ranking.news_articles_count > 5
            ? "High news coverage"
            : undefined,
        },
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
        tools_with_news: toolRankings.filter(r => r.news_articles_count > 0).length,
        avg_news_boost: toolRankings.reduce((sum, r) => sum + r.news_impact_score, 0) / toolRankings.length,
        max_news_impact: Math.max(...toolRankings.map(r => r.news_impact_score)),
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