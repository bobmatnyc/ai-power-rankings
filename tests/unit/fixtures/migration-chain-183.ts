/**
 * PGlite fixture: the on-disk migration chain 0000..0016, seeded, ready for 0017 (#183).
 *
 * Why: the 0017 backfill must be proven against the schema the real files build, not a
 *   hand-written `tools` table, and against production-shaped rows: the 114 active tools
 *   of the #177 audit (taken from production), plus tools outside the sheet.
 * What: `MIGRATION_FILES` lists `lib/db/migrations/*.sql` in name order. `chainDb` applies
 *   every file before `upTo` statement by statement with the runner's own
 *   `splitStatements`, after one bridge: `automated_ingestion_runs` is created by files
 *   that are not in the repository (0002..0011), so 0012 and 0013 get a stub of it, and
 *   the tools scoring columns of the journal's 0003 (not on disk; D91's 0019 copies them). It
 *   inserts the audit's tools (slug, name, category; `kind` keeps the 0016 default) and
 *   `EXTRA_TOOLS`, minus `omit`. 0015 runs as plain statements here: its preflight gate
 *   is about production, and `tests/unit/timestamptz-237-preflight.test.ts` covers it.
 * Test: used by `tests/unit/tool-kind-backfill-0017-183.test.ts` and the local dry run.
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { parseCsv } from "../../../lib/db/tool-kind-sheet";
import { MIGRATION_FILE_PATTERN, MIGRATIONS_DIR, splitStatements } from "../../../scripts/apply-migrations";

export const REPO_ROOT = path.resolve(__dirname, "../../..");
const DIR = path.join(REPO_ROOT, MIGRATIONS_DIR);

export const MIGRATION_FILES: readonly string[] = readdirSync(DIR)
  .filter((name) => MIGRATION_FILE_PATTERN.test(name))
  .sort();

export function readMigration(file: string): string {
  return readFileSync(path.join(DIR, file), "utf8");
}

/** Created by migrations absent from the repository; 0012 and 0013 only add columns to it. */
const BRIDGE_BEFORE_0012 = `CREATE TABLE IF NOT EXISTS public."automated_ingestion_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
)`;

/** D91: the four tools scoring columns of 0003_add_scoring_columns, as production has them. */
const BRIDGE_SCORING_0003 = `ALTER TABLE public."tools"
  ADD COLUMN IF NOT EXISTS "baseline_score" jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "delta_score" jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "current_score" jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "score_updated_at" timestamp`;

/** Tools outside the sheet: production holds rows the active-tool audit did not list. */
export const EXTRA_TOOLS = [
  { slug: "legacy-inactive-tool", name: "Legacy Inactive Tool", category: "ide-assistant", status: "inactive" },
  { slug: "unreviewed-new-tool", name: "Unreviewed New Tool", category: "other", status: "active" },
] as const;

export interface SeedTool {
  slug: string;
  name: string;
  category: string;
  status: string;
}

/** The audit's active tools, as production-shaped seed rows. */
export function auditSeedTools(): SeedTool[] {
  const [header, ...body] = parseCsv(readFileSync(path.join(REPO_ROOT, "docs/refresh/content-ia-audit.csv"), "utf8"));
  const col = (name: string) => header!.indexOf(name);
  return body
    .filter((r) => r[col("type")] === "tool")
    .map((r) => ({
      slug: r[col("slug")] as string,
      name: r[col("name")] as string,
      category: r[col("kind_or_category")] as string,
      status: "active",
    }));
}

/** A PGlite database with every migration file before `upTo` applied and the seed inserted. */
export async function chainDb(upTo: string, omit: readonly string[] = []): Promise<PGlite> {
  const db = new PGlite();
  for (const file of MIGRATION_FILES.filter((f) => f < upTo)) {
    if (file.startsWith("0012")) await db.exec(`${BRIDGE_BEFORE_0012}; ${BRIDGE_SCORING_0003}`);
    for (const statement of splitStatements(readMigration(file))) await db.exec(statement);
  }
  for (const t of [...auditSeedTools(), ...EXTRA_TOOLS].filter((t) => !omit.includes(t.slug))) {
    await db.query(
      `INSERT INTO public."tools" (slug, name, category, status, data, updated_at)
       VALUES ($1, $2, $3, $4, jsonb_build_object('name', $2::text), '2026-01-01T00:00:00Z')`,
      [t.slug, t.name, t.category, t.status]
    );
  }
  return db;
}
