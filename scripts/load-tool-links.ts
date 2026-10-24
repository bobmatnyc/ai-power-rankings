#!/usr/bin/env tsx
/**
 * Admin-only loader for the reviewed model <-> harness link seed (#183 B-2).
 *
 * Why: `tool_links` is maintained from a reviewed seed file, never by a collector
 *   (plan 1.3). This is the only way a seed reaches the table, and it must not leave a
 *   half-loaded seed behind.
 * What: reads a CSV (header `model_slug,harness_slug,relation,source_url`) or a JSON
 *   array of `{ model_slug, harness_slug, relation, source_url }` from the path given.
 *   Plans every row first (`planToolLink`): a refusal, or the same pair twice, is a
 *   refused row. Dry run (the default) prints each plan and exits 0. `--apply` exits 1
 *   and writes nothing if any row is refused; otherwise it writes every row in one
 *   transaction through `upsertToolLink`, so a refusal at write time rolls all back.
 *   The connection comes from DATABASE_URL and is never printed.
 * Test: `tests/unit/tool-links-repository-183.test.ts` ("load-tool-links script").
 *
 * Usage: tsx scripts/load-tool-links.ts <seed.csv|seed.json> [--dry-run | --apply]
 */

import fs from "node:fs";
import { parseCsv } from "../lib/db/tool-kind-sheet";
import {
  planToolLink,
  type ToolLinkInput,
  type ToolLinksDb,
  upsertToolLink,
} from "../lib/db/repositories/tool-links.repository";
import { redactConnectionString } from "./apply-migrations";

export interface LoadOptions {
  file: string;
  apply: boolean;
}

const USAGE = "Usage: tsx scripts/load-tool-links.ts <seed.csv|seed.json> [--dry-run | --apply]";
const CSV_HEADER = ["model_slug", "harness_slug", "relation", "source_url"];

/** Parses `<file> [--dry-run | --apply]`; dry run unless `--apply` is the only mode flag. */
export function parseArgs(argv: string[]): { options: LoadOptions | null; errors: string[] } {
  const errors: string[] = [];
  const files = argv.filter((a) => !a.startsWith("--"));
  const flags = argv.filter((a) => a.startsWith("--"));
  for (const flag of flags) if (flag !== "--dry-run" && flag !== "--apply") errors.push(`unknown flag ${flag}`);
  if (flags.includes("--dry-run") && flags.includes("--apply")) errors.push("--dry-run and --apply are exclusive");
  if (files.length !== 1) errors.push("pass exactly one seed file path");
  if (errors.length > 0) return { options: null, errors };
  return { options: { file: files[0] as string, apply: flags.includes("--apply") }, errors };
}

/**
 * Turns seed file text into link inputs. Throws on a file that is not a seed at all
 * (bad header, not a JSON array, a non-object entry); field values are checked later.
 */
export function parseSeed(file: string, text: string): ToolLinkInput[] {
  if (file.toLowerCase().endsWith(".json")) {
    const data: unknown = JSON.parse(text);
    if (!Array.isArray(data)) throw new Error("JSON seed must be an array of link objects");
    return data.map((entry, i) => {
      if (typeof entry !== "object" || entry === null) throw new Error(`JSON seed entry ${i} is not an object`);
      const e = entry as Record<string, unknown>;
      const str = (v: unknown) => (typeof v === "string" ? v : "");
      return {
        modelSlug: str(e["model_slug"]),
        harnessSlug: str(e["harness_slug"]),
        relation: str(e["relation"]),
        sourceUrl: typeof e["source_url"] === "string" && e["source_url"] !== "" ? e["source_url"] : null,
      };
    });
  }
  const [header, ...body] = parseCsv(text);
  if (!header || header.join(",") !== CSV_HEADER.join(",")) {
    throw new Error(`CSV header must be ${CSV_HEADER.join(",")}`);
  }
  return body.map(([modelSlug = "", harnessSlug = "", relation = "", sourceUrl = ""]) => ({
    modelSlug: modelSlug.trim(),
    harnessSlug: harnessSlug.trim(),
    relation: relation.trim(),
    sourceUrl: sourceUrl.trim() === "" ? null : sourceUrl.trim(),
  }));
}

/**
 * Plans every row, then writes all of them in one transaction or none.
 *
 * Why: "validate all rows first, then write" (B-2): a seed with one bad row must leave
 *   the table as it was.
 * What: returns the exit code: 0 for a dry run, or an apply that wrote; 1 when `apply`
 *   and any row is refused (nothing written), or when a write-time refusal rolled the
 *   transaction back.
 * Test: `tests/unit/tool-links-repository-183.test.ts` ("load-tool-links script").
 */
export async function loadToolLinks(
  db: ToolLinksDb,
  rows: ToolLinkInput[],
  apply: boolean,
  log: (line: string) => void = console.log
): Promise<number> {
  const seen = new Set<string>();
  let refused = 0;
  for (const [i, row] of rows.entries()) {
    const label = `row ${i + 1} ${row.modelSlug} -> ${row.harnessSlug} (${row.relation})`;
    const pair = JSON.stringify([row.modelSlug, row.harnessSlug]);
    const plan = seen.has(pair)
      ? ({ ok: false, error: new Error("the same pair appears earlier in the seed") } as const)
      : await planToolLink(db, row);
    seen.add(pair);
    if (plan.ok) {
      log(`${apply ? "will" : "would"} ${plan.outcome === "inserted" ? "insert" : plan.outcome === "updated" ? "update" : "leave unchanged"}: ${label}`);
    } else {
      refused++;
      log(`REFUSED: ${label}: ${plan.error.message}`);
    }
  }
  log(`${rows.length} row(s), ${refused} refused`);
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
      for (const row of rows) await upsertToolLink(tx, row);
    });
  } catch (error) {
    // #183: same redaction as main's outer catch, so a driver error never prints raw.
    const message = error instanceof Error ? error.message : String(error);
    log(`--apply: rolled back, nothing written: ${redactConnectionString(message)}`);
    return 1;
  }
  log(`--apply: wrote ${rows.length} row(s)`);
  return 0;
}

async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const { options, errors } = parseArgs(argv);
  if (!options) {
    for (const e of errors) console.error(`ERROR: ${e}`);
    console.error(USAGE);
    return 1;
  }
  const url = process.env["DATABASE_URL"];
  if (!url) {
    console.error("ERROR: DATABASE_URL is not set");
    return 1;
  }
  // #183: a Pool (not neon-http) because --apply needs an interactive transaction.
  const { Pool } = await import("@neondatabase/serverless");
  const { drizzle } = await import("drizzle-orm/neon-serverless");
  const pool = new Pool({ connectionString: url });
  try {
    const rows = parseSeed(options.file, fs.readFileSync(options.file, "utf8"));
    return await loadToolLinks(drizzle(pool), rows, options.apply);
  } catch (error) {
    // #183: never let a driver error carry the connection string into the output.
    const message = error instanceof Error ? error.message : String(error);
    console.error(`ERROR: load-tool-links failed: ${redactConnectionString(message, url)}`);
    return 1;
  } finally {
    await pool.end();
  }
}

// Run only as the entrypoint, never on import (same guard as apply-migrations.ts).
const entrypoint = process.argv[1] ?? "";
if (/load-tool-links\.(ts|js|mjs|cjs)$/.test(entrypoint)) {
  void main().then((code) => {
    process.exit(code);
  });
}
