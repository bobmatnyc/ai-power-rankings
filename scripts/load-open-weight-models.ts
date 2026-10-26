#!/usr/bin/env tsx
/**
 * Admin-only loader for the reviewed open-weight model seed (#184).
 *
 * Why: the open-weight `tools` rows come from a reviewed seed, not from a collector, and a
 *   bad row must not leave a half-loaded seed behind.
 * What: reads the seed JSON, plans every row (`planOpenWeightRow`), and prints each plan.
 *   Dry run (the default) writes nothing and exits 0. `--apply` exits 1 and writes nothing
 *   if any row is refused; otherwise it writes every row in one transaction. New rows are
 *   created `inactive`. The connection comes from DATABASE_URL and is never printed.
 * Test: `tests/unit/open-weight-seed-184.test.ts`
 *
 * Usage: tsx scripts/load-open-weight-models.ts [seed.json] [--dry-run | --apply]
 *   (default seed: docs/refresh/open-weight-models.json)
 */

import fs from "node:fs";
import {
  applyOpenWeightRow,
  type OpenWeightSeed,
  type OpenWeightSeedDb,
  parseOpenWeightSeed,
  planOpenWeightRow,
} from "../lib/db/repositories/open-weight-seed.repository";
import { redactConnectionString } from "./apply-migrations";

export const DEFAULT_SEED = "docs/refresh/open-weight-models.json";

/** Plans every row, then writes all of them in one transaction or none. Returns the exit code. */
export async function loadOpenWeightModels(
  db: OpenWeightSeedDb,
  seed: OpenWeightSeed,
  apply: boolean,
  log: (line: string) => void = console.log
): Promise<number> {
  const plans = [];
  let refused = 0;
  const seen = new Set<string>();
  for (const [i, row] of seed.models.entries()) {
    const label = `row ${i + 1} ${row.slug}`;
    const plan = seen.has(row.slug)
      ? ({ ok: false, error: new Error("the same slug appears earlier in the seed") } as const)
      : await planOpenWeightRow(db, row);
    seen.add(row.slug);
    plans.push(plan);
    if (plan.ok) log(`${apply ? "will" : "would"} ${plan.outcome}: ${label}`);
    else {
      refused++;
      log(`REFUSED: ${label}: ${plan.error.message}`);
    }
  }
  log(`${seed.models.length} row(s), ${refused} refused`);
  if (!apply) {
    log("dry run: nothing written (pass --apply to write)");
    return 0;
  }
  if (refused > 0) {
    log("--apply: nothing written because a row was refused");
    return 1;
  }
  try {
    await db.transaction(async (tx) => {
      for (const [i, row] of seed.models.entries()) {
        const plan = plans[i];
        if (plan?.ok) await applyOpenWeightRow(tx, row, plan, seed);
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`--apply: rolled back, nothing written: ${redactConnectionString(message)}`);
    return 1;
  }
  log(`--apply: wrote ${seed.models.length} row(s)`);
  return 0;
}

export function parseArgs(argv: string[]): { file: string; apply: boolean } | { errors: string[] } {
  const errors: string[] = [];
  const files = argv.filter((a) => !a.startsWith("--"));
  const flags = argv.filter((a) => a.startsWith("--"));
  for (const flag of flags) if (flag !== "--dry-run" && flag !== "--apply") errors.push(`unknown flag ${flag}`);
  if (flags.includes("--dry-run") && flags.includes("--apply")) errors.push("--dry-run and --apply are exclusive");
  if (files.length > 1) errors.push("pass at most one seed file path");
  if (errors.length > 0) return { errors };
  return { file: files[0] ?? DEFAULT_SEED, apply: flags.includes("--apply") };
}

async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const args = parseArgs(argv);
  if ("errors" in args) {
    for (const e of args.errors) console.error(`ERROR: ${e}`);
    console.error("Usage: tsx scripts/load-open-weight-models.ts [seed.json] [--dry-run | --apply]");
    return 1;
  }
  const url = process.env["DATABASE_URL"];
  if (!url) {
    console.error("ERROR: DATABASE_URL is not set");
    return 1;
  }
  const { Pool } = await import("@neondatabase/serverless");
  const { drizzle } = await import("drizzle-orm/neon-serverless");
  const pool = new Pool({ connectionString: url });
  try {
    const seed = parseOpenWeightSeed(fs.readFileSync(args.file, "utf8"));
    return await loadOpenWeightModels(drizzle(pool), seed, args.apply);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`ERROR: load-open-weight-models failed: ${redactConnectionString(message, url)}`);
    return 1;
  } finally {
    await pool.end();
  }
}

// Run only as the entrypoint, never on import.
const entrypoint = process.argv[1] ?? "";
if (/load-open-weight-models\.(ts|js|mjs|cjs)$/.test(entrypoint)) {
  void main().then((code) => {
    process.exit(code);
  });
}
