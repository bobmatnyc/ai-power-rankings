/**
 * Recalculate Rankings with Productivity Paradox Adjustments
 *
 * This script applies the METR productivity research findings to recalculate
 * tool rankings, incorporating the cognitive bias and actual productivity impacts.
 */

import fs from "node:fs";
import path from "node:path";
import { logger } from "../src/lib/logger";
import { RankingEngineV6, type ToolMetricsV6 } from "../src/lib/ranking-algorithm-v6";

interface ToolData {
  id: string;
  name: string;
  slug: string;
  status: string;
  category: string;
  info?: {
    metrics?: any;
    business?: any;
  };
}

interface ProductivityAdjustment {
  toolId: string;
  businessSentimentDecrease: number;
  marketImpact: number;
  reasoning: string;
}

// Load productivity paradox adjustments
const PRODUCTIVITY_ADJUSTMENTS: Record<string, ProductivityAdjustment> = {
  "1": {
    // Cursor
    toolId: "1",
    businessSentimentDecrease: 0.13,
    marketImpact: 0.15,
    reasoning: "Third-place tool moderately impacted by productivity research",
  },
  "2": {
    // GitHub Copilot
    toolId: "2",
    businessSentimentDecrease: 0.36,
    marketImpact: 0.42,
    reasoning: "Market leader heavily impacted by productivity paradox research",
  },
  "26": {
    // Amazon Q
    toolId: "26",
    businessSentimentDecrease: 0.13,
    marketImpact: 0.15,
    reasoning: "Third-place tool moderately impacted by productivity research",
  },
  "27": {
    // Gemini Code Assist
    toolId: "27",
    businessSentimentDecrease: 0.24,
    marketImpact: 0.28,
    reasoning: "Second-place tool significantly affected by research findings",
  },
};

/**
 * Convert tool data to ToolMetricsV6 format
 */
function convertToToolMetrics(tool: ToolData): ToolMetricsV6 {
  const metrics: ToolMetricsV6 = {
    tool_id: tool.id,
    status: tool.status,
  };

  // Extract metrics from tool info
  if (tool.info?.metrics) {
    const toolMetrics = tool.info.metrics;

    // SWE-bench scores
    if (toolMetrics.swe_bench) {
      metrics.swe_bench_score =
        toolMetrics.swe_bench.verified || toolMetrics.swe_bench.full || toolMetrics.swe_bench.lite;
    }
  }

  // Add some default/estimated values for core metrics
  // These would normally come from the metrics system
  const defaultMetrics: Partial<ToolMetricsV6> = {
    agentic_capability: getDefaultAgenticCapability(tool.category),
    innovation_score: getDefaultInnovationScore(tool.id),
    business_sentiment: getDefaultBusinessSentiment(tool.id),
    estimated_users: getDefaultUserEstimate(tool.id),
    monthly_arr: getDefaultARR(tool.id),
    github_stars: getDefaultGitHubStars(tool.id),
    release_frequency: 2, // Default quarterly releases
    risk_factors: [],
  };

  return { ...defaultMetrics, ...metrics };
}

/**
 * Get default agentic capability based on category
 */
function getDefaultAgenticCapability(category: string): number {
  switch (category) {
    case "autonomous-agent":
      return 8.5;
    case "code-editor":
      return 7.0;
    case "ide-assistant":
      return 6.0;
    case "devops-assistant":
      return 5.5;
    case "open-source-framework":
      return 5.0;
    default:
      return 5.0;
  }
}

/**
 * Get default innovation score based on tool ID
 */
function getDefaultInnovationScore(toolId: string): number {
  const innovationScores: Record<string, number> = {
    "4": 9.0, // Claude Code
    "11": 8.5, // Google Jules
    "1": 8.0, // Cursor
    "2": 7.0, // GitHub Copilot
    "27": 7.5, // Gemini Code Assist
    "26": 6.5, // Amazon Q
  };

  return innovationScores[toolId] || 6.0;
}

/**
 * Get default business sentiment (before productivity adjustments)
 */
function getDefaultBusinessSentiment(toolId: string): number {
  const sentimentScores: Record<string, number> = {
    "4": 1.0, // Claude Code - very positive
    "11": 0.9, // Google Jules
    "1": 0.85, // Cursor
    "2": 0.8, // GitHub Copilot
    "27": 0.75, // Gemini Code Assist
    "26": 0.7, // Amazon Q
  };

  return sentimentScores[toolId] || 0.6;
}

/**
 * Get default user estimates
 */
function getDefaultUserEstimate(toolId: string): number {
  const userEstimates: Record<string, number> = {
    "2": 15000000, // GitHub Copilot - 15M users
    "1": 360000, // Cursor - 360K paying users
    "27": 800000, // Gemini Code Assist estimate
    "26": 500000, // Amazon Q estimate
    "4": 100000, // Claude Code estimate
    "11": 50000, // Google Jules beta
  };

  return userEstimates[toolId] || 10000;
}

/**
 * Get default ARR estimates
 */
function getDefaultARR(toolId: string): number {
  const arrEstimates: Record<string, number> = {
    "1": 500000000, // Cursor - $500M ARR
    "2": 400000000, // GitHub Copilot - $400M ARR
    "27": 100000000, // Gemini Code Assist estimate
    "26": 80000000, // Amazon Q estimate
    "4": 50000000, // Claude Code estimate
    "11": 20000000, // Google Jules estimate
  };

  return arrEstimates[toolId] || 1000000;
}

/**
 * Get default GitHub stars
 */
function getDefaultGitHubStars(toolId: string): number {
  const starCounts: Record<string, number> = {
    "7": 20000, // Aider
    "13": 40000, // OpenHands
    "8": 47000, // Zed
  };

  return starCounts[toolId] || 1000;
}

/**
 * Apply productivity paradox adjustments to metrics
 */
function applyProductivityAdjustments(metrics: ToolMetricsV6): ToolMetricsV6 {
  const adjustment = PRODUCTIVITY_ADJUSTMENTS[metrics.tool_id];
  if (!adjustment) {
    return metrics;
  }

  const adjusted = { ...metrics };

  // Apply business sentiment decrease
  if (adjusted.business_sentiment !== undefined) {
    adjusted.business_sentiment = Math.max(
      0.1,
      adjusted.business_sentiment - adjustment.businessSentimentDecrease
    );
  }

  // Add productivity paradox risk factor
  if (!adjusted.risk_factors) {
    adjusted.risk_factors = [];
  }
  if (!adjusted.risk_factors.includes("productivity_paradox_research")) {
    adjusted.risk_factors.push("productivity_paradox_research");
  }

  logger.info(`Applied productivity adjustments to ${metrics.tool_id}`, {
    originalSentiment: metrics.business_sentiment,
    adjustedSentiment: adjusted.business_sentiment,
    adjustment: adjustment.businessSentimentDecrease,
    reasoning: adjustment.reasoning,
  });

  return adjusted;
}

/**
 * Main function to recalculate rankings
 */
async function recalculateRankingsWithProductivityAdjustments(): Promise<void> {
  logger.info("Starting ranking recalculation with productivity paradox adjustments");

  const dataDir = path.join(process.cwd(), "data");
  const toolsPath = path.join(dataDir, "json", "tools", "tools.json");
  const rankingsDir = path.join(dataDir, "json", "rankings", "periods");

  // Load tools data
  const toolsData = JSON.parse(fs.readFileSync(toolsPath, "utf-8"));
  const tools: ToolData[] = toolsData.tools;

  logger.info(`Loaded ${tools.length} tools for ranking calculation`);

  // Initialize ranking engine
  const rankingEngine = new RankingEngineV6();
  const currentDate = new Date("2025-07-14"); // Use the research date

  // Calculate scores for all tools
  const toolScores: Array<{
    toolId: string;
    toolName: string;
    score: number;
    factorScores: any;
    modifiers: any;
    validation: any;
  }> = [];

  for (const tool of tools) {
    if (tool.status !== "active") {
      continue; // Skip inactive tools
    }

    // Convert to metrics format
    let metrics = convertToToolMetrics(tool);

    // Apply productivity paradox adjustments if applicable
    metrics = applyProductivityAdjustments(metrics);

    // Calculate score
    const score = rankingEngine.calculateToolScore(metrics, currentDate);

    toolScores.push({
      toolId: tool.id,
      toolName: tool.name,
      score: score.overallScore,
      factorScores: score.factorScores,
      modifiers: score.modifiers,
      validation: score.validationStatus,
    });

    logger.info(`Calculated score for ${tool.name}`, {
      toolId: tool.id,
      score: score.overallScore,
      validation: score.validationStatus.isValid,
      productivityAdjusted: !!PRODUCTIVITY_ADJUSTMENTS[tool.id],
    });
  }

  // Sort by score
  toolScores.sort((a, b) => b.score - a.score);

  // Generate tier assignments
  function getTier(score: number): "S" | "A" | "B" | "C" | "D" {
    if (score >= 75) return "S";
    if (score >= 65) return "A";
    if (score >= 55) return "B";
    if (score >= 45) return "C";
    return "D";
  }

  // Build ranking period structure
  const newRankingPeriod = {
    period: "2025-07-14",
    algorithm_version: "v6.0-productivity-adjusted",
    is_current: false,
    created_at: new Date().toISOString(),
    metadata: {
      research_applied: "METR productivity paradox study",
      adjustments_applied: Object.keys(PRODUCTIVITY_ADJUSTMENTS).length,
      calculation_date: currentDate.toISOString(),
    },
    rankings: toolScores.map((score, index) => ({
      tool_id: score.toolId,
      tool_name: score.toolName,
      position: index + 1,
      score: Math.round(score.score * 100) / 100,
      tier: getTier(score.score),
      factor_scores: {
        agentic_capability: score.factorScores.agenticCapability,
        innovation: score.factorScores.innovation,
        technical_performance: score.factorScores.technicalPerformance,
        developer_adoption: score.factorScores.developerAdoption,
        market_traction: score.factorScores.marketTraction,
        business_sentiment: score.factorScores.businessSentiment,
        development_velocity: score.factorScores.developmentVelocity,
        platform_resilience: score.factorScores.platformResilience,
      },
      modifiers: score.modifiers,
      validation_status: score.validation,
      productivity_adjusted: !!PRODUCTIVITY_ADJUSTMENTS[score.toolId],
    })),
  };

  // Save new ranking period
  const newRankingPath = path.join(rankingsDir, "2025-07-14-productivity-adjusted.json");
  fs.writeFileSync(newRankingPath, JSON.stringify(newRankingPeriod, null, 2));

  // Generate comparison with previous rankings
  const previousRankingPath = path.join(rankingsDir, "2025-07-01.json");
  let comparison: any = null;

  if (fs.existsSync(previousRankingPath)) {
    const previousRankings = JSON.parse(fs.readFileSync(previousRankingPath, "utf-8"));
    const previousPositions: Record<string, number> = {};

    previousRankings.rankings.forEach((r: any) => {
      previousPositions[r.tool_id] = r.position;
    });

    comparison = {
      comparison_date: new Date().toISOString(),
      significant_changes: newRankingPeriod.rankings
        .filter((r) => {
          const prevPos = previousPositions[r.tool_id];
          return prevPos && Math.abs(r.position - prevPos) >= 2;
        })
        .map((r) => ({
          tool: r.tool_name,
          old_position: previousPositions[r.tool_id],
          new_position: r.position,
          change: r.position - previousPositions[r.tool_id],
          productivity_adjusted: r.productivity_adjusted,
          reasoning: PRODUCTIVITY_ADJUSTMENTS[r.tool_id]?.reasoning,
        })),
    };
  }

  // Generate summary report
  const summaryReport = {
    recalculation_date: new Date().toISOString(),
    algorithm_version: "v6.0-productivity-adjusted",
    research_integration: "METR productivity paradox study July 2025",
    tools_calculated: toolScores.length,
    tools_with_adjustments: Object.keys(PRODUCTIVITY_ADJUSTMENTS).length,
    ranking_changes: comparison,
    top_10_tools: newRankingPeriod.rankings.slice(0, 10).map((r) => ({
      position: r.position,
      tool: r.tool_name,
      score: r.score,
      tier: r.tier,
      productivity_adjusted: r.productivity_adjusted,
    })),
    productivity_impact_summary: {
      github_copilot_impact:
        "Business sentiment decreased by 0.36 due to market leadership position",
      gemini_code_assist_impact: "Business sentiment decreased by 0.24 as second-place tool",
      cursor_amazon_q_impact: "Business sentiment decreased by 0.13 as third-place tools",
      cognitive_bias_factor: "43% of user satisfaction identified as psychological bias",
    },
  };

  const summaryPath = path.join(dataDir, "productivity-adjusted-rankings-summary.json");
  fs.writeFileSync(summaryPath, JSON.stringify(summaryReport, null, 2));

  logger.info("Ranking recalculation completed", {
    toolsCalculated: toolScores.length,
    adjustmentsApplied: Object.keys(PRODUCTIVITY_ADJUSTMENTS).length,
    outputPath: newRankingPath,
    summaryPath,
  });

  // Display results
  console.log("\n=== UPDATED RANKINGS WITH PRODUCTIVITY ADJUSTMENTS ===");
  console.log("Research Integration: METR productivity paradox study");
  console.log(`Tools Calculated: ${toolScores.length}`);
  console.log(`Productivity Adjustments Applied: ${Object.keys(PRODUCTIVITY_ADJUSTMENTS).length}`);
  console.log("\nTop 10 Rankings:");

  newRankingPeriod.rankings.slice(0, 10).forEach((r) => {
    const adjustment = r.productivity_adjusted ? " [ADJUSTED]" : "";
    console.log(`${r.position}. ${r.tool_name} - ${r.score} (${r.tier})${adjustment}`);
  });

  if (comparison?.significant_changes?.length > 0) {
    console.log("\nSignificant Position Changes:");
    comparison.significant_changes.forEach((change: any) => {
      const direction = change.change > 0 ? "down" : "up";
      console.log(
        `${change.tool}: ${change.old_position} → ${change.new_position} (${Math.abs(change.change)} ${direction})`
      );
      if (change.productivity_adjusted) {
        console.log(`  Reason: ${change.reasoning}`);
      }
    });
  }

  console.log(`\nDetailed results saved to: ${summaryPath}`);
}

// Run the recalculation if called directly
if (require.main === module) {
  recalculateRankingsWithProductivityAdjustments()
    .then(() => {
      console.log("✓ Ranking recalculation with productivity adjustments completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("✗ Failed to recalculate rankings:", error);
      process.exit(1);
    });
}

export default recalculateRankingsWithProductivityAdjustments;
