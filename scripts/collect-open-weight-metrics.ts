#!/usr/bin/env tsx
/**
 * Admin entry point for the monthly open-weight model metrics collection (#184, folds in #95).
 *
 * Why: the collector must run on its own, not inside /api/cron/collect-metrics, until the
 *   owner wires it into the schedule after the 11-01 run. This script is the only caller.
 * What: collects every `kind='model'`, `open_weight=true` tool with an `hf_repo` from the
 *   Hugging Face Hub and upserts one `tool_metrics_history` row each plus one ledger row.
 *   Dry run (the default) fetches and prints counts but writes nothing; `--apply` writes.
 *   Exit 0: status `ok`. Exit 2: `partial`. Exit 1: `failed`, a ledger error or a bad call.
 *   Prints counts only. The connection comes from DATABASE_URL and is never printed; no
 *   other credential is read.
 * Test: `tests/unit/metrics-open-weight-run-184.test.ts`
 *
 * Usage: tsx scripts/collect-open-weight-metrics.ts [--dry-run | --apply]
 */

import { HuggingFaceModelCollector } from "../lib/metrics-collectors/huggingface";
import { runOpenWeightCollection } from "../lib/metrics-history/collect-open-weight";
import { createOpenWeightStore } from "../lib/metrics-history/store";
import { redactConnectionString } from "./apply-migrations";

export function exitCodeFor(status: "ok" | "partial" | "failed", ledgerError: string | null): number {
  if (ledgerError !== null || status === "failed") return 1;
  return status === "partial" ? 2 : 0;
}

async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const flags = argv.filter((a) => a.startsWith("--"));
  if (argv.length !== flags.length || flags.some((f) => f !== "--dry-run" && f !== "--apply") || flags.length > 1) {
    console.error("Usage: tsx scripts/collect-open-weight-metrics.ts [--dry-run | --apply]");
    return 1;
  }
  const url = process.env["DATABASE_URL"];
  if (!url) {
    console.error("ERROR: DATABASE_URL is not set");
    return 1;
  }
  const dryRun = !flags.includes("--apply");
  const { Pool } = await import("@neondatabase/serverless");
  const { drizzle } = await import("drizzle-orm/neon-serverless");
  const pool = new Pool({ connectionString: url });
  try {
    const { result, ledgerError } = await runOpenWeightCollection({
      store: createOpenWeightStore(drizzle(pool)),
      collect: (repo, signal) => new HuggingFaceModelCollector({ signal }).fetchModelMetrics(repo),
      dryRun,
    });
    const c = result.counts;
    console.log(
      `${dryRun ? "dry run" : "applied"}: status=${result.status} attempted=${c.attempted} recorded=${c.recorded} ` +
        `not_found=${c.not_found} failed=${c.failed} skipped_timeout=${c.skipped_timeout}`
    );
    if (result.error) console.error(`first error: ${redactConnectionString(result.error, url)}`);
    if (ledgerError) console.error(`ledger error: ${redactConnectionString(ledgerError, url)}`);
    return exitCodeFor(result.status, ledgerError);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`ERROR: collect-open-weight-metrics failed: ${redactConnectionString(message, url)}`);
    return 1;
  } finally {
    await pool.end();
  }
}

// Run only as the entrypoint, never on import.
const entrypoint = process.argv[1] ?? "";
if (/collect-open-weight-metrics\.(ts|js|mjs|cjs)$/.test(entrypoint)) {
  void main().then((code) => {
    process.exit(code);
  });
}
