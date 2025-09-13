import { promises as fs } from "node:fs";
import path from "node:path";
import { type NextRequest, NextResponse } from "next/server";

interface NewsAnalysis {
  title: string;
  tool_mentions: Array<{
    tool: string;
    sentiment: number;
  }>;
  overall_sentiment: number;
  importance_score: number;
  qualitative_metrics?: {
    innovation_boost: number;
    business_sentiment: number;
    development_velocity: number;
    market_traction: number;
  };
}

interface Tool {
  name: string;
  slug: string;
}

interface Scores {
  overall?: number;
  [key: string]: number | undefined;
}

interface RankingData {
  rank?: number;
  tool?: Tool;
  scores?: Scores;
  rankChange?: number;
}

interface RankingsFile {
  rankings: RankingData[];
  metadata?: {
    [key: string]: unknown;
  };
}

interface RankingItem {
  rank: number;
  tool: string;
  score: number;
  change: number;
}

async function loadCurrentRankings(): Promise<RankingItem[]> {
  try {
    const rankingsPath = path.join(process.cwd(), "public", "data", "rankings.json");
    const data = await fs.readFile(rankingsPath, "utf-8");
    const rankingsData = JSON.parse(data) as RankingsFile;

    // Handle flat rankings array structure
    if (!rankingsData.rankings || !Array.isArray(rankingsData.rankings)) {
      return [];
    }

    const currentRankings = rankingsData.rankings;

    return currentRankings.map((item: RankingData) => ({
      rank: item.rank || 0,
      tool: item.tool?.name || item.tool?.slug || "unknown",
      score: item.scores?.overall || 0,
      change: item.rankChange || 0,
    }));
  } catch (error) {
    console.error("Failed to load current rankings:", error);
    return [];
  }
}

interface ToolImpact {
  tool: string;
  currentScore: number;
  proposedScore: number;
  scoreChange: number;
  currentRank: number;
  proposedRank: number;
  rankChange: number;
  impacts: {
    sentiment: number;
    importance: number;
    innovation: number;
    business: number;
    development: number;
    market: number;
    total: number;
  };
  mentioned: boolean;
  context?: string;
}

function calculateNewRankings(
  current: RankingItem[],
  newsAnalysis: NewsAnalysis
): {
  rankings: RankingItem[];
  toolImpacts: ToolImpact[];
} {
  // Create a copy of current rankings
  const updated = current.map((item) => ({ ...item }));
  const toolImpacts: ToolImpact[] = [];

  // Apply sentiment and importance boosts to mentioned tools
  newsAnalysis.tool_mentions.forEach((mention) => {
    const toolIndex = updated.findIndex(
      (item) => item.tool.toLowerCase() === mention.tool.toLowerCase()
    );

    if (toolIndex !== -1) {
      const currentTool = updated[toolIndex];
      const originalScore = currentTool.score;

      // Calculate boost based on sentiment and importance
      const sentimentBoost = mention.sentiment * newsAnalysis.importance_score * 0.5;
      const importanceBoost = newsAnalysis.importance_score * 0.2;

      // Apply qualitative metrics if available
      let innovationBoost = 0,
        businessBoost = 0,
        developmentBoost = 0,
        marketBoost = 0;
      if (newsAnalysis.qualitative_metrics) {
        const metrics = newsAnalysis.qualitative_metrics;
        innovationBoost = (metrics.innovation_boost || 0) * 0.3;
        businessBoost = (metrics.business_sentiment || 0) * 0.2;
        developmentBoost = (metrics.development_velocity || 0) * 0.2;
        marketBoost = (metrics.market_traction || 0) * 0.3;
      }

      const totalBoost =
        sentimentBoost +
        importanceBoost +
        innovationBoost +
        businessBoost +
        developmentBoost +
        marketBoost;

      // Update score
      updated[toolIndex].score += totalBoost;

      // Track impact for this tool
      toolImpacts.push({
        tool: currentTool.tool,
        currentScore: originalScore,
        proposedScore: updated[toolIndex].score,
        scoreChange: totalBoost,
        currentRank: current.findIndex((c) => c.tool === currentTool.tool) + 1,
        proposedRank: 0, // Will be calculated after re-sorting
        rankChange: 0, // Will be calculated after re-sorting
        impacts: {
          sentiment: sentimentBoost,
          importance: importanceBoost,
          innovation: innovationBoost,
          business: businessBoost,
          development: developmentBoost,
          market: marketBoost,
          total: totalBoost,
        },
        mentioned: true,
        context: (mention as any).context || undefined,
      });
    }
  });

  // Re-sort by score
  updated.sort((a, b) => b.score - a.score);

  // Update ranks and calculate changes
  const proposedRankings = updated.map((item, index) => {
    const oldRank = current.findIndex((c) => c.tool === item.tool) + 1;
    const newRank = index + 1;

    // Update toolImpacts with new rankings
    const impactIndex = toolImpacts.findIndex((ti) => ti.tool === item.tool);
    if (impactIndex !== -1) {
      toolImpacts[impactIndex].proposedRank = newRank;
      toolImpacts[impactIndex].rankChange = oldRank - newRank;
    } else if (oldRank !== newRank) {
      // Tool not mentioned but rank changed due to others moving
      toolImpacts.push({
        tool: item.tool,
        currentScore: item.score,
        proposedScore: item.score,
        scoreChange: 0,
        currentRank: oldRank,
        proposedRank: newRank,
        rankChange: oldRank - newRank,
        impacts: {
          sentiment: 0,
          importance: 0,
          innovation: 0,
          business: 0,
          development: 0,
          market: 0,
          total: 0,
        },
        mentioned: false,
      });
    }

    return {
      ...item,
      rank: newRank,
      change: oldRank - newRank, // Positive means moved up
    };
  });

  // Sort tool impacts by total impact
  toolImpacts.sort((a, b) => Math.abs(b.impacts.total) - Math.abs(a.impacts.total));

  return {
    rankings: proposedRankings,
    toolImpacts,
  };
}

function generateSummary(current: RankingItem[], proposed: RankingItem[]) {
  const majorMovers: Array<{
    tool: string;
    from: number;
    to: number;
    reason: string;
  }> = [];

  let totalChanges = 0;

  proposed.forEach((item) => {
    if (Math.abs(item.change) > 0) {
      totalChanges++;

      // Track major movements (3+ positions)
      if (Math.abs(item.change) >= 3) {
        const currentRank = current.find((c) => c.tool === item.tool)?.rank || 0;
        majorMovers.push({
          tool: item.tool,
          from: currentRank,
          to: item.rank,
          reason: item.change > 0 ? "Positive news impact" : "Relative decline",
        });
      }
    }
  });

  // Sort major movers by magnitude of change
  majorMovers.sort((a, b) => Math.abs(b.to - b.from) - Math.abs(a.to - a.from));

  return {
    total_changes: totalChanges,
    major_movers: majorMovers.slice(0, 5), // Top 5 movers
  };
}

export async function POST(request: NextRequest) {
  try {
    // Check admin authentication
    const { isAdminAuthenticated } = await import("@/lib/admin-auth");
    const isAuthenticated = await isAdminAuthenticated();
    
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const newsAnalysis = body.news_analysis as NewsAnalysis;

    if (!newsAnalysis) {
      return NextResponse.json({ error: "News analysis required" }, { status: 400 });
    }

    // Load current rankings
    const currentRankings = await loadCurrentRankings();

    if (currentRankings.length === 0) {
      return NextResponse.json({ error: "No current rankings found" }, { status: 404 });
    }

    // Calculate proposed rankings
    const { rankings: proposedRankings, toolImpacts } = calculateNewRankings(
      currentRankings,
      newsAnalysis
    );

    // Generate summary
    const summary = generateSummary(currentRankings, proposedRankings);

    return NextResponse.json({
      success: true,
      preview: {
        current: currentRankings.slice(0, 20), // Top 20 for preview
        proposed: proposedRankings.slice(0, 20), // Top 20 for preview
        toolImpacts: toolImpacts.slice(0, 20), // Top 20 affected tools
        summary,
      },
    });
  } catch (error) {
    console.error("Ranking preview error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate preview" },
      { status: 500 }
    );
  }
}
