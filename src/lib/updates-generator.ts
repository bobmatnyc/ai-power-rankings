import { getRankingsRepo, getNewsRepo, getToolsRepo } from "@/lib/json-db";
import type { NewsArticle, RankingPeriod, Tool } from "@/lib/json-db/schemas";

export interface UpdatesData {
  lastUpdate: string;
  newArticles: Array<{
    id: string;
    title: string;
    url: string;
    category: string;
    publishedAt: string;
    toolMentions: string[];
  }>;
  topRankings: Array<{
    rank: number;
    toolId: string;
    toolName: string;
    slug: string;
    score: number;
    change: string;
    tier: string;
    changeType?: "up" | "down" | "stable" | "new";
  }>;
  statistics: {
    newArticlesCount: number;
    totalArticles: number;
    toolsWithNews: number;
    totalTools: number;
    maxImpact: {
      toolName: string;
      impact: number;
    };
  };
  majorChanges: Array<{
    toolName: string;
    previousRank: number;
    currentRank: number;
    changeCategory: string;
    explanation: string;
  }>;
}

export class UpdatesGenerator {
  private rankingsRepo = getRankingsRepo();
  private newsRepo = getNewsRepo();
  private toolsRepo = getToolsRepo();

  async generateUpdates(): Promise<UpdatesData> {
    // Get the two most recent ranking periods
    const allPeriods = await this.rankingsRepo.getPeriods();
    const sortedPeriods = allPeriods.sort((a: string, b: string) => b.localeCompare(a));

    if (sortedPeriods.length === 0) {
      throw new Error("No ranking periods found");
    }

    const currentPeriod = sortedPeriods[0]; // We already checked length > 0
    if (!currentPeriod) {
      throw new Error("No current period found");
    }
    const previousPeriod = sortedPeriods.length > 1 ? sortedPeriods[1] : null;

    const currentRanking = await this.rankingsRepo.getByPeriod(currentPeriod);
    const previousRanking = previousPeriod
      ? await this.rankingsRepo.getByPeriod(previousPeriod)
      : null;

    if (!currentRanking) {
      throw new Error("No current ranking found");
    }

    // Get all news articles
    const allNews = await this.newsRepo.getAll();

    // Filter news articles published since the previous ranking
    const cutoffDate = previousRanking
      ? new Date(previousRanking.created_at)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const newArticles = allNews
      .filter((article) => new Date(article.published_date) > cutoffDate)
      .sort((a, b) => new Date(b.published_date).getTime() - new Date(a.published_date).getTime());

    // Get all tools
    const allTools = await this.toolsRepo.getAll();
    const toolsMap = new Map(allTools.map((tool) => [tool.id, tool]));

    // Build top rankings with changes
    const topRankings = await this.buildTopRankings(currentRanking, previousRanking, toolsMap);

    // Calculate statistics
    const statistics = await this.calculateStatistics(
      newArticles,
      allNews,
      currentRanking,
      toolsMap
    );

    // Analyze major changes
    const majorChanges = await this.analyzeMajorChanges(currentRanking, previousRanking, toolsMap);

    return {
      lastUpdate: currentRanking.created_at,
      newArticles: newArticles.slice(0, 5).map((article) => ({
        id: article.id,
        title: article.title,
        url: article.source_url || "",
        category: "update", // Could be enhanced by analyzing tags or content
        publishedAt: article.published_date,
        toolMentions: (article.tool_mentions || []).map((toolId) => {
          const tool = toolsMap.get(toolId);
          return tool?.name || toolId;
        }),
      })),
      topRankings,
      statistics,
      majorChanges,
    };
  }

  private async buildTopRankings(
    currentRanking: RankingPeriod,
    previousRanking: RankingPeriod | null,
    toolsMap: Map<string, Tool>
  ): Promise<UpdatesData["topRankings"]> {
    const previousPositions = new Map(
      previousRanking?.rankings.map((r) => [r.tool_id, r.position]) || []
    );

    return currentRanking.rankings.slice(0, 10).map((ranking) => {
      const tool = toolsMap.get(ranking.tool_id);
      const previousPosition = previousPositions.get(ranking.tool_id);

      let change = "—";
      let changeType: "up" | "down" | "stable" | "new" = "stable";

      if (previousPosition === undefined) {
        change = "NEW";
        changeType = "new";
      } else if (previousPosition > ranking.position) {
        change = `↑${previousPosition - ranking.position}`;
        changeType = "up";
      } else if (previousPosition < ranking.position) {
        change = `↓${ranking.position - previousPosition}`;
        changeType = "down";
      }

      return {
        rank: ranking.position,
        toolId: ranking.tool_id,
        toolName: tool?.name || ranking.tool_name,
        slug: tool?.slug || ranking.tool_id,
        score: ranking.score,
        change,
        tier: ranking.tier || "A",
        changeType,
      };
    });
  }

  private async calculateStatistics(
    newArticles: NewsArticle[],
    allNews: NewsArticle[],
    currentRanking: RankingPeriod,
    toolsMap: Map<string, Tool>
  ): Promise<UpdatesData["statistics"]> {
    // Count tools with news mentions
    const toolsWithNews = new Set<string>();
    allNews.forEach((article) => {
      (article.tool_mentions || []).forEach((toolId) => {
        toolsWithNews.add(toolId);
      });
    });

    // Find max impact (for now, use highest score)
    let maxImpact = { toolName: "", impact: 0 };
    currentRanking.rankings.forEach((ranking) => {
      if (ranking.score > maxImpact.impact) {
        const tool = toolsMap.get(ranking.tool_id);
        maxImpact = {
          toolName: tool?.name || ranking.tool_name,
          impact: ranking.score,
        };
      }
    });

    return {
      newArticlesCount: newArticles.length,
      totalArticles: allNews.length,
      toolsWithNews: toolsWithNews.size,
      totalTools: toolsMap.size,
      maxImpact,
    };
  }

  private async analyzeMajorChanges(
    currentRanking: RankingPeriod,
    previousRanking: RankingPeriod | null,
    toolsMap: Map<string, Tool>
  ): Promise<UpdatesData["majorChanges"]> {
    if (!previousRanking) {
      return [];
    }

    const previousPositions = new Map(
      previousRanking.rankings.map((r) => [r.tool_id, { position: r.position, score: r.score }])
    );

    const majorChanges: UpdatesData["majorChanges"] = [];

    // Analyze each tool in current ranking
    currentRanking.rankings.forEach((ranking) => {
      const previous = previousPositions.get(ranking.tool_id);
      const tool = toolsMap.get(ranking.tool_id);

      if (!tool) {
        return;
      }

      // New entries in top 20
      if (!previous && ranking.position <= 20) {
        majorChanges.push({
          toolName: tool.name,
          previousRank: 999,
          currentRank: ranking.position,
          changeCategory: "new_entry",
          explanation: `${tool.name} enters the rankings at position ${ranking.position} with a score of ${ranking.score.toFixed(1)}.`,
        });
      } else if (previous) {
        // Major movements (5+ positions)
        const rankChange = previous.position - ranking.position;

        if (Math.abs(rankChange) >= 5) {
          const changeCategory = rankChange > 0 ? "major_rise" : "major_decline";
          const direction = rankChange > 0 ? "climbs" : "drops";
          const positions = Math.abs(rankChange);

          majorChanges.push({
            toolName: tool.name,
            previousRank: previous.position,
            currentRank: ranking.position,
            changeCategory,
            explanation: `${tool.name} ${direction} ${positions} positions from #${previous.position} to #${ranking.position}${
              ranking.change_analysis?.primary_reason
                ? ` due to ${ranking.change_analysis.primary_reason.toLowerCase()}`
                : ""
            }.`,
          });
        }
      }
    });

    // Sort by magnitude of change
    return majorChanges
      .sort((a, b) => {
        const aChange = Math.abs(a.previousRank - a.currentRank);
        const bChange = Math.abs(b.previousRank - b.currentRank);
        return bChange - aChange;
      })
      .slice(0, 5); // Top 5 major changes
  }
}
