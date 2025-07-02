#!/usr/bin/env tsx

import { getPayload } from "payload";
import config from "@payload-config";

interface RankingDoc {
  period: string;
  algorithm_version?: string;
  is_current?: boolean;
  score: number;
  position: number;
  tool?: {
    name: string;
  };
  tool_name?: string;
  agentic_capability?: number;
  innovation?: number;
  technical_performance?: number;
  developer_adoption?: number;
  market_traction?: number;
  [key: string]: unknown;
}

async function debugRankings() {
  const payload = await getPayload({ config });

  try {
    // Get all ranking periods
    const { docs: rankings } = await payload.find({
      collection: "rankings",
      limit: 1000,
      sort: "-createdAt",
    });

    // Group by period
    const periodGroups = new Map<string, RankingDoc[]>();
    rankings.forEach((ranking) => {
      const period = ranking["period"];
      if (!periodGroups.has(period)) {
        periodGroups.set(period, []);
      }
      periodGroups.get(period)!.push(ranking);
    });

    console.log("\n=== Ranking Periods ===");
    console.log(`Total periods: ${periodGroups.size}`);
    console.log(`Total rankings: ${rankings.length}`);

    // Show each period
    for (const [period, periodRankings] of periodGroups) {
      console.log(`\n--- Period: ${period} ---`);
      console.log(`  Total tools: ${periodRankings.length}`);
      console.log(`  Algorithm: ${periodRankings[0]["algorithm_version"] || "unknown"}`);
      console.log(`  Is Current: ${periodRankings[0]["is_current"] || false}`);

      // Check scores
      const scores = periodRankings.map((r) => r["score"]);
      const uniqueScores = [...new Set(scores)];
      console.log(`  Unique scores: ${uniqueScores.length}`);

      if (uniqueScores.length === 1) {
        console.log(`  ⚠️  WARNING: All tools have the same score: ${uniqueScores[0]}`);
      }

      // Show top 5 rankings
      const topRankings = periodRankings.sort((a, b) => a["position"] - b["position"]).slice(0, 5);

      console.log("\n  Top 5 Rankings:");
      topRankings.forEach((ranking) => {
        const tool = ranking["tool"];
        const toolName =
          typeof tool === "object" ? tool["name"] : ranking["tool_name"] || "Unknown";
        console.log(`    #${ranking["position"]} ${toolName}`);
        console.log(`       Score: ${ranking["score"]}`);
        console.log("       Factor Scores:");
        console.log(`         - Agentic: ${ranking["agentic_capability"] || "null"}`);
        console.log(`         - Innovation: ${ranking["innovation"] || "null"}`);
        console.log(`         - Technical: ${ranking["technical_performance"] || "null"}`);
        console.log(`         - Developer: ${ranking["developer_adoption"] || "null"}`);
        console.log(`         - Market: ${ranking["market_traction"] || "null"}`);
      });
    }

    // Check for the specific "Mid June Rankings" period
    console.log("\n=== Checking 'Mid June Rankings' ===");
    const midJuneRankings = rankings.filter((r) => r["period"] === "Mid June Rankings");
    if (midJuneRankings.length > 0) {
      console.log(`Found ${midJuneRankings.length} rankings`);
      const scores = midJuneRankings.map((r) => r["score"]);
      const uniqueScores = [...new Set(scores)];
      console.log(`Unique scores: ${uniqueScores}`);

      // Show a few examples
      console.log("\nSample rankings:");
      midJuneRankings.slice(0, 3).forEach((ranking) => {
        console.log(`\nTool: ${ranking["tool_name"] || "Unknown"}`);
        console.log(`Position: ${ranking["position"]}`);
        console.log(`Score: ${ranking["score"]}`);
        console.log(
          "All fields:",
          Object.keys(ranking).filter((k) => k !== "tool")
        );
      });
    } else {
      console.log("No 'Mid June Rankings' found");
    }
  } catch (error) {
    console.error("Error debugging rankings:", error);
  } finally {
    process.exit(0);
  }
}

debugRankings().catch(console.error);
