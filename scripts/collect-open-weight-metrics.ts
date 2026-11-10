#!/usr/bin/env tsx
/**
 * Admin entry point for the open-weight model metrics collection (#184).
 *
 * Why: the collector runs on its own, outside /api/cron/collect-metrics and outside scoring.
 *   This script is its only caller.
 * What: collects Hugging Face downloads and likes for every `kind='model'` tool with an `hf_repo`
 *   and upserts one history row each. Dry run (the default) fetches and prints counts but writes
 *   nothing; `--apply` writes. Exit 0: `ok`. Exit 2: `partial`. Exit 1: `failed` or a bad call.
 *   Prints counts only. The connection comes from DATABASE_URL and is never printed. HF_TOKEN is
 *   optional; without it the Hub calls are anonymous.
 * Test: `tests/unit/metrics-open-weight-run-184.test.ts`
 *
 * Usage: tsx scripts/collect-open-weight-metrics.ts [--dry-run | --apply]
 */

import { HuggingFaceModelCollector } from "../lib/metrics-collectors/huggingface";
import { runOpenWeightCollection } from "../lib/metrics-history/collect-open-weight";
import { createOpenWeightStore } from "../lib/metrics-history/store";
import { redactConnectionString } from "./apply-migrations";

export function exitCodeFor(status: "ok" | "partial" | "failed"): number {
  if (status === "failed") return 1;
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
  const token = process.env["HF_TOKEN"];
  const { Pool } = await import("@neondatabase/serverless");
  const { drizzle } = await import("drizzle-orm/neon-serverless");
  const pool = new Pool({ connectionString: url });
  try {
    const result = await runOpenWeightCollection({
      store: createOpenWeightStore(drizzle(pool)),
      collect: (repo, signal) => new HuggingFaceModelCollector({ signal, token }).fetchModelMetrics(repo),
      dryRun,
    });
    const c = result.counts;
    console.log(
      `${dryRun ? "dry run" : "applied"}: status=${result.status} attempted=${c.attempted} recorded=${c.recorded} ` +
        `not_found=${c.not_found} failed=${c.failed} skipped_timeout=${c.skipped_timeout}`
    );
    if (result.error) console.error(`first error: ${redactConnectionString(result.error, url)}`);
    return exitCodeFor(result.status);
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
