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
 *
 * NODE_ENV requirement: `regenerateRankings()` persists the snapshot inside a
 * transaction, which needs the pooled Neon driver. See the fail-fast guard below.
 */

// ---------------------------------------------------------------------------
// Fail-fast environment guard — MUST run before any DB module is loaded.
//
// The DB-touching imports below are deliberately DYNAMIC (inside main() and the
// exit handlers) rather than static: static ES imports are hoisted above this
// block and would load lib/db/connection before the guard could fire.
//
// Why the guard exists: regenerateRankings() -> saveSnapshot() persists the
// ranking snapshot inside a transaction, and lib/db/connection only selects the
// transaction-capable pooled Neon driver when NODE_ENV is "production" or
// "staging". A plain local run (`npx tsx scripts/generate-v76-rankings.ts`)
// picks the default neon-http driver and fails deep in execution with the
// cryptic "Error: No transactions support in neon-http driver". Fail fast here
// with an actionable message instead. This does NOT affect the Vercel monthly
// cron, which runs the API route with NODE_ENV=production.
// ---------------------------------------------------------------------------
const NODE_ENV = process.env.NODE_ENV;
if (NODE_ENV !== "production" && NODE_ENV !== "staging") {
  console.error(
    `\n❌ Refusing to run: NODE_ENV is "${NODE_ENV ?? "unset"}" (expected "production" or "staging").\n\n` +
      "This script writes a ranking snapshot in a transaction, which requires the\n" +
      "pooled Neon driver (enabled only when NODE_ENV=production|staging). The\n" +
      "default neon-http driver used locally cannot run transactions and fails with:\n" +
      '  "Error: No transactions support in neon-http driver"\n\n' +
      "Re-run via the repo convention:\n" +
      "  ./scripts/run-with-prod-env.sh npx tsx scripts/generate-v76-rankings.ts\n\n" +
      "(or set NODE_ENV=production with a valid DATABASE_URL).\n"
  );
  process.exit(1);
}

function parsePeriodArg(): string | undefined {
  const arg = process.argv.find((a) => a.startsWith("--period="));
  return arg ? arg.slice("--period=".length) : undefined;
}

async function main() {
  // Dynamic imports keep DB-touching modules out of the module top-level so the
  // NODE_ENV guard above always runs first (see note there).
  const { ALGORITHM_V76_WEIGHTS } = await import("@/lib/ranking-algorithm-v76");
  const { regenerateRankings } = await import("@/lib/services/ranking-generation.service");

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
    const { closeDb } = await import("@/lib/db/connection");
    await closeDb();
    console.log("\n✨ Done! Rankings are now live with Algorithm v7.6.\n");
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("\n💥 Fatal Error:", error);
    const { closeDb } = await import("@/lib/db/connection");
    await closeDb();
    process.exit(1);
  });
