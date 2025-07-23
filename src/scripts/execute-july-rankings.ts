#!/usr/bin/env tsx

/**
 * Execute July 2025 Rankings Calculation
 *
 * This script runs the ranking algorithm v6.0 to generate new rankings for July 2025,
 * incorporating:
 * - Updated tool metrics including news mentions
 * - New Kiro tool (ID: 28)
 * - Recent news sentiment and importance scores
 * - 27 news items including Amazon Kiro launch
 *
 * The script:
 * 1. Loads all active tools from tools.json
 * 2. Extracts enhanced metrics from news articles
 * 3. Calculates scores using RankingEngineV6
 * 4. Compares with June 2025 rankings for movement tracking
 * 5. Saves results to rankings JSON files
 */

import path from "node:path";
import fs from "fs-extra";
import { getNewsRepo, getRankingsRepo, getToolsRepo } from "@/lib/json-db";
import type { RankingEntry, Tool } from "@/lib/json-db/schemas";
import { RankingEngineV6, type ToolMetricsV6, type ToolScoreV6 } from "@/lib/ranking-algorithm-v6";
import { RankingChangeAnalyzer } from "@/lib/ranking-change-analyzer";
import {
  applyEnhancedNewsMetrics,
  applyNewsImpactToScores,
  extractEnhancedNewsMetrics,
} from "@/lib/ranking-news-enhancer";

interface InnovationScore {
  tool_id: string;
  score: number;
  updated_at: string;
}

function getCategoryBasedAgenticScore(category: string, toolName: string): number {
  const premiumAgents = ["Devin", "Claude Code", "Google Jules"];
  if (premiumAgents.includes(toolName)) {
    return 8.5;
  }

  const categoryScores: Record<string, number> = {
    "autonomous-agent": 8,
    "ide-assistant": 6,
    "code-assistant": 5,
    "app-builder": 4,
    "research-tool": 3,
    "general-assistant": 2,
  };

  return categoryScores[category] || 5;
}

function transformToToolMetrics(tool: Tool, innovationScore?: number): ToolMetricsV6 {
  const info = tool.info;
  const technical = info?.technical || {};
  const businessMetrics = info?.metrics || {};
  const business = info?.business || {};

  const isAutonomous = tool.category === "autonomous-agent";
  const isOpenSource = tool.category === "open-source-framework";
  const isEnterprise = business.pricing_model === "enterprise";
  const isPremium = ["Devin", "Claude Code", "Google Jules", "Cursor"].includes(tool.name);

  return {
    tool_id: tool.id,
    status: tool.status,
    agentic_capability: getCategoryBasedAgenticScore(tool.category, tool.name),
    swe_bench_score: businessMetrics.swe_bench_score || (isPremium ? 45 : isAutonomous ? 35 : 20),
    multi_file_capability: isAutonomous ? 9 : technical.multi_file_support ? 7 : 4,
    planning_depth: isAutonomous ? 8.5 : 6,
    context_utilization: isPremium ? 8 : 6.5,
    context_window: technical.context_window || (isPremium ? 200000 : 100000),
    language_support: technical.languages?.length || (isEnterprise ? 20 : 15),
    github_stars: businessMetrics.github_stars || (isOpenSource ? 25000 : 5000),
    innovation_score: innovationScore || (isPremium ? 8.5 : 6.5),
    innovations: [],
    estimated_users:
      businessMetrics.estimated_users || (isPremium ? 500000 : isOpenSource ? 100000 : 50000),
    monthly_arr:
      businessMetrics.monthly_arr || (isEnterprise ? 10000000 : isPremium ? 5000000 : 1000000),
    valuation: businessMetrics.valuation || (isPremium ? 1000000000 : 100000000),
    funding: businessMetrics.funding_total || (isPremium ? 100000000 : 10000000),
    business_model: business.business_model || "saas",
    business_sentiment: isPremium ? 0.8 : 0.7,
    risk_factors: [],
    release_frequency: isOpenSource ? 7 : 14,
    github_contributors: businessMetrics.github_contributors || (isOpenSource ? 200 : 50),
    llm_provider_count: isPremium ? 5 : 3,
    multi_model_support: isPremium || isOpenSource,
    community_size: businessMetrics.estimated_users || (isOpenSource ? 50000 : 10000),
  };
}

function calculateTier(position: number): "S" | "A" | "B" | "C" | "D" {
  if (position <= 5) return "S";
  if (position <= 15) return "A";
  if (position <= 25) return "B";
  if (position <= 35) return "C";
  return "D";
}

async function executeJulyRankings() {
  try {
    console.log("🚀 Starting July 2025 rankings calculation...\n");

    const toolsRepo = getToolsRepo();
    const rankingsRepo = getRankingsRepo();
    const newsRepo = getNewsRepo();

    // Load all active tools
    const allTools = await toolsRepo.getAll();
    const activeTools = allTools.filter((tool) => tool.status === "active");
    console.log(`📊 Found ${activeTools.length} active tools to rank`);

    // Find Kiro in the tools
    const kiro = activeTools.find((tool) => tool.id === "28");
    if (kiro) {
      console.log(`✅ Kiro found: ${kiro.name} (ID: ${kiro.id})`);
    } else {
      console.log("⚠️  Warning: Kiro (ID: 28) not found in active tools");
    }

    // Load innovation scores
    const innovationScoresPath = path.join(process.cwd(), "data", "json", "innovation-scores.json");
    let innovationScores: InnovationScore[] = [];
    try {
      if (await fs.pathExists(innovationScoresPath)) {
        innovationScores = await fs.readJson(innovationScoresPath);
        console.log(`📈 Loaded ${innovationScores.length} innovation scores`);
      }
    } catch (error) {
      console.warn("⚠️  Failed to load innovation scores:", error);
    }
    const innovationMap = new Map(innovationScores.map((s) => [s.tool_id, s]));

    // Load news articles
    const newsArticles = await newsRepo.getAll();
    console.log(`📰 Found ${newsArticles.length} news articles for metrics extraction`);

    // Count news mentions for Kiro
    const kiroNews = newsArticles.filter(
      (article) =>
        article.content?.toLowerCase().includes("kiro") ||
        article.title?.toLowerCase().includes("kiro")
    );
    console.log(`📰 Kiro mentioned in ${kiroNews.length} news articles`);

    // Initialize ranking engine
    const rankingEngine = new RankingEngineV6();
    const changeAnalyzer = new RankingChangeAnalyzer();
    const toolScores: ToolScoreV6[] = [];

    console.log("\n🔄 Calculating scores for each tool...");

    // Calculate scores for each tool
    for (const tool of activeTools) {
      try {
        // Get innovation score
        const innovationData = innovationMap.get(tool.id);
        const innovationScore = innovationData?.score || 0;

        // Extract enhanced metrics from news
        const enhancedMetrics = await extractEnhancedNewsMetrics(
          tool.id,
          tool.name,
          newsArticles,
          "2025-07-22", // Current date
          false // Disable AI analysis for faster execution
        );

        // Log Kiro's metrics
        if (tool.id === "28") {
          console.log("\n🎯 Kiro metrics:", {
            articlesProcessed: enhancedMetrics.articlesProcessed,
            innovationBoost: enhancedMetrics.innovationBoost,
            businessSentiment: enhancedMetrics.businessSentimentAdjust,
            significantEvents: enhancedMetrics.significantEvents,
          });
        }

        // Transform tool data to metrics format
        let toolMetrics = transformToToolMetrics(tool, innovationScore);

        // Apply enhanced news metrics
        toolMetrics = applyEnhancedNewsMetrics(toolMetrics, enhancedMetrics);

        // Calculate score using v6 algorithm
        const score = rankingEngine.calculateToolScore(toolMetrics, new Date("2025-07-22"));

        // Apply additional news impact
        const adjustedFactorScores = applyNewsImpactToScores(score.factorScores, enhancedMetrics);
        score.factorScores = {
          ...score.factorScores,
          technicalPerformance:
            adjustedFactorScores.technicalPerformance || score.factorScores.technicalPerformance,
          marketTraction: adjustedFactorScores.marketTraction || score.factorScores.marketTraction,
        };

        // Recalculate overall score
        const weights = RankingEngineV6.getAlgorithmInfo().weights;
        score.overallScore = Object.entries(weights).reduce((total, [factor, weight]) => {
          const factorScore =
            score.factorScores[factor as keyof (typeof score)["factorScores"]] || 0;
          return total + factorScore * weight;
        }, 0);
        score.overallScore = Math.max(
          0,
          Math.min(10, Math.round(score.overallScore * 1000) / 1000)
        );

        toolScores.push(score);
      } catch (error) {
        console.error(`❌ Error calculating score for ${tool.name}:`, error);
      }
    }

    // Sort by overall score descending
    toolScores.sort((a, b) => b.overallScore - a.overallScore);

    // Get June 2025 rankings for comparison
    const junePeriod = await rankingsRepo.getRankingsForPeriod("2025-06");
    const previousRankingsMap = new Map(
      junePeriod?.rankings.map((r: RankingEntry) => [r.tool_id, r.position]) || []
    );

    console.log("\n📊 Top 10 July 2025 Rankings:");
    console.log("════════════════════════════════");

    // Create ranking entries
    const rankings: RankingEntry[] = [];
    const changeAnalyses = [];

    for (let i = 0; i < toolScores.length; i++) {
      const toolScore = toolScores[i];
      const tool = activeTools.find((t) => t.id === toolScore?.toolId);

      if (!tool || !toolScore) continue;

      const position = i + 1;
      const previousPosition = previousRankingsMap.get(tool.id);
      const previousRanking = previousPosition
        ? junePeriod?.rankings.find((r: RankingEntry) => r.tool_id === tool.id)
        : null;

      let movement;
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

      // Log top 10 and Kiro
      if (position <= 10 || tool.id === "28") {
        const arrow =
          movement.direction === "up"
            ? "↑"
            : movement.direction === "down"
              ? "↓"
              : movement.direction === "new"
                ? "🆕"
                : "→";
        const changeStr = movement.change > 0 ? `${arrow} ${movement.change}` : arrow;
        console.log(
          `#${position.toString().padStart(2)} ${tool.name.padEnd(20)} Score: ${(toolScore.overallScore * 10).toFixed(1).padStart(4)} ${changeStr}`
        );
      }

      // Generate change analysis
      const changeAnalysis = changeAnalyzer.analyzeRankingChange(
        {
          tool_id: tool.id,
          tool_name: tool.name,
          position,
          score: toolScore.overallScore,
          new_position: position,
          new_score: toolScore.overallScore,
        },
        previousRanking
          ? {
              tool_id: tool.id,
              tool_name: tool.name,
              position: previousPosition!,
              score: previousRanking.score,
              current_position: previousPosition!,
              current_score: previousRanking.score,
            }
          : null,
        toolScore.factorScores,
        previousRanking?.factor_scores
          ? {
              agenticCapability: previousRanking.factor_scores.agentic_capability || 0,
              innovation: previousRanking.factor_scores.innovation || 0,
              technicalPerformance: previousRanking.factor_scores.technical_performance || 0,
              developerAdoption: previousRanking.factor_scores.developer_adoption || 0,
              marketTraction: previousRanking.factor_scores.market_traction || 0,
              businessSentiment: previousRanking.factor_scores.business_sentiment || 0,
              developmentVelocity: previousRanking.factor_scores.development_velocity || 0,
              platformResilience: previousRanking.factor_scores.platform_resilience || 0,
            }
          : undefined
      );

      changeAnalyses.push(changeAnalysis);

      rankings.push({
        tool_id: tool.id,
        tool_name: tool.name,
        position,
        score: toolScore.overallScore * 10, // Convert to 0-100 scale
        tier: calculateTier(position),
        factor_scores: {
          agentic_capability: toolScore.factorScores.agenticCapability || 0,
          innovation: toolScore.factorScores.innovation || 0,
          technical_performance: toolScore.factorScores.technicalPerformance || 0,
          developer_adoption: toolScore.factorScores.developerAdoption || 0,
          market_traction: toolScore.factorScores.marketTraction || 0,
          business_sentiment: toolScore.factorScores.businessSentiment || 0,
          development_velocity: toolScore.factorScores.developmentVelocity || 0,
          platform_resilience: toolScore.factorScores.platformResilience || 0,
        },
        movement,
        change_analysis:
          (changeAnalysis.rankChange && Math.abs(changeAnalysis.rankChange) >= 3) ||
          (changeAnalysis.primaryReason && changeAnalysis.primaryReason !== "No significant change")
            ? {
                primary_reason: changeAnalysis.primaryReason,
                narrative_explanation: changeAnalysis.narrativeExplanation,
              }
            : undefined,
      });
    }

    // Save the rankings
    const period = "2025-07";
    await rankingsRepo.saveRankingsForPeriod({
      period,
      algorithm_version: "v6.0",
      is_current: true, // Make it current
      created_at: new Date().toISOString(),
      rankings,
    });

    // Generate change report
    const changeReport = changeAnalyzer.generateChangeReport(changeAnalyses);

    console.log("\n📊 Summary Statistics:");
    console.log("══════════════════════");
    console.log(`Total tools ranked: ${rankings.length}`);
    console.log(
      `Average score: ${(rankings.reduce((sum, r) => sum + r.score, 0) / rankings.length).toFixed(1)}`
    );
    console.log(`Highest score: ${Math.max(...rankings.map((r) => r.score)).toFixed(1)}`);
    console.log(`Lowest score: ${Math.min(...rankings.map((r) => r.score)).toFixed(1)}`);
    console.log(`New entries: ${rankings.filter((r) => r.movement?.direction === "new").length}`);
    console.log(`Tools moved up: ${rankings.filter((r) => r.movement?.direction === "up").length}`);
    console.log(
      `Tools moved down: ${rankings.filter((r) => r.movement?.direction === "down").length}`
    );

    console.log("\n🎯 Major Movements:");
    console.log("══════════════════");
    const majorMovers = changeAnalyses
      .filter((c) => c.rankChange && Math.abs(c.rankChange) >= 3)
      .sort((a, b) => Math.abs(b.rankChange || 0) - Math.abs(a.rankChange || 0))
      .slice(0, 5);

    majorMovers.forEach((mover) => {
      const direction = (mover.rankChange || 0) > 0 ? "↑" : "↓";
      console.log(`${mover.toolName}: ${direction} ${Math.abs(mover.rankChange || 0)} positions`);
      console.log(`  Reason: ${mover.primaryReason}`);
    });

    console.log("\n✅ July 2025 rankings calculated and saved successfully!");
    console.log("📁 Rankings saved to: data/json/rankings/2025-07.json");
  } catch (error) {
    console.error("❌ Error executing rankings:", error);
    throw error;
  }
}

// Execute the script
executeJulyRankings()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
