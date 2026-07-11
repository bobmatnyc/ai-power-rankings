#!/usr/bin/env tsx

/**
 * Generate Rankings with Algorithm v7.6 (Fine-Tuned Market + Innovation Balance)
 *
 * Thin CLI wrapper around the shared `regenerateRankings()` service
 * (lib/services/ranking-generation.service.ts) — the single source of truth
 * used by both this script and the `/api/cron/regenerate-rankings` cron route.
 *
 * This wrapper adds only process-level concerns: human-readable console output,
 * an optional `--period=YYYY-MM` override, and closing the DB connection on exit
 * (the service intentionally leaves the pooled connection open for the serverless
 * cron path).
 *
 * v7.6 combines:
 * 1. npm data quality fix (removed 15 incorrect mappings, 22.9M bogus downloads)
 * 2. Market-validated weights (40% adoption focus)
 * 3. Missing data penalty (confidence multiplier 0.7-1.0 based on completeness)
 */

import { closeDb } from "@/lib/db/connection";
import { ALGORITHM_V76_WEIGHTS } from "@/lib/ranking-algorithm-v76";
import { regenerateRankings } from "@/lib/services/ranking-generation.service";

function parsePeriodArg(): string | undefined {
  const arg = process.argv.find((a) => a.startsWith("--period="));
  return arg ? arg.slice("--period=".length) : undefined;
}

async function main() {
  const period = parsePeriodArg();

  console.log("\n🚀 Generating Rankings with Algorithm v7.6 (Market-Validated + npm Fix)\n");
  console.log("=".repeat(80));
  console.log("\n📊 Algorithm v7.6 Weights (Market-Validated):");
  console.log(`   Agentic Capability:    ${ALGORITHM_V76_WEIGHTS.agenticCapability.toFixed(3)}`);
  console.log(`   Innovation:            ${ALGORITHM_V76_WEIGHTS.innovation.toFixed(3)}`);
  console.log(`   Technical Performance: ${ALGORITHM_V76_WEIGHTS.technicalPerformance.toFixed(3)}`);
  console.log(`   Developer Adoption:    ${ALGORITHM_V76_WEIGHTS.developerAdoption.toFixed(3)} 🔥`);
  console.log(`   Market Traction:       ${ALGORITHM_V76_WEIGHTS.marketTraction.toFixed(3)} 🔥`);
  console.log(`   Business Sentiment:    ${ALGORITHM_V76_WEIGHTS.businessSentiment.toFixed(3)}`);
  console.log(`   Development Velocity:  ${ALGORITHM_V76_WEIGHTS.developmentVelocity.toFixed(3)}`);
  console.log(`   Platform Resilience:   ${ALGORITHM_V76_WEIGHTS.platformResilience.toFixed(3)}`);

  console.log("\n🧮 Scoring active tools and persisting snapshot...");
  const result = await regenerateRankings(period ? { period } : {});

  console.log("\n" + "=".repeat(80));
  console.log("✅ Rankings Generated Successfully (v7.6)!");
  console.log("=".repeat(80));
  console.log("\n📊 Summary:");
  console.log(`   Period:            ${result.period}`);
  console.log(`   Algorithm Version: v${result.algorithmVersion}`);
  console.log(`   Total Tools:       ${result.toolCount}`);
  console.log(`   Published At:      ${result.publishedAt}`);

  if (result.topMovers.length > 0) {
    console.log("\n🔥 Notable Changes:");
    for (const mover of result.topMovers) {
      const direction = mover.change > 0 ? "↑" : "↓";
      console.log(
        `   ${direction} ${Math.abs(mover.change)} positions: ` +
          `${mover.tool_name} (#${mover.previous_position ?? "NEW"} → #${mover.rank})`
      );
    }
  } else {
    console.log("\n   No significant position changes (±5 ranks)");
  }
}

main()
  .then(async () => {
    await closeDb();
    console.log("\n✨ Done! Rankings are now live with Algorithm v7.6.\n");
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("\n💥 Fatal Error:", error);
    await closeDb();
    process.exit(1);
  });
