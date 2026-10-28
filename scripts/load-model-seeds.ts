#!/usr/bin/env tsx
/**
 * Admin-only loader for the reviewed model seeds (#329).
 *
 * Why: model rows come from reviewed seed files. The first run against a database must show
 *   what it would change and write nothing; a write must be explicit, all-or-nothing, and
 *   never activate a row or change an existing row's status or metrics.
 * What: reads the selected seeds (`--seed all|closed|open-weight`, default all), validates
 *   them (`closedSeedToModelSeed`, `parseModelSeed`, one slug per row across files), plans every
 *   row against the database and prints the diff. The default is a dry run: it writes nothing
 *   and exits 0, or 1 when a row is refused. `--apply` writes every planned row in one
 *   transaction, or nothing when any row is refused. `--set-status` (needs `--seed all`) also
 *   validates `docs/refresh/model-lifecycle.json` and plans, and with `--apply` writes in the
 *   same transaction, each row's lifecycle status (active or deprecated) and `data.modelLifecycle`,
 *   then re-points the listed redirect aliases (`MODEL_REDIRECT_REPOINTS`). D0c: a lifecycle
 *   activation needs no benchmark figure.
 *   The connection string is never printed.
 * Test: `tests/unit/load-model-seeds-329.test.ts`
 *
 * Usage: tsx scripts/load-model-seeds.ts [--seed all|closed|open-weight|majors] [--dry-run | --apply] [--set-status]
 */

import fs from "node:fs";
import { resolveDatabaseUrl } from "../lib/db/database-url";
import {
  assertUniqueSlugs,
  closedSeedToModelSeed,
  type ModelSeed,
  parseModelSeed,
} from "../lib/db/repositories/model-seed.repository";
import {
  applyModelStatusPlans,
  MODEL_LIFECYCLE_FILE,
  type ModelLifecycle,
  type ModelStatusPlan,
  parseModelLifecycle,
  planModelStatus,
} from "../lib/db/repositories/model-lifecycle";
import {
  applyRedirectRepoints,
  MODEL_REDIRECT_REPOINTS,
  type RedirectRepoint,
  type RedirectRepointPlan,
  planRedirectRepoints,
} from "../lib/db/repositories/model-redirect-repoint";
import {
  applyModelSeedPlans,
  type ModelSeedDb,
  type ModelSeedEntry,
  type ModelSeedPlan,
  planModelSeedRows,
} from "../lib/db/repositories/model-seed-writer";
import { redactConnectionString } from "./apply-migrations";
import { databaseFingerprint } from "./migration-preflight";

export const SEEDS = {
  closed: { file: "docs/refresh/closed-models.json", parse: closedSeedToModelSeed },
  "open-weight": { file: "docs/refresh/open-weight-models-refresh.json", parse: parseModelSeed },
  // #329: one row per tier line and major version, plus the archived points (D05 working draft).
  majors: { file: "docs/refresh/model-majors-seed.json", parse: parseModelSeed },
} as const satisfies Record<string, { file: string; parse: (text: string) => ModelSeed }>;
export type SeedName = keyof typeof SEEDS;
export type SeedSelection = SeedName | "all";

export interface LoaderArgs {
  seed: SeedSelection;
  apply: boolean;
  /** #329: also set each row's lifecycle status; omitted when false. */
  setStatus?: true;
}

/** Reads and validates the selected seed files; throws on any bad row or a slug used twice. */
export function readModelSeeds(selection: SeedSelection, readFile: (file: string) => string): ModelSeedEntry[] {
  const names: SeedName[] = selection === "all" ? ["closed", "open-weight", "majors"] : [selection];
  const entries = names.flatMap((name) => {
    const { file, parse } = SEEDS[name];
    const seed = parse(readFile(file));
    return seed.models.map((row) => ({ row, seedFile: file, checkedAt: seed.checkedAt }));
  });
  assertUniqueSlugs(entries.map((e) => e.row));
  return entries;
}

/** #329: reads the lifecycle file and validates it against every seed row. */
export function readModelLifecycle(readFile: (file: string) => string): ModelLifecycle {
  const seedRows = readModelSeeds("all", readFile).map((e) => e.row);
  return parseModelLifecycle(readFile(MODEL_LIFECYCLE_FILE), seedRows);
}

function formatStatusPlan(plan: ModelStatusPlan, verb: "would" | "will"): string {
  if (plan.outcome === "refused") return `REFUSED status: ${plan.slug}: ${plan.reason}`;
  if (plan.outcome === "unchanged") return `status unchanged: ${plan.slug}`;
  return `${verb} set status: ${plan.slug}: ${plan.from} -> ${plan.to}`;
}

function formatPlan(plan: ModelSeedPlan, verb: "would" | "will"): string[] {
  const label = `${plan.slug} (${plan.seedFile})`;
  if (plan.outcome === "refused") return [`REFUSED: ${label}: ${plan.reason}`];
  if (plan.outcome === "unchanged") return [`unchanged: ${label}`];
  return [
    `${verb} ${plan.outcome}: ${label}`,
    ...plan.changes.map((c) => `  ${c.column}: ${c.from === null ? "(null)" : String(c.from)} -> ${String(c.to)}`),
  ];
}

/**
 * Why: the dry run is the review step; the apply must match it and be all-or-nothing.
 * What: plans every entry, prints the diff and a `totals:` line, then returns the exit code.
 *   With a `lifecycle`, it also plans each row's status (a row the seed inserts counts as
 *   inactive) and prints a `status:` line. `apply` false writes nothing (0, or 1 when a row or
 *   status is refused). `apply` true writes nothing and returns 1 when anything is refused;
 *   otherwise it writes every seed plan, then every status plan, then every redirect re-point
 *   (`repoints`, planned with a `redirects:` line), in one transaction; a guard that matches
 *   no row throws and the transaction rolls back.
 * Test: `tests/unit/load-model-seeds-329.test.ts`
 */
export async function loadModelSeeds(
  db: ModelSeedDb,
  entries: readonly ModelSeedEntry[],
  apply: boolean,
  log: (line: string) => void = console.log,
  lifecycle: ModelLifecycle | null = null,
  repoints: readonly RedirectRepoint[] = []
): Promise<number> {
  const plans = await planModelSeedRows(db, entries);
  for (const plan of plans) for (const line of formatPlan(plan, apply ? "will" : "would")) log(line);
  const count = (o: ModelSeedPlan["outcome"]) => plans.filter((p) => p.outcome === o).length;
  let refused = count("refused");
  log(
    `totals: ${plans.length} row(s), ${count("insert")} insert, ${count("update")} update, ${count("unchanged")} unchanged, ${refused} refused`
  );
  let statusPlans: ModelStatusPlan[] = [];
  if (lifecycle) {
    const inserts = new Set(plans.filter((p) => p.outcome === "insert").map((p) => p.slug));
    statusPlans = await planModelStatus(db, lifecycle, inserts);
    for (const plan of statusPlans) log(formatStatusPlan(plan, apply ? "will" : "would"));
    const set = (to: string) => statusPlans.filter((p) => p.outcome === "set" && p.to === to).length;
    const statusRefused = statusPlans.filter((p) => p.outcome === "refused").length;
    const unchanged = statusPlans.filter((p) => p.outcome === "unchanged").length;
    log(`status: ${statusPlans.length} row(s), ${set("active")} set active, ${set("deprecated")} set deprecated, ${unchanged} unchanged, ${statusRefused} refused`);
    refused += statusRefused;
  }
  let repointPlans: RedirectRepointPlan[] = [];
  if (repoints.length > 0) {
    const inserts = new Set(plans.filter((p) => p.outcome === "insert").map((p) => p.slug));
    repointPlans = await planRedirectRepoints(db, repoints, inserts);
    for (const p of repointPlans) {
      if (p.outcome === "refused") log(`REFUSED redirect: ${p.alias}: ${p.reason}`);
      else if (p.outcome === "unchanged") log(`redirect unchanged: ${p.alias}`);
      else log(`${apply ? "will" : "would"} re-point redirect: ${p.alias}: ${p.from} -> ${p.to}`);
    }
    const n = (o: RedirectRepointPlan["outcome"]) => repointPlans.filter((p) => p.outcome === o).length;
    log(`redirects: ${repointPlans.length} alias(es), ${n("repoint")} re-point, ${n("unchanged")} unchanged, ${n("refused")} refused`);
    refused += n("refused");
  }
  if (!apply) {
    log("dry run: nothing written (pass --apply to write)");
    return refused > 0 ? 1 : 0;
  }
  if (refused > 0) {
    log("apply: nothing written because a row was refused");
    return 1;
  }
  try {
    const { written, statuses, redirects } = await db.transaction(async (tx) => ({
      written: await applyModelSeedPlans(tx, plans),
      statuses: await applyModelStatusPlans(tx, statusPlans),
      redirects: await applyRedirectRepoints(tx, repointPlans),
    }));
    const statusPart = lifecycle ? `, ${statuses} status(es) set` : "";
    const redirectPart = repoints.length > 0 ? `, ${redirects} redirect(s) re-pointed` : "";
    log(`apply: committed, ${written} row(s) written${statusPart}${redirectPart}`);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`apply: rolled back, nothing written: ${redactConnectionString(message)}`);
    return 1;
  }
}

/** #329: a run with no mode flag is a dry run; only `--apply` writes. */
export function parseArgs(argv: readonly string[]): LoaderArgs | { errors: string[] } {
  const errors: string[] = [];
  let seed: SeedSelection = "all";
  let apply = false;
  let dryRun = false;
  let setStatus = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--apply") apply = true;
    else if (arg === "--dry-run") dryRun = true;
    else if (arg === "--set-status") setStatus = true;
    else if (arg === "--seed") {
      const value = argv[++i];
      if (value === "all" || value === "closed" || value === "open-weight" || value === "majors") seed = value;
      else errors.push(`--seed must be all, closed, open-weight or majors`);
    } else errors.push(`unknown argument ${arg}`);
  }
  if (apply && dryRun) errors.push("--dry-run and --apply are exclusive");
  // #329: the lifecycle covers every seed file, so the status step runs on the whole set.
  if (setStatus && seed !== "all") errors.push("--set-status needs --seed all");
  if (errors.length > 0) return { errors };
  return setStatus ? { seed, apply, setStatus: true } : { seed, apply };
}

async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const args = parseArgs(argv);
  if ("errors" in args) {
    for (const e of args.errors) console.error(`ERROR: ${e}`);
    console.error("Usage: tsx scripts/load-model-seeds.ts [--seed all|closed|open-weight|majors] [--dry-run | --apply] [--set-status]");
    return 1;
  }
  let entries: ModelSeedEntry[];
  let lifecycle: ModelLifecycle | null = null;
  try {
    entries = readModelSeeds(args.seed, (file) => fs.readFileSync(file, "utf8"));
    if (args.setStatus) lifecycle = readModelLifecycle((file) => fs.readFileSync(file, "utf8"));
  } catch (error) {
    console.error(`ERROR: seed validation failed: ${error instanceof Error ? error.message : String(error)}`);
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
  // A Pool (not neon-http): --apply needs an interactive transaction.
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
    return await loadModelSeeds(db, entries, args.apply, console.log, lifecycle, lifecycle ? MODEL_REDIRECT_REPOINTS : []);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`ERROR: load-model-seeds failed: ${redactConnectionString(message, url)}`);
    return 1;
  } finally {
    await pool.end();
  }
}

// Run only as the entrypoint, never on import.
const entrypoint = process.argv[1] ?? "";
if (/load-model-seeds\.(ts|js|mjs|cjs)$/.test(entrypoint)) {
  void main().then((code) => {
    process.exit(code);
  });
}
