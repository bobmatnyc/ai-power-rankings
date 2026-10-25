#!/usr/bin/env tsx
/**
 * Admin CLI for the D90 merge of the seven duplicate tool rows.
 *
 * Why: D90 — back up, dry run, review, then apply, before the 11-01 ranking regenerate.
 *   The dry run and backup must run under a read-only database role.
 * What: three modes over `scripts/duplicate-tool-merge*.ts`.
 *   - `--backup <file>`: SELECT-only export to a new local JSON file (never overwrites).
 *   - default / `--dry-run`: SELECT-only plan report; exits 1 when a pair is unresolved.
 *   - `--apply <backup-file>`: one transaction; refused without a fresh backup of the
 *     same database. A re-run is a no-op.
 *   Dry run and backup send every statement through `assertReadOnlySql`, open no
 *   transaction, and write nothing. The connection string is chosen by the connection
 *   module's rules (`resolveDatabaseUrl`, NODE_ENV), is never printed, and no `.env`
 *   file is read. Output names slugs and counts only.
 * Test: `tests/unit/duplicate-tool-merge-d90.test.ts` ("CLI").
 *
 * Usage: tsx scripts/merge-duplicate-tools.ts [--dry-run | --backup <file> | --apply <backup-file>]
 */

import fs from "node:fs";
import { applyMerge, checkBackup, MergeRefusedError, takeBackup } from "./duplicate-tool-merge-apply";
import { derivePairs, formatPlan, loadMergeState, type MergeDb, planMerge, type Queryable } from "./duplicate-tool-merge";
import { resolveDatabaseUrl } from "../lib/db/database-url";
import { redactConnectionString } from "./apply-migrations";
import { assertReadOnlySql, databaseFingerprint } from "./migration-preflight";

export type MergeMode = { mode: "dry-run" } | { mode: "backup"; file: string } | { mode: "apply"; backupFile: string };

const USAGE = "Usage: tsx scripts/merge-duplicate-tools.ts [--dry-run | --backup <file> | --apply <backup-file>]";

/** Parses the one mode flag; `--backup` and `--apply` each take a path. */
export function parseArgs(argv: string[]): { mode: MergeMode | null; errors: string[] } {
  const errors: string[] = [];
  const modes: MergeMode[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--dry-run") modes.push({ mode: "dry-run" });
    else if (arg === "--backup" || arg === "--apply") {
      if (!next || next.startsWith("--")) errors.push(`${arg} needs a file path`);
      else modes.push(arg === "--backup" ? { mode: "backup", file: next } : { mode: "apply", backupFile: next });
      i++;
    } else errors.push(`unknown argument ${arg}`);
  }
  if (modes.length > 1) errors.push("pass one mode only");
  if (errors.length > 0) return { mode: null, errors };
  return { mode: modes[0] ?? { mode: "dry-run" }, errors };
}

/** Wraps a connection so every statement must be a single SELECT (dry run, backup). */
export function readOnly(q: Queryable): Queryable {
  return {
    query(text, params) {
      assertReadOnlySql(text);
      return q.query(text, params);
    },
  };
}

export interface RunDeps {
  db: MergeDb;
  fingerprint: string;
  log?: (line: string) => void;
  now?: () => Date;
}

/**
 * Runs one mode and returns the exit code: 0 done, 1 unresolved, refused or failed.
 * Test: `tests/unit/duplicate-tool-merge-d90.test.ts` ("CLI").
 */
export async function runMerge(deps: RunDeps, mode: MergeMode): Promise<number> {
  const log = deps.log ?? console.log;
  const now = deps.now ?? (() => new Date());
  const pairs = derivePairs();

  if (mode.mode === "backup") {
    const backup = await takeBackup(readOnly(deps.db), pairs, deps.fingerprint, now());
    fs.writeFileSync(mode.file, `${JSON.stringify(backup, null, 2)}\n`, { flag: "wx" });
    log(
      `backup: wrote ${mode.file}: ${backup.tools.length} tools, ${backup.tool_links.length} tool_links, ` +
        `${backup.tool_metrics_history.length} tool_metrics_history row(s)`
    );
    return 0;
  }

  if (mode.mode === "dry-run") {
    const plan = planMerge(pairs, await loadMergeState(readOnly(deps.db), pairs));
    for (const line of formatPlan(plan)) log(line);
    log("dry run: nothing written (pass --apply <backup-file> to write)");
    return plan.totals.unresolved > 0 ? 1 : 0;
  }

  if (!fs.existsSync(mode.backupFile)) {
    log(`--apply: refused, no backup file at ${mode.backupFile}; run --backup first`);
    return 1;
  }
  const raw = fs.readFileSync(mode.backupFile, "utf8");
  try {
    const plan = await applyMerge(deps.db, pairs, (p) => checkBackup(raw, deps.fingerprint, p, now()));
    for (const line of formatPlan(plan, "will")) log(line);
    log(`--apply: committed (${plan.pairs.every((p) => p.state === "already-merged") ? "no-op, already merged" : "merged"})`);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`--apply: ${error instanceof MergeRefusedError ? "refused" : "rolled back"}, nothing written: ${redactConnectionString(message)}`);
    return 1;
  }
}

async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const { mode, errors } = parseArgs(argv);
  if (!mode) {
    for (const e of errors) console.error(`ERROR: ${e}`);
    console.error(USAGE);
    return 1;
  }
  const nodeEnv = process.env["NODE_ENV"] || "development";
  const { url, variable } = resolveDatabaseUrl(process.env, nodeEnv);
  const fingerprint = databaseFingerprint(url);
  if (!url || !fingerprint) {
    console.error(`ERROR: no usable database URL for NODE_ENV=${nodeEnv}`);
    return 1;
  }
  console.log(`using ${variable} (NODE_ENV=${nodeEnv}), database ${fingerprint}`);
  // A Pool (not neon-http): --apply needs an interactive transaction.
  const { Pool } = await import("@neondatabase/serverless");
  const pool = new Pool({ connectionString: url });
  const db: MergeDb = {
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
    return await runMerge({ db, fingerprint }, mode);
  } catch (error) {
    // Never let a driver error carry the connection string into the output.
    const message = error instanceof Error ? error.message : String(error);
    console.error(`ERROR: merge-duplicate-tools failed: ${redactConnectionString(message, url)}`);
    return 1;
  } finally {
    await pool.end();
  }
}

// Run only as the entrypoint, never on import (same guard as apply-migrations.ts).
const entrypoint = process.argv[1] ?? "";
if (/merge-duplicate-tools\.(ts|js|mjs|cjs)$/.test(entrypoint)) {
  void main().then((code) => {
    process.exit(code);
  });
}
