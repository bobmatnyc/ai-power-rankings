#!/usr/bin/env tsx

/**
 * Generate static rankings data for client-side consumption
 * This pre-generates the data that was previously computed at runtime
 */

import path from "node:path";
import fs from "fs-extra";
import { getNewsRepo, getRankingsRepo, getToolsRepo } from "../src/lib/json-db";

interface RankingData {
  rank: number;
  previousRank?: number;
  rankChange?: number;
  changeReason?: string;
  tool: {
    id: string;
    slug?: string;
    name: string;
    category: string;
    status: string;
    website_url?: string;
    description?: string;
  };
  scores: {
    overall: number;
    agentic_capability: number;
    innovation: number;
  };
  metrics: {
    users?: number;
    monthly_arr?: number;
    swe_bench_score?: number;
  };
  tier: string;
}

async function generateStaticRankings() {
  try {
    console.log("🚀 Generating static rankings data...");

    const rankingsRepo = getRankingsRepo();
    const toolsRepo = getToolsRepo();
    const newsRepo = getNewsRepo();

    // Force rebuild indices to ensure complete data
    // await toolsRepo.forceRebuildIndices(); // Method doesn't exist

    // Get tools using the repository (now fixed to return complete data)
    const allTools = await toolsRepo.getAll();
    const toolsMap = new Map();
    const toolSlugToIdMap = new Map();
    allTools.forEach((tool) => {
      toolsMap.set(tool.id, tool);
      toolSlugToIdMap.set(tool.slug, tool.id);
    });

    // Get all news articles to count mentions
    const allNews = await newsRepo.getAll();
    const newsCountByTool = new Map<string, number>();

    // Count news mentions for each tool
    allNews.forEach((article) => {
      const mentions = article.tool_mentions || [];
      mentions.forEach((mention: string) => {
        // Convert slug to ID if necessary
        const toolId = toolSlugToIdMap.get(mention) || mention;
        newsCountByTool.set(toolId, (newsCountByTool.get(toolId) || 0) + 1);
      });
    });

    // Get current rankings
    const currentRankings = await rankingsRepo.getCurrentRankings();

    if (!currentRankings) {
      throw new Error("No current rankings available");
    }

    console.log(`📊 Processing ${currentRankings.rankings.length} tools...`);

    // Transform to expected format with tool details
    const formattedRankings = await Promise.all(
      currentRankings.rankings.map(async (ranking) => {
        const tool = toolsMap.get(ranking.tool_id);

        if (!tool) {
          console.warn(`⚠️  Tool not found: ${ranking.tool_id}`);
          return null;
        }

        // Extract actual SWE-bench score from tool data
        const swe_bench_data = tool.info?.metrics?.swe_bench;
        const swe_bench_score =
          swe_bench_data?.verified ||
          swe_bench_data?.verified_basic ||
          swe_bench_data?.lite ||
          swe_bench_data?.full ||
          null;

        const result: RankingData = {
          rank: ranking.position,
          previousRank: ranking.movement?.previous_position || null,
          rankChange: ranking.movement?.previous_position
            ? ranking.movement.direction === "up"
              ? ranking.movement.change
              : ranking.movement.direction === "down"
                ? -ranking.movement.change
                : 0
            : 0,
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
          scores: {
            overall: ranking.score,
            agentic_capability: ranking.factor_scores?.agentic_capability / 10 || 5,
            innovation: ranking.factor_scores?.innovation / 10 || 5,
          },
          metrics: {
            news_articles_count: newsCountByTool.get(tool.id) || 0,
            recent_funding_rounds: 0,
            recent_product_launches: 0,
            users: ranking.factor_scores?.developer_adoption * 1000 || 10000,
            swe_bench_score: swe_bench_score,
          },
          tier: ranking.tier,
        };

        return result;
      })
    );

    // Filter out null values
    const validRankings = formattedRankings.filter(Boolean) as RankingData[];

    // Calculate stats
    const toolsWithNews = validRankings.filter((r) => r.metrics.news_articles_count > 0).length;
    const totalNewsArticles = validRankings.reduce(
      (sum, r) => sum + r.metrics.news_articles_count,
      0
    );
    const avgNewsPerTool = toolsWithNews > 0 ? totalNewsArticles / toolsWithNews : 0;

    const staticData = {
      rankings: validRankings,
      algorithm: {
        version: currentRankings.algorithm_version,
        name: "JSON-Based Rankings",
        date: currentRankings.created_at,
        weights: { newsImpact: 0.3, baseScore: 0.7 },
      },
      stats: {
        total_tools: validRankings.length,
        tools_with_news: toolsWithNews,
        avg_news_boost: avgNewsPerTool,
        max_news_impact: Math.max(...validRankings.map((r) => r.metrics.news_articles_count)),
      },
      _source: "static-generation",
      _timestamp: new Date().toISOString(),
    };

    // Ensure cache directory exists
    const cacheDir = path.join(process.cwd(), "src", "data", "cache");
    await fs.ensureDir(cacheDir);

    // Write static rankings data
    const outputPath = path.join(cacheDir, "rankings-static.json");
    await fs.writeJSON(outputPath, staticData, { spaces: 2 });

    console.log(`✅ Generated static rankings data: ${outputPath}`);
    console.log(`📈 Tools processed: ${validRankings.length}`);
    console.log("🏆 Top 3 tools:");
    validRankings.slice(0, 3).forEach((tool, i) => {
      console.log(`   ${i + 1}. ${tool.tool.name} (${tool.scores.overall.toFixed(1)})`);
    });

    // Also generate for Next.js public directory for direct access
    const publicPath = path.join(process.cwd(), "public", "data", "rankings.json");
    await fs.ensureDir(path.dirname(publicPath));
    await fs.writeJSON(publicPath, staticData, { spaces: 2 });
    console.log(`📁 Also saved to public: ${publicPath}`);
  } catch (error) {
    console.error("❌ Failed to generate static rankings:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  generateStaticRankings();
}

export { generateStaticRankings };
