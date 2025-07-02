#!/usr/bin/env tsx
/**
 * Update Innovation Scores Based on Detailed Innovation Ontology
 * This script updates the innovation scores for each tool in each ranking period
 * based on the time-bound scores defined in the detailed innovation ontology.
 */

import fs from "fs/promises";
import path from "path";

// Innovation scores from detailed_innovation_ontology.md
// Scores are mapped by tool slug and month (YYYY-MM-DD format)
const innovationScores: Record<string, Record<string, number>> = {
  devin: {
    "2025-01-01": 8.5,
    "2025-02-01": 8.8,
    "2025-03-01": 9.0,
    "2025-04-01": 9.1,
    "2025-05-01": 9.0,
    "2025-06-01": 9.0,
    "2025-07-01": 8.9,
  },
  "claude-artifacts": {
    // Claude.AI in the ontology
    "2025-01-01": 7.5,
    "2025-02-01": 8.0,
    "2025-03-01": 8.2,
    "2025-04-01": 8.5,
    "2025-05-01": 8.5,
    "2025-06-01": 8.5,
    "2025-07-01": 8.6,
  },
  cursor: {
    "2025-01-01": 7.2,
    "2025-02-01": 7.5,
    "2025-03-01": 7.8,
    "2025-04-01": 8.0,
    "2025-05-01": 8.0,
    "2025-06-01": 8.0,
    "2025-07-01": 8.1,
  },
  "v0-vercel": {
    // V0 in the ontology
    "2025-01-01": 7.0,
    "2025-02-01": 7.5,
    "2025-03-01": 8.0,
    "2025-04-01": 8.0,
    "2025-05-01": 7.9,
    "2025-06-01": 8.0,
    "2025-07-01": 8.0,
  },
  zed: {
    "2025-01-01": 6.5,
    "2025-02-01": 7.0,
    "2025-03-01": 7.2,
    "2025-04-01": 7.5,
    "2025-05-01": 7.5,
    "2025-06-01": 7.5,
    "2025-07-01": 7.6,
  },
  windsurf: {
    "2025-01-01": 7.0,
    "2025-02-01": 7.2,
    "2025-03-01": 7.5,
    "2025-04-01": 7.5,
    "2025-05-01": 7.3,
    "2025-06-01": 7.5,
    "2025-07-01": 7.2,
  },
  "claude-code": {
    "2025-01-01": 6.5,
    "2025-02-01": 7.0,
    "2025-03-01": 7.2,
    "2025-04-01": 7.5,
    "2025-05-01": 7.5,
    "2025-06-01": 7.5,
    "2025-07-01": 7.6,
  },
  jules: {
    // Google Jules
    "2025-01-01": 6.0,
    "2025-02-01": 6.5,
    "2025-03-01": 6.8,
    "2025-04-01": 7.0,
    "2025-05-01": 7.0,
    "2025-06-01": 7.0,
    "2025-07-01": 7.1,
  },
  "bolt-new": {
    "2025-01-01": 5.8,
    "2025-02-01": 6.0,
    "2025-03-01": 6.2,
    "2025-04-01": 6.5,
    "2025-05-01": 6.5,
    "2025-06-01": 6.5,
    "2025-07-01": 6.6,
  },
  "github-copilot": {
    "2025-01-01": 5.5,
    "2025-02-01": 5.8,
    "2025-03-01": 6.0,
    "2025-04-01": 6.0,
    "2025-05-01": 6.0,
    "2025-06-01": 6.0,
    "2025-07-01": 6.1,
  },
  openhands: {
    "2025-01-01": 5.5,
    "2025-02-01": 5.8,
    "2025-03-01": 6.0,
    "2025-04-01": 6.0,
    "2025-05-01": 6.0,
    "2025-06-01": 6.0,
    "2025-07-01": 6.1,
  },
  lovable: {
    "2025-01-01": 5.0,
    "2025-02-01": 5.2,
    "2025-03-01": 5.3,
    "2025-04-01": 5.5,
    "2025-05-01": 5.5,
    "2025-06-01": 5.5,
    "2025-07-01": 5.6,
  },
  cline: {
    "2025-01-01": 5.0,
    "2025-02-01": 5.2,
    "2025-03-01": 5.3,
    "2025-04-01": 5.5,
    "2025-05-01": 5.5,
    "2025-06-01": 5.5,
    "2025-07-01": 5.6,
  },
  "replit-agent": {
    "2025-01-01": 4.8,
    "2025-02-01": 4.9,
    "2025-03-01": 5.0,
    "2025-04-01": 5.0,
    "2025-05-01": 5.0,
    "2025-06-01": 5.0,
    "2025-07-01": 5.1,
  },
  aider: {
    "2025-01-01": 4.2,
    "2025-02-01": 4.3,
    "2025-03-01": 4.4,
    "2025-04-01": 4.5,
    "2025-05-01": 4.5,
    "2025-06-01": 4.5,
    "2025-07-01": 4.6,
  },
  "chatgpt-canvas": {
    "2025-01-01": 3.5,
    "2025-02-01": 3.8,
    "2025-03-01": 4.0,
    "2025-04-01": 4.0,
    "2025-05-01": 4.0,
    "2025-06-01": 4.0,
    "2025-07-01": 4.1,
  },
  "diffblue-cover": {
    "2025-01-01": 3.8,
    "2025-02-01": 3.9,
    "2025-03-01": 4.0,
    "2025-04-01": 4.0,
    "2025-05-01": 4.0,
    "2025-06-01": 4.0,
    "2025-07-01": 4.1,
  },
};

// Default innovation scores for tools not in the ontology
const defaultInnovationScore = 3.0;

interface RankingPeriod {
  period: string;
  rankings: Array<{
    tool_id: string;
    tool_name: string;
    position: number;
    score: number;
    tier: string;
    factor_scores: {
      agentic_capability: number;
      innovation: number;
      technical_performance: number;
      developer_adoption: number;
      market_traction: number;
      business_sentiment: number;
      development_velocity: number;
      platform_resilience: number;
    };
  }>;
}

/**
 * Get the innovation score for a tool at a specific date
 */
function getInnovationScore(toolSlug: string, date: string): number {
  const toolScores = innovationScores[toolSlug];
  if (!toolScores) {
    return defaultInnovationScore;
  }

  // Find the most recent score that applies to this date
  const dates = Object.keys(toolScores).sort();
  let applicableScore = defaultInnovationScore;

  for (const scoreDate of dates) {
    if (scoreDate <= date) {
      applicableScore = toolScores[scoreDate];
    } else {
      break;
    }
  }

  return applicableScore;
}

/**
 * Map tool name to tool slug for matching with innovation scores
 */
function getToolSlug(toolName: string): string {
  const nameToSlugMap: Record<string, string> = {
    "GitHub Copilot": "github-copilot",
    Devin: "devin",
    "Claude Code": "claude-code",
    "Claude Artifacts": "claude-artifacts",
    Cursor: "cursor",
    Windsurf: "windsurf",
    "Google Jules": "jules",
    "ChatGPT Canvas": "chatgpt-canvas",
    Tabnine: "tabnine",
    "OpenAI Codex CLI": "openai-codex-cli",
    Lovable: "lovable",
    "Replit Agent": "replit-agent",
    Cline: "cline",
    "Bolt.new": "bolt-new",
    v0: "v0-vercel",
    Zed: "zed",
    OpenHands: "openhands",
    Aider: "aider",
    "Diffblue Cover": "diffblue-cover",
    "Augment Code": "augment-code",
    "Amazon Q Developer": "amazon-q-developer",
    "JetBrains AI Assistant": "jetbrains-ai",
    Continue: "continue-dev",
    "Sourcegraph Cody": "sourcegraph-cody",
    "Microsoft IntelliCode": "microsoft-intellicode",
    "Qodo Gen": "qodo-gen",
    "Snyk Code": "snyk-code",
    Sourcery: "sourcery",
    CodeRabbit: "coderabbit",
  };

  return nameToSlugMap[toolName] || toolName.toLowerCase().replace(/\s+/g, "-");
}

async function updateInnovationScores() {
  try {
    console.log("🔄 Starting innovation score update...\n");

    const rankingsDir = path.join(process.cwd(), "data", "json", "rankings", "periods");
    const files = await fs.readdir(rankingsDir);
    const jsonFiles = files.filter(
      (f) => f.endsWith(".json") && !f.includes("deleted") && !f.includes("backup")
    );

    console.log(`📊 Found ${jsonFiles.length} ranking period files to update\n`);

    for (const file of jsonFiles) {
      const filePath = path.join(rankingsDir, file);
      const content = await fs.readFile(filePath, "utf-8");
      const data: RankingPeriod = JSON.parse(content);

      const periodDate = data.period;
      console.log(`\n📅 Processing period: ${periodDate}`);

      let updatedCount = 0;

      // Update innovation scores for each tool
      for (const ranking of data.rankings) {
        const toolSlug = getToolSlug(ranking.tool_name);
        const innovationScore = getInnovationScore(toolSlug, periodDate);

        if (ranking.factor_scores.innovation !== innovationScore) {
          ranking.factor_scores.innovation = innovationScore;
          updatedCount++;
          console.log(`   ✓ ${ranking.tool_name}: ${innovationScore}`);
        }
      }

      if (updatedCount > 0) {
        // Write updated data back to file
        await fs.writeFile(filePath, JSON.stringify(data, null, 2) + "\n");
        console.log(`   ✅ Updated ${updatedCount} innovation scores`);
      } else {
        console.log("   ⏭️  No updates needed");
      }
    }

    console.log("\n✨ Innovation score update complete!");
  } catch (error) {
    console.error("❌ Error updating innovation scores:", error);
    process.exit(1);
  }
}

// Run the update
updateInnovationScores();
