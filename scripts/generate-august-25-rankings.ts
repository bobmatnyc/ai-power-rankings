#!/usr/bin/env tsx

/**
 * Generate August 25, 2025 Rankings Update
 * Incorporating significant developments from the past week
 */

import fs from "fs-extra";
import path from "node:path";

interface NewsImpact {
  toolId: string;
  toolSlug: string;
  impactScore: number;
  reason: string;
}

interface RankingEntry {
  tool_id: string;
  tool_name: string;
  rank: number;
  score: number;
  movement: {
    previous_position: number;
    change: number;
    direction: "up" | "down" | "same";
  };
  factor_scores: {
    agenticCapability: number;
    innovation: number;
    technicalPerformance: number;
    developerAdoption: number;
    marketTraction: number;
    businessSentiment: number;
    developmentVelocity: number;
    platformResilience: number;
    technicalCapability: number;
    communitySentiment: number;
  };
  sentiment_analysis: {
    rawSentiment: number;
    adjustedSentiment: number;
    newsImpact: number;
  };
  algorithm_version: string;
}

async function generateAugust25Rankings() {
  console.log("🚀 Generating August 25, 2025 Rankings Update");
  
  // Load current rankings as baseline
  const currentRankingsPath = path.join(process.cwd(), "data", "json", "rankings", "current.json");
  const currentRankings = await fs.readJSON(currentRankingsPath);
  
  // Define news impacts for August 19-25
  const newsImpacts: NewsImpact[] = [
    {
      toolId: "4",
      toolSlug: "claude-code",
      impactScore: 110, // Major GA release, 74.5% SWE-bench
      reason: "Claude Opus 4.1 GA with 74.5% SWE-bench accuracy"
    },
    {
      toolId: "2",
      toolSlug: "github-copilot",
      impactScore: 125, // GPT-5 integration
      reason: "GPT-5 integration with 40% reasoning improvement"
    },
    {
      toolId: "1",
      toolSlug: "cursor",
      impactScore: 95, // Security patches
      reason: "Critical security patches for MCP vulnerabilities"
    },
    {
      toolId: "14",
      toolSlug: "windsurf",
      impactScore: 50, // Pricing changes
      reason: "GPT-5 promotion ending, new tiered pricing"
    },
    {
      toolId: "8",
      toolSlug: "continue",
      impactScore: 15, // Milestone achievement
      reason: "Reached 20K GitHub stars, launched community hub"
    },
    {
      toolId: "7",
      toolSlug: "aider",
      impactScore: 12, // DeepSeek R1 support
      reason: "Added DeepSeek R1 support for local models"
    }
  ];
  
  // Create a map for quick lookup
  const impactMap = new Map(newsImpacts.map(i => [i.toolId, i]));
  
  // Update rankings with new news impacts
  const updatedRankings = currentRankings.rankings.map((ranking: RankingEntry) => {
    const impact = impactMap.get(ranking.tool_id);
    
    if (impact) {
      // Apply news impact boost with more balanced weighting
      const currentNewsImpact = ranking.sentiment_analysis?.newsImpact || 0;
      const newNewsImpact = impact.impactScore;
      
      // Blend current and new news impact
      const blendedNewsImpact = (currentNewsImpact * 0.3 + newNewsImpact * 0.7);
      
      // Calculate new score with balanced news weight
      const newsComponent = (blendedNewsImpact / 100) * 25; // 25% max news contribution
      const baseComponent = ranking.score * 0.75; // 75% base weight
      const newScore = baseComponent + newsComponent;
      
      return {
        ...ranking,
        score: Math.min(100, newScore),
        sentiment_analysis: {
          ...ranking.sentiment_analysis,
          newsImpact: blendedNewsImpact,
          rawSentiment: newNewsImpact > 100 ? 0.85 : newNewsImpact > 50 ? 0.65 : 0.4,
          adjustedSentiment: newNewsImpact > 100 ? 0.9 : newNewsImpact > 50 ? 0.7 : 0.45
        }
      };
    }
    
    // Minimal decay for tools without recent news
    return {
      ...ranking,
      score: ranking.score * 0.995, // Only 0.5% decay
      sentiment_analysis: {
        ...ranking.sentiment_analysis,
        newsImpact: Math.max(0, (ranking.sentiment_analysis.newsImpact || 0) * 0.95)
      }
    };
  });
  
  // Sort by new scores
  updatedRankings.sort((a: RankingEntry, b: RankingEntry) => b.score - a.score);
  
  // Update positions and movement
  const finalRankings = updatedRankings.map((ranking: RankingEntry, index: number) => {
    const previousRank = currentRankings.rankings.findIndex(
      (r: RankingEntry) => r.tool_id === ranking.tool_id
    ) + 1;
    const newRank = index + 1;
    const change = previousRank - newRank;
    
    return {
      ...ranking,
      rank: newRank,
      movement: {
        previous_position: previousRank,
        change: Math.abs(change),
        direction: change > 0 ? "up" : change < 0 ? "down" : "same"
      },
      algorithm_version: "v7.1-august-25-update"
    };
  });
  
  // Create the new rankings object
  const newRankings = {
    period: "2025-08",
    date: "2025-08-25",
    algorithm_version: "v7.1-august-25-update",
    algorithm_name: "Smart Defaults & Proxy Metrics with Enhanced News Impact - August 25 Update",
    rankings: finalRankings,
    metadata: {
      total_tools: finalRankings.length,
      calculation_date: "2025-08-25T00:00:00.000Z",
      notes: "August 25 update: Claude Opus 4.1 GA (74.5% SWE-bench), GitHub Copilot GPT-5 integration (40% reasoning improvement), Cursor security patches, Windsurf pricing changes, Continue 20K stars milestone, Aider DeepSeek R1 support. Algorithm v7.1 with 30% news weight applied to recent developments."
    }
  };
  
  // Save the new rankings
  const outputPath = path.join(process.cwd(), "data", "json", "rankings", "2025-08-25.json");
  await fs.writeJSON(outputPath, newRankings, { spaces: 2 });
  console.log(`✅ Saved rankings to: ${outputPath}`);
  
  // Update current.json
  await fs.writeJSON(currentRankingsPath, newRankings, { spaces: 2 });
  console.log(`✅ Updated current rankings`);
  
  // Display top 10
  console.log("\n🏆 Top 10 Rankings - August 25, 2025:");
  finalRankings.slice(0, 10).forEach((r: RankingEntry) => {
    const movement = r.movement.direction === "up" ? "↑" : 
                    r.movement.direction === "down" ? "↓" : "→";
    const change = r.movement.change > 0 ? ` (${movement}${r.movement.change})` : "";
    console.log(`   ${r.rank}. ${r.tool_name}: ${r.score.toFixed(1)}${change}`);
  });
  
  // Highlight major movers
  const majorMovers = finalRankings.filter((r: RankingEntry) => r.movement.change >= 2);
  if (majorMovers.length > 0) {
    console.log("\n📈 Major Movers:");
    majorMovers.forEach((r: RankingEntry) => {
      const direction = r.movement.direction === "up" ? "↑" : "↓";
      console.log(`   ${r.tool_name}: ${direction}${r.movement.change} positions`);
    });
  }
  
  return newRankings;
}

// Run the script
if (require.main === module) {
  generateAugust25Rankings().catch(console.error);
}

export { generateAugust25Rankings };