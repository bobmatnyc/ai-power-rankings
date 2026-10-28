#!/usr/bin/env tsx
/**
 * Admin-only loader for the reviewed Vals Terminal-Bench 4.0 figures of model rows (#329).
 *
 * Why: D63 writes the first model metrics, then (Q9) activates the seeded model rows in the same
 *   transaction. The first run must show what it would change and write nothing; a write must be
 *   explicit and all-or-nothing; activation is a further explicit step. The real figures are not
 *   published in this repo, so the file comes from a path outside version control.
 * What: reads the metrics file (`--metrics-file`, else `MODEL_METRICS_FILE`, else the gitignored
 *   `MODEL_METRICS_DEFAULT_PATH`), refuses a copy that git tracks, validates it against the slugs
 *   of the model seed files and the existing family allowlist, plans every row against the database and prints the diff. Default:
 *   dry run, writes nothing. `--apply` writes `data.metrics.terminal_bench` and
 *   `data.metrics_provenance.terminal_bench` in one transaction. `--activate` (only with
 *   `--apply`, and refused unless every target row (seed slugs plus the allowlist) would carry a
 *   Vals figure) also sets the inactive ones active in that transaction; an active row stays. `--hide-values` prints no figure (the public
 *   workflow log uses it). `--check-activation` (dry run only) plans the activation read-only.
 *   The connection string is never printed.
 * Test: `tests/unit/load-model-metrics-329.test.ts`
 *
 * Usage: tsx scripts/load-model-metrics.ts [--metrics-file <path>] [--dry-run [--check-activation] | --apply [--activate]] [--hide-values]
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { resolveDatabaseUrl } from "../lib/db/database-url";
import {
  MODEL_METRICS_DEFAULT_PATH,
  type ModelMetricsSeed,
  metricTargetSlugs,
  parseModelMetricsSeed,
} from "../lib/db/repositories/model-metrics-seed.repository";
import {
  applyModelMetricPlans,
  type MetricChange,
  type ModelMetricsPlan,
  planModelMetrics,
} from "../lib/db/repositories/model-metrics-writer";
import type { ModelSeedDb } from "../lib/db/repositories/model-seed-writer";
import { redactConnectionString } from "./apply-migrations";
import { dropArchivedSlugs } from "../lib/db/repositories/model-lifecycle";
import { readModelLifecycle, readModelSeeds } from "./load-model-seeds";
import { databaseFingerprint } from "./migration-preflight";

export interface MetricsLoaderArgs {
  metricsFile: string;
  apply: boolean;
  activate: boolean;
  /** Dry run only: plan the activation read-only, so its refusals show before a write. */
  checkActivation: boolean;
  hideValues: boolean;
}

export interface MetricsLoadOptions {
  apply: boolean;
  /** Seeded model slugs to activate, or null for no activation. */
  activationTargets: readonly string[] | null;
  hideValues: boolean;
}

/** #329: the metrics path: the flag, else MODEL_METRICS_FILE, else the gitignored default. */
export function parseArgs(argv: readonly string[], env: NodeJS.ProcessEnv = process.env): MetricsLoaderArgs | { errors: string[] } {
  const errors: string[] = [];
  let metricsFile = env["MODEL_METRICS_FILE"]?.trim() || MODEL_METRICS_DEFAULT_PATH;
  let apply = false;
  let dryRun = false;
  let activate = false;
  let hideValues = false;
  let checkActivation = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--apply") apply = true;
    else if (arg === "--dry-run") dryRun = true;
    else if (arg === "--activate") activate = true;
    else if (arg === "--hide-values") hideValues = true;
    else if (arg === "--check-activation") checkActivation = true;
    else if (arg === "--metrics-file") {
      const value = argv[++i];
      if (value && !value.startsWith("--")) metricsFile = value;
      else errors.push("--metrics-file needs a path");
    } else errors.push(`unknown argument ${arg}`);
  }
  if (apply && dryRun) errors.push("--dry-run and --apply are exclusive");
  // #329 D63: activation is a separate, explicit step that only rides on a write.
  if (activate && !apply) errors.push("--activate needs --apply");
  if (checkActivation && apply) errors.push("--check-activation is for a dry run; pass --activate with --apply");
  return errors.length > 0 ? { errors } : { metricsFile, apply, activate, checkActivation, hideValues };
}

/** The slice of `spawnSync` the tracked-file check uses; injectable for tests. */
export type GitSpawn = (
  command: string,
  args: string[],
  options: { encoding: "utf8"; stdio: "pipe" }
) => { status: number | null; error?: Error };

/**
 * True when git tracks `file`. Exit 1 (untracked) and 128 (the path is outside any repository,
 * as the workflow's RUNNER_TEMP file is) mean untracked.
 * #329: fails closed: a git that cannot run, or any other exit, throws instead of passing.
 */
export function isTrackedByGit(file: string, spawn: GitSpawn = spawnSync): boolean {
  const res = spawn("git", ["ls-files", "--error-unmatch", "--", file], { encoding: "utf8", stdio: "pipe" });
  if (res.error || res.status === null) throw new Error("could not run git to check that the metrics file is untracked; refusing to run");
  if (res.status === 0) return true;
  if (res.status === 1 || res.status === 128) return false;
  throw new Error(`git ls-files exited ${res.status} while checking the metrics file; refusing to run`);
}

/** #329: reads and validates the metrics file; refuses a tracked copy (the figures stay out of the repo). */
export function readModelMetrics(
  file: string,
  seedSlugs: ReadonlySet<string>,
  readFile: (file: string) => string,
  isTracked: (file: string) => boolean = isTrackedByGit
): ModelMetricsSeed {
  if (isTracked(file)) throw new Error(`${file} is tracked by git; the metrics file must stay out of version control`);
  return parseModelMetricsSeed(readFile(file), seedSlugs);
}

function changeLine(c: MetricChange, hideValues: boolean): string {
  if (hideValues && c.key === "metrics.terminal_bench") return `  ${c.key}: ${c.from === null ? "(unset)" : "(set)"} -> (new value)`;
  return `  ${c.key}: ${c.from ?? "(null)"} -> ${c.to}`;
}

function formatPlan(plan: ModelMetricsPlan, verb: "would" | "will", hideValues: boolean): string[] {
  const lines: string[] = [];
  for (const p of plan.metrics) {
    if (p.outcome === "refused") lines.push(`REFUSED: ${p.slug}: ${p.reason}`);
    else if (p.outcome === "unchanged") lines.push(`unchanged: ${p.slug}`);
    else lines.push(`${verb} update: ${p.slug}`, ...p.changes.map((c) => changeLine(c, hideValues)));
  }
  for (const a of plan.activation) {
    if (a.outcome === "refused") lines.push(`REFUSED activation: ${a.slug}: ${a.reason}`);
    else if (a.outcome === "already-active") lines.push(`already active: ${a.slug}`);
    else lines.push(`${verb} activate: ${a.slug}`);
  }
  return lines;
}

/**
 * Why: the dry run is the review step; the apply must match it and be all-or-nothing.
 * What: plans every row, prints the diff and a `totals:` line, then returns the exit code.
 *   A dry run writes nothing (0, or 1 when a row or activation is refused). An apply writes
 *   nothing and returns 1 when anything is refused; otherwise it writes the metric updates and,
 *   with activation targets, the activation, in one transaction.
 * Test: `tests/unit/load-model-metrics-329.test.ts`
 */
export async function loadModelMetrics(
  db: ModelSeedDb,
  seed: ModelMetricsSeed,
  options: MetricsLoadOptions,
  log: (line: string) => void = console.log
): Promise<number> {
  const plan = await planModelMetrics(db, seed.rows, options.activationTargets);
  for (const line of formatPlan(plan, options.apply ? "will" : "would", options.hideValues)) log(line);
  const m = (o: string) => plan.metrics.filter((p) => p.outcome === o).length;
  const a = (o: string) => plan.activation.filter((p) => p.outcome === o).length;
  const refused = m("refused") + a("refused");
  const activation = options.activationTargets
    ? `activation: ${a("activate")} activate, ${a("already-active")} already active, ${a("refused")} refused`
    : "activation: not requested";
  log(`totals: ${plan.metrics.length} metric row(s), ${m("update")} update, ${m("unchanged")} unchanged, ${m("refused")} refused; ${activation}`);
  if (!options.apply) {
    log("dry run: nothing written (pass --apply to write)");
    return refused > 0 ? 1 : 0;
  }
  if (refused > 0) {
    log("apply: nothing written because a row was refused");
    return 1;
  }
  try {
    const { written, activated } = await db.transaction((tx) => applyModelMetricPlans(tx, plan));
    log(`apply: committed, ${written} metric row(s) written, ${activated} row(s) activated`);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`apply: rolled back, nothing written: ${redactConnectionString(message)}`);
    return 1;
  }
}

async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const args = parseArgs(argv);
  if ("errors" in args) {
    for (const e of args.errors) console.error(`ERROR: ${e}`);
    console.error(
      "Usage: tsx scripts/load-model-metrics.ts [--metrics-file <path>] [--dry-run [--check-activation] | --apply [--activate]] [--hide-values]"
    );
    return 1;
  }
  let seed: ModelMetricsSeed;
  let targets: string[];
  let activationTargets: string[];
  try {
    // #329: seed-file slugs plus the existing family rows (claude-opus, claude-sonnet, grok).
    targets = metricTargetSlugs(readModelSeeds("all", (file) => fs.readFileSync(file, "utf8")).map((e) => e.row.slug));
    // #329: an archived (lifecycle deprecated) row is never an activation target.
    activationTargets = dropArchivedSlugs(targets, readModelLifecycle((file) => fs.readFileSync(file, "utf8")));
    seed = readModelMetrics(args.metricsFile, new Set(targets), (file) => fs.readFileSync(file, "utf8"));
  } catch (error) {
    console.error(`ERROR: metrics validation failed: ${error instanceof Error ? error.message : String(error)}`);
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
    return await loadModelMetrics(db, seed, {
      apply: args.apply,
      activationTargets: args.activate || args.checkActivation ? activationTargets : null,
      hideValues: args.hideValues,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`ERROR: load-model-metrics failed: ${redactConnectionString(message, url)}`);
    return 1;
  } finally {
    await pool.end();
  }
}

// Run only as the entrypoint, never on import.
const entrypoint = process.argv[1] ?? "";
if (/load-model-metrics\.(ts|js|mjs|cjs)$/.test(entrypoint)) {
  void main().then((code) => {
    process.exit(code);
  });
}
