#!/usr/bin/env tsx

/**
 * Execute July 2025 rankings with Algorithm v7.0
 * Smart defaults and proxy metrics for available data
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { logger } from "../lib/logger";
import { RankingEngineV7, type ToolMetricsV7, type ToolScoreV7 } from "../lib/ranking-algorithm-v7";
import type { NewsArticle } from "../lib/ranking-news-impact";

interface Tool {
  id: string;
  slug: string;
  name: string;
  category: string;
  status?: string;
  company_id: string;
  info?: any;
}

interface RankingEntry {
  tool_id: string;
  tool_name: string;
  rank: number;
  score: number;
  previous_rank?: number;
  movement?: number;
  factor_scores: Record<string, number>;
  sentiment_analysis?: {
    rawSentiment: number;
    adjustedSentiment: number;
    newsImpact: number;
    crisisDetection?: {
      isInCrisis: boolean;
      severityScore: number;
      negativePeriods: number;
      impactMultiplier: number;
    };
  };
  algorithm_version: string;
}

interface RankingPeriod {
  period: string;
  date: string;
  algorithm_version: string;
  algorithm_name: string;
  rankings: RankingEntry[];
  metadata: {
    total_tools: number;
    calculation_date: string;
    notes?: string;
  };
}

// Load data from JSON files
function loadJSONData() {
  // Load tools
  const toolsPath = join(process.cwd(), "data/json/tools/tools.json");
  const toolsData = JSON.parse(readFileSync(toolsPath, "utf-8"));

  // Load news articles
  const newsPath = join(process.cwd(), "data/json/news/news.json");
  const newsData = JSON.parse(readFileSync(newsPath, "utf-8"));

  // Load June rankings for comparison
  const juneRankingsPath = join(process.cwd(), "data/json/rankings/periods/2025-06.json");
  let juneRankings: RankingPeriod | null = null;
  if (existsSync(juneRankingsPath)) {
    juneRankings = JSON.parse(readFileSync(juneRankingsPath, "utf-8"));
  }

  return { tools: toolsData.tools, news: newsData.articles, juneRankings };
}

// Convert tool data to metrics format
function convertToMetrics(tool: Tool): ToolMetricsV7 {
  return {
    tool_id: tool.id,
    name: tool.name,
    category: tool.category,
    status: tool.status,
    info: tool.info,
  };
}

// Main execution
async function main() {
  logger.info("Starting July 2025 rankings calculation with Algorithm v7.0");

  try {
    // Load data
    const { tools, news, juneRankings } = loadJSONData();
    logger.info(`Loaded ${tools.length} tools and ${news.length} news articles`);

    // Calculate velocity scores from news
    logger.info("Calculating velocity scores from news...");
    const velocityScores = new Map<string, number>();

    // Group news by tool
    const newsByTool = new Map<string, NewsArticle[]>();
    for (const article of news as NewsArticle[]) {
      if (article.tools) {
        for (const toolId of article.tools) {
          if (!newsByTool.has(toolId)) {
            newsByTool.set(toolId, []);
          }
          newsByTool.get(toolId)!.push(article);
        }
      }
    }

    // Calculate velocity for each tool
    for (const tool of tools) {
      const toolNews = newsByTool.get(tool.id) || [];
      const recentDate = new Date("2025-07-01");
      recentDate.setDate(recentDate.getDate() - 90); // 3 months

      const recentNews = toolNews.filter((article) => new Date(article.date) >= recentDate);

      let velocity = 10; // Base velocity
      if (recentNews.length >= 5) {
        velocity = 90; // Very high velocity
      } else if (recentNews.length >= 3) {
        velocity = 85; // High velocity
      } else if (recentNews.length >= 2) {
        velocity = 80; // Good velocity
      } else if (recentNews.length >= 1) {
        velocity = 70; // Moderate velocity
      } else {
        velocity = 10; // Low velocity
      }

      velocityScores.set(tool.id, velocity);
      if (velocity >= 80) {
        logger.info(
          `High velocity: ${tool.name} (${velocity}) - ${recentNews.length} recent articles`
        );
      }
    }

    // Initialize ranking engine with velocity scores
    logger.info("Initializing ranking engine...");
    const engine = new RankingEngineV7(velocityScores);
    const algorithmInfo = RankingEngineV7.getAlgorithmInfo();
    logger.info(`Algorithm: ${algorithmInfo.name} (${algorithmInfo.version})`);

    // Calculate scores for all tools
    const scores: Array<{ tool: Tool; score: ToolScoreV7 }> = [];
    const currentDate = new Date("2025-07-01");

    logger.info("Starting tool scoring...");
    for (const tool of tools) {
      if (tool.status === "discontinued") {
        logger.info(`Skipping discontinued tool: ${tool.name}`);
        continue;
      }

      try {
        const metrics = convertToMetrics(tool);
        const score = engine.calculateToolScore(metrics, currentDate, news as NewsArticle[]);
        scores.push({ tool, score });

        // Log high-scoring tools
        if (score.overallScore >= 80) {
          logger.info(`High score: ${tool.name} - ${score.overallScore.toFixed(1)}`);
        }
      } catch (error) {
        logger.error(`Error scoring tool ${tool.name}:`, error);
        // Continue with other tools
      }
    }

    // Sort by score
    scores.sort((a, b) => b.score.overallScore - a.score.overallScore);

    // Create rankings with movement tracking
    const rankings: RankingEntry[] = scores.map((item, index) => {
      const rank = index + 1;
      const previousEntry = juneRankings?.rankings.find((r) => r.tool_id === item.tool.id);
      const previousRank = previousEntry?.rank;

      return {
        tool_id: item.tool.id,
        tool_name: item.tool.name,
        rank,
        score: item.score.overallScore,
        previous_rank: previousRank,
        movement: previousRank ? previousRank - rank : undefined,
        factor_scores: item.score.factorScores,
        sentiment_analysis: item.score.sentimentAnalysis,
        algorithm_version: algorithmInfo.version,
      };
    });

    // Create ranking period object
    const rankingPeriod: RankingPeriod = {
      period: "2025-07",
      date: "2025-07-01",
      algorithm_version: algorithmInfo.version,
      algorithm_name: algorithmInfo.name,
      rankings,
      metadata: {
        total_tools: rankings.length,
        calculation_date: new Date().toISOString(),
        notes: "Smart defaults and proxy metrics for available data",
      },
    };

    // Save rankings
    const outputDir = join(process.cwd(), "data/json/rankings/periods");
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = join(outputDir, "2025-07.json");
    writeFileSync(outputPath, JSON.stringify(rankingPeriod, null, 2));

    logger.info(`Rankings saved to ${outputPath}`);

    // Log summary
    logger.info("\nRankings Summary:");
    logger.info("=================");
    logger.info(`Algorithm: ${algorithmInfo.name} (${algorithmInfo.version})`);
    logger.info(`Total tools ranked: ${rankings.length}`);

    // Log top 10
    logger.info("\nTop 10 Tools:");
    rankings.slice(0, 10).forEach((r) => {
      const movement =
        r.movement !== undefined
          ? r.movement > 0
            ? `↑${r.movement}`
            : r.movement < 0
              ? `↓${Math.abs(r.movement)}`
              : "→"
          : "NEW";
      logger.info(`${r.rank}. ${r.tool_name} (${r.score.toFixed(1)}) ${movement}`);
    });

    // Log score distribution
    const scoreRanges = {
      "90-100": rankings.filter((r) => r.score >= 90).length,
      "80-89": rankings.filter((r) => r.score >= 80 && r.score < 90).length,
      "70-79": rankings.filter((r) => r.score >= 70 && r.score < 80).length,
      "60-69": rankings.filter((r) => r.score >= 60 && r.score < 70).length,
      "50-59": rankings.filter((r) => r.score >= 50 && r.score < 60).length,
      "40-49": rankings.filter((r) => r.score >= 40 && r.score < 50).length,
      "Below 40": rankings.filter((r) => r.score < 40).length,
    };

    logger.info("\nScore Distribution:");
    Object.entries(scoreRanges).forEach(([range, count]) => {
      logger.info(`- ${range}: ${count} tools`);
    });

    // Log biggest movers
    const bigMovers = rankings
      .filter((r) => r.movement && Math.abs(r.movement) >= 3)
      .sort((a, b) => Math.abs(b.movement!) - Math.abs(a.movement!));

    if (bigMovers.length > 0) {
      logger.info("\nBiggest Movers:");
      bigMovers.slice(0, 5).forEach((r) => {
        const direction = r.movement! > 0 ? "up" : "down";
        logger.info(
          `- ${r.tool_name}: ${direction} ${Math.abs(r.movement!)} positions to #${r.rank}`
        );
      });
    }

    // Log category leaders
    const categoryLeaders = new Map<string, (typeof rankings)[0]>();
    rankings.forEach((r) => {
      const tool = scores.find((s) => s.tool.id === r.tool_id)?.tool;
      if (
        tool &&
        (!categoryLeaders.has(tool.category) || categoryLeaders.get(tool.category)!.rank > r.rank)
      ) {
        categoryLeaders.set(tool.category, r);
      }
    });

    logger.info("\nCategory Leaders:");
    Array.from(categoryLeaders.entries())
      .sort((a, b) => a[1].rank - b[1].rank)
      .forEach(([category, leader]) => {
        logger.info(
          `- ${category}: ${leader.tool_name} (#${leader.rank}, ${leader.score.toFixed(1)})`
        );
      });
  } catch (error) {
    logger.error("Error calculating rankings:", error);
    process.exit(1);
  }
}

// Execute
main().catch((error) => {
  logger.error("Unhandled error:", error);
  process.exit(1);
});
