#!/usr/bin/env tsx

import path from "node:path";
import fs from "fs-extra";

async function fixJulyRankings() {
  const filePath = path.join(process.cwd(), "data/json/rankings/periods/2025-07.json");

  try {
    // Read the existing file
    const data = await fs.readJson(filePath);

    // Transform to correct format
    const fixedData = {
      period: data.month || "2025-07",
      algorithm_version: data.algorithm_version,
      algorithm_name:
        data.algorithm_info?.name ||
        "Smart Defaults & Accurate Capability Scoring with Dynamic Velocity",
      created_at: data.generated_at,
      rankings: data.rankings.map((ranking: any) => {
        // Get tool name from tools.json
        const toolsData = fs.readJsonSync(path.join(process.cwd(), "data/json/tools/tools.json"));
        const tool = toolsData.tools.find((t: any) => t.id === ranking.tool_id);

        return {
          tool_id: ranking.tool_id,
          tool_name: tool?.name || `Tool ${ranking.tool_id}`,
          rank: ranking.rank,
          score: ranking.score,
          tier: getTier(ranking.score),
          factor_scores: ranking.factor_scores,
          sentiment_analysis: ranking.sentiment_analysis || null,
          movement: ranking.movement || {
            previous_position: ranking.previous_rank,
            change: 0,
            direction: "new",
          },
          change_analysis: ranking.change_analysis || null,
        };
      }),
      metadata: {
        total_tools: data.rankings.length,
        calculation_date: data.generated_at || new Date().toISOString(),
        notes: "Fixed format from v7 algorithm output",
      },
    };

    // Write the fixed data
    await fs.writeJson(filePath, fixedData, { spaces: 2 });
    console.log("✅ Fixed July rankings format");
  } catch (error) {
    console.error("❌ Error fixing rankings:", error);
    process.exit(1);
  }
}

function getTier(score: number): string {
  if (score >= 85) return "S";
  if (score >= 75) return "A";
  if (score >= 65) return "B";
  if (score >= 55) return "C";
  return "D";
}

fixJulyRankings();
