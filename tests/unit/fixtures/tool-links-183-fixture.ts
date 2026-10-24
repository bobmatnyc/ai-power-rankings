/**
 * PGlite fixture for the #183 tool_links tests.
 *
 * Why: the kind rule, the upsert and the ordering are Postgres behaviour; PGlite runs
 *   real Postgres in WASM with no server, no network and no credentials.
 * What: `TOOLS_AT_0015` is `tools` as lib/db/schema.ts declared it after 0015.
 *   `linkedDb` builds it, inserts the given tools, applies 0016 statement by statement,
 *   sets each tool's kind and status, and wraps the instance in Drizzle.
 * Test: used by tests/unit/tool-kind-links-pglite-183.test.ts and
 *   tests/unit/tool-links-repository-183.test.ts.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { splitStatements } from "../../../scripts/apply-migrations";

export const MIGRATION_0016_SQL = readFileSync(
  path.resolve(__dirname, "../../../lib/db/migrations/0016_add_tool_kind_and_links.sql"),
  "utf8"
);

export const TOOLS_AT_0015 = `CREATE TABLE public."tools" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "category" text NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "company_id" text,
  "baseline_score" jsonb DEFAULT '{}',
  "delta_score" jsonb DEFAULT '{}',
  "current_score" jsonb DEFAULT '{}',
  "score_updated_at" timestamptz,
  "data" jsonb DEFAULT '{}' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
)`;

export interface FixtureTool {
  slug: string;
  name: string;
  kind: "model" | "harness" | "productivity" | "other";
  status?: string;
}

/** A PGlite database at 0016 holding `rows`, plus its Drizzle wrapper. */
export async function linkedDb(rows: FixtureTool[]) {
  const pg = new PGlite();
  await pg.exec(TOOLS_AT_0015);
  for (const statement of splitStatements(MIGRATION_0016_SQL)) await pg.exec(statement);
  for (const t of rows) {
    await pg.query(`INSERT INTO public."tools" (slug, name, category, kind, status) VALUES ($1, $2, 'other', $3, $4)`, [
      t.slug,
      t.name,
      t.kind,
      t.status ?? "active",
    ]);
  }
  return { pg, db: drizzle(pg) };
}
