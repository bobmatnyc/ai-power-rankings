#!/usr/bin/env tsx
/**
 * Admin-only loader for the reviewed productivity-tool metrics (#314, D80).
 *
 * Why: D80 puts the figures for the nine productivity rows 0027 created into
 *   `docs/refresh/productivity-metrics.json` (tracked). D69: this load and migration 0033 ship in
 *   the same release step. The first run must show what it would change and write nothing; a
 *   write must be explicit and all-or-nothing, and must never change a row's status, so the two
 *   rows D80 leaves out of 0033 (gemini-app, mistral-vibe) stay inactive and unseen.
 * What: reads the file (`--metrics-file`, else `docs/refresh/productivity-metrics.json`),
 *   validates it (`parseProductivityMetrics`), plans every row and prints the per-tool diff and a
 *   `totals:` line. Default: dry run, writes nothing. `--apply` writes every update in one
 *   transaction, and writes nothing when the file is invalid or any row is refused (not one of the
 *   nine slugs, not kind productivity, or without the 0027 marker). A re-run is a no-op. The
 *   connection string is never printed.
 * Test: `tests/unit/productivity-metrics-loader-314.test.ts`
 *
 * Usage: tsx scripts/load-productivity-metrics.ts [--metrics-file <path>] [--dry-run | --apply]
 */

import fs from "node:fs";
import { resolveDatabaseUrl } from "../lib/db/database-url";
import type { ModelSeedDb } from "../lib/db/repositories/model-seed-writer";
import {
  PRODUCTIVITY_METRICS_DEFAULT_PATH,
  parseProductivityMetrics,
  type ProductivityToolEntry,
} from "../lib/db/repositories/productivity-metrics-seed";
import {
  applyProductivityPlans,
  type ProductivityPlan,
  planProductivityMetrics,
} from "../lib/db/repositories/productivity-metrics-writer";
import { redactConnectionString } from "./apply-migrations";
import { databaseFingerprint } from "./migration-preflight";

const USAGE = "Usage: tsx scripts/load-productivity-metrics.ts [--metrics-file <path>] [--dry-run | --apply]";

export interface ProductivityLoaderArgs {
  metricsFile: string;
  apply: boolean;
}

export function parseArgs(argv: readonly string[]): ProductivityLoaderArgs | { errors: string[] } {
  const errors: string[] = [];
  let metricsFile = PRODUCTIVITY_METRICS_DEFAULT_PATH;
  let apply = false;
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--apply") apply = true;
    else if (arg === "--dry-run") dryRun = true;
    else if (arg === "--metrics-file") {
      const value = argv[++i];
      if (value && !value.startsWith("--")) metricsFile = value;
      else errors.push("--metrics-file needs a path");
    } else errors.push(`unknown argument ${arg}`);
  }
  if (apply && dryRun) errors.push("--dry-run and --apply are exclusive");
  return errors.length > 0 ? { errors } : { metricsFile, apply };
}

function formatPlans(plans: readonly ProductivityPlan[], verb: "would" | "will"): string[] {
  const lines: string[] = [];
  for (const p of plans) {
    if (p.outcome === "refused") lines.push(`REFUSED: ${p.slug}: ${p.reason}`);
    else if (p.outcome === "unchanged") lines.push(`unchanged: ${p.slug}`);
    else lines.push(`${verb} update: ${p.slug}`, ...p.changes.map((c) => `  ${c.key}: ${c.from ?? "(unset)"} -> ${c.to}`));
  }
  return lines;
}

/**
 * Why: the dry run is the review step; the apply must match it and be all-or-nothing.
 * What: plans every row, prints the diff and a `totals:` line, and returns the exit code. A dry
 *   run writes nothing (0, or 1 when a row is refused). An apply writes nothing and returns 1 when
 *   any row is refused; otherwise it writes every update in one transaction. Status is never set.
 * Test: `tests/unit/productivity-metrics-loader-314.test.ts`
 */
export async function loadProductivityMetrics(
  db: ModelSeedDb,
  entries: readonly ProductivityToolEntry[],
  options: { apply: boolean },
  log: (line: string) => void = console.log
): Promise<number> {
  const plans = await planProductivityMetrics(db, entries);
  for (const line of formatPlans(plans, options.apply ? "will" : "would")) log(line);
  const count = (o: ProductivityPlan["outcome"]) => plans.filter((p) => p.outcome === o).length;
  const refused = count("refused");
  log(`totals: ${plans.length} tool(s), ${count("update")} update, ${count("unchanged")} unchanged, ${refused} refused`);
  if (!options.apply) {
    log("dry run: nothing written (pass --apply to write)");
    return refused > 0 ? 1 : 0;
  }
  // #314: fail closed; one refused row stops the whole write (D80).
  if (refused > 0) {
    log("apply: nothing written because a row was refused");
    return 1;
  }
  try {
    const written = await db.transaction((tx) => applyProductivityPlans(tx, plans));
    log(`apply: committed, ${written} tool row(s) written`);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`apply: rolled back, nothing written: ${redactConnectionString(message)}`);
    return 1;
  }
}

/**
 * Validates `text` and loads it. A validation error is logged and returns 1 before any database
 * read, so an invalid file never reaches a write.
 */
export async function runProductivityLoad(
  db: ModelSeedDb,
  text: string,
  options: { apply: boolean },
  log: (line: string) => void = console.log
): Promise<number> {
  let entries: ProductivityToolEntry[];
  try {
    entries = parseProductivityMetrics(text);
  } catch (error) {
    log(`ERROR: metrics validation failed, nothing written: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
  return loadProductivityMetrics(db, entries, options, log);
}

async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const args = parseArgs(argv);
  if ("errors" in args) {
    for (const e of args.errors) console.error(`ERROR: ${e}`);
    console.error(USAGE);
    return 1;
  }
  let text: string;
  try {
    text = fs.readFileSync(args.metricsFile, "utf8");
  } catch (error) {
    console.error(`ERROR: cannot read ${args.metricsFile}: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
  // #314: validate before connecting, so an invalid file needs no database at all.
  try {
    parseProductivityMetrics(text);
  } catch (error) {
    console.error(`ERROR: metrics validation failed, nothing written: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
  const nodeEnv = process.env["NODE_ENV"] || "development";
  const { url, variable } = resolveDatabaseUrl(process.env, nodeEnv);
  const fingerprint = databaseFingerprint(url);
  if (!url || !fingerprint) {
    console.error(`ERROR: no usable database URL for NODE_ENV=${nodeEnv}`);
    return 1;
  }
  // The workflow drops this line before its log (D19).
  console.log(`using ${variable} (NODE_ENV=${nodeEnv}), database ${fingerprint}`);
  const { Pool } = await import("@neondatabase/serverless");
  const pool = new Pool({ connectionString: url });
  const db: ModelSeedDb = {
    query: (text, params) => pool.query(text, params),
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await fn({ query: (text, params) => client.query(text, params) });
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  };
  try {
    return await runProductivityLoad(db, text, { apply: args.apply });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`ERROR: load-productivity-metrics failed: ${redactConnectionString(message, url)}`);
    return 1;
  } finally {
    await pool.end();
  }
}

// Run only as the entrypoint, never on import.
const entrypoint = process.argv[1] ?? "";
if (/load-productivity-metrics\.(ts|js|mjs|cjs)$/.test(entrypoint)) {
  void main().then((code) => {
    process.exit(code);
  });
}
