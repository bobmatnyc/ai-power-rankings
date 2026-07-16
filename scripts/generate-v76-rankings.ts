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
 * Historical backfill flags (additive; the live cron path is unaffected):
 *   --metrics-source=<path>  Score a period-specific `data/historical-metrics/
 *                            <period>.json` override instead of only live
 *                            tools.data. Defaults to
 *                            `data/historical-metrics/<period>.json` when that
 *                            file exists; omit/absent -> live tools.data.
 *   --dry-run                Compute + print the rankings WITHOUT any database
 *                            access or persistence. Uses an in-memory roster
 *                            (data/extracted-rankings/2025-09.json) so it runs
 *                            locally with no NODE_ENV / Neon requirement. Useful
 *                            for previewing a backfilled month before the gated
 *                            prod run.
 *
 * v7.6 combines:
 * 1. npm data quality fix (removed 15 incorrect mappings, 22.9M bogus downloads)
 * 2. Market-validated weights (40% adoption focus)
 * 3. Missing data penalty (confidence multiplier 0.7-1.0 based on completeness)
 *
 * NODE_ENV requirement (non-dry-run only): `regenerateRankings()` persists the
 * snapshot inside a transaction, which needs the pooled Neon driver. See the
 * fail-fast guard below.
 */

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function parsePeriodArg(): string | undefined {
  const arg = process.argv.find((a) => a.startsWith("--period="));
  return arg ? arg.slice("--period=".length) : undefined;
}

function parseMetricsSourceArg(period: string | undefined): string | undefined {
  const arg = process.argv.find((a) => a.startsWith("--metrics-source="));
  if (arg) return arg.slice("--metrics-source=".length);
  // Default: auto-pick data/historical-metrics/<period>.json when it exists.
  if (period) {
    const def = join(ROOT, "data", "historical-metrics", `${period}.json`);
    if (existsSync(def)) return def;
  }
  return undefined;
}

const DRY_RUN = process.argv.includes("--dry-run");

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
// "staging". A plain local run picks the default neon-http driver and fails deep
// in execution with "No transactions support in neon-http driver". Fail fast
// here instead.
//
// --dry-run performs NO database access (in-memory roster, no saveSnapshot), so
// it deliberately bypasses this guard and runs anywhere.
// ---------------------------------------------------------------------------
const NODE_ENV = process.env.NODE_ENV;
if (!DRY_RUN && NODE_ENV !== "production" && NODE_ENV !== "staging") {
  console.error(
    `\n❌ Refusing to run: NODE_ENV is "${NODE_ENV ?? "unset"}" (expected "production" or "staging").\n\n` +
      "This script writes a ranking snapshot in a transaction, which requires the\n" +
      "pooled Neon driver (enabled only when NODE_ENV=production|staging). The\n" +
      "default neon-http driver used locally cannot run transactions and fails with:\n" +
      '  "Error: No transactions support in neon-http driver"\n\n' +
      "Re-run via the repo convention:\n" +
      "  ./scripts/run-with-prod-env.sh npx tsx scripts/generate-v76-rankings.ts\n\n" +
      "(or set NODE_ENV=production with a valid DATABASE_URL).\n\n" +
      "To PREVIEW without any DB access, add --dry-run.\n"
  );
  process.exit(1);
}

/**
 * In-memory persistence for --dry-run: loads the 31-tool roster from the last
 * real export and scores it with EMPTY base metrics so the historical override
 * fully drives the result. saveSnapshot is a no-op (nothing is persisted).
 *
 * NOTE: this is an APPROXIMATION of production, whose base is the live
 * tools.data. It exists to prove the override path yields genuine month-over-
 * month movement (not a flat copy), not to reproduce exact prod scores.
 */
async function buildDryRunPersistence() {
  const { readFileSync } = await import("node:fs");
  const { slugify } = await import("@/lib/historical-metrics/slugify");
  const rosterPath = join(ROOT, "data", "extracted-rankings", "2025-09.json");
  const raw = JSON.parse(readFileSync(rosterPath, "utf8")) as {
    rankings: Array<{ tool_id: string; tool_name: string }>;
  };
  const sourceTools = raw.rankings.map((r) => ({
    id: String(r.tool_id),
    name: r.tool_name,
    slug: slugify(r.tool_name),
    category: "code-editor",
    status: "active",
    data: { metrics: {} } as Record<string, unknown>,
  }));

  return {
    persistence: {
      loadActiveTools: async () => sourceTools,
      loadCurrentRankings: async () => null,
      saveSnapshot: async () => {
        /* dry-run: intentionally no-op */
      },
    },
    rosterCount: sourceTools.length,
  };
}

async function main() {
  // Dynamic imports keep DB-touching modules out of the module top-level so the
  // NODE_ENV guard above always runs first (see note there).
  const { ALGORITHM_V76_WEIGHTS } = await import("@/lib/ranking-algorithm-v76");
  const { regenerateRankings } = await import("@/lib/services/ranking-generation.service");

  const period = parsePeriodArg();
  const metricsOverridePath = parseMetricsSourceArg(period);

  console.log("\n🚀 Generating Rankings with Algorithm v7.6 (Market-Validated + npm Fix)\n");
  console.log("=".repeat(80));
  if (DRY_RUN) console.log("🧪 DRY-RUN: no database access, nothing will be persisted.");
  if (metricsOverridePath) {
    console.log(`📥 Historical override: ${metricsOverridePath.replace(ROOT + "/", "")}`);
  }
  console.log("\n📊 Algorithm v7.6 Weights (Market-Validated):");
  console.log(`   Agentic Capability:    ${ALGORITHM_V76_WEIGHTS.agenticCapability.toFixed(3)}`);
  console.log(`   Innovation:            ${ALGORITHM_V76_WEIGHTS.innovation.toFixed(3)}`);
  console.log(`   Technical Performance: ${ALGORITHM_V76_WEIGHTS.technicalPerformance.toFixed(3)}`);
  console.log(`   Developer Adoption:    ${ALGORITHM_V76_WEIGHTS.developerAdoption.toFixed(3)} 🔥`);
  console.log(`   Market Traction:       ${ALGORITHM_V76_WEIGHTS.marketTraction.toFixed(3)} 🔥`);
  console.log(`   Business Sentiment:    ${ALGORITHM_V76_WEIGHTS.businessSentiment.toFixed(3)}`);
  console.log(`   Development Velocity:  ${ALGORITHM_V76_WEIGHTS.developmentVelocity.toFixed(3)}`);
  console.log(`   Platform Resilience:   ${ALGORITHM_V76_WEIGHTS.platformResilience.toFixed(3)}`);

  if (DRY_RUN) {
    const { persistence, rosterCount } = await buildDryRunPersistence();
    // Anchor the clock to the target month for deterministic maturity scoring.
    const now = period ? () => new Date(`${period}-01T00:00:00Z`) : undefined;
    console.log(`\n🧮 Scoring ${rosterCount} roster tools (dry-run, no persistence)…`);

    // Score through the in-memory persistence and capture the snapshot the
    // service *would* have saved (saveSnapshot never touches a database here).
    let captured: Array<{ rank: number; tool_name: string; score: number; tier: string; reconstructed?: boolean }> = [];
    const capturing = {
      ...persistence,
      saveSnapshot: async (input: { data: typeof captured }) => {
        captured = input.data;
      },
    };
    await regenerateRankings({
      ...(period ? { period } : {}),
      ...(metricsOverridePath ? { metricsOverridePath } : {}),
      persistence: capturing as never,
      ...(now ? { now } : {}),
    });

    console.log("\n" + "=".repeat(80));
    console.log(`🏁 DRY-RUN Top 15 — period ${period ?? "(current)"}`);
    console.log("=".repeat(80));
    for (const r of captured.slice(0, 15)) {
      const flag = r.reconstructed ? " *reconstructed" : "";
      console.log(`   #${String(r.rank).padStart(2)}  ${r.tool_name.padEnd(28)} ${r.score.toFixed(3)}  [${r.tier}]${flag}`);
    }
    console.log("\n🧪 Dry-run complete. Nothing was written to the database.\n");
    return;
  }

  console.log("\n🧮 Scoring active tools and persisting snapshot...");
  const result = await regenerateRankings({
    ...(period ? { period } : {}),
    ...(metricsOverridePath ? { metricsOverridePath } : {}),
  });

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
    if (!DRY_RUN) {
      const { closeDb } = await import("@/lib/db/connection");
      await closeDb();
    }
    console.log("\n✨ Done! Rankings are now live with Algorithm v7.6.\n");
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("\n💥 Fatal Error:", error);
    if (!DRY_RUN) {
      const { closeDb } = await import("@/lib/db/connection");
      await closeDb();
    }
    process.exit(1);
  });
