/**
 * PGlite fixture for the 0024 harness input tests (#313).
 *
 * Why: 0024 must be shown against the schema the real migration files build, with tools holding
 *   the old values the source file expects, and with an articles table to count news from.
 * What: `seedOldState` writes each of the 30 tools' `data` from the source file's expected-old
 *   values (plus provenance entries for the removed parent-level fields, and three tools that
 *   must keep their own figures); `addArticle` inserts a news article; `expectedNewsCounts` is
 *   the TypeScript corpus rule (`buildToolCatalogue` + `articleToolTags`) applied to the same
 *   rows, the oracle the SQL port is held to; `apply0024` runs the file through the runner.
 * Test: used by `harness-inputs-0024-313.test.ts` and `harness-inputs-news-parity-313.test.ts`.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { type HarnessInputRow, parseHarnessInputs } from "../../../lib/db/harness-inputs";
import { HARNESS_INPUTS_MIGRATION } from "../../../lib/db/harness-inputs-sql";
import { articleToolTags, buildToolCatalogue, type CatalogueTool } from "../../../lib/news-tool-resolver";
import { runMigrations, splitStatements } from "../../../scripts/apply-migrations";
import { chainDb, MIGRATION_FILES, readMigration, REPO_ROOT } from "./migration-chain-183";
import { pgliteMigrationDb } from "./timestamptz-237-fixture";

/**
 * The audit tools with their kinds set. `chainDb` seeds tools after the files it applies, so it
 * stops before 0017 and 0017 (the kind backfill) runs here; 0018..0021 do not touch what 0024 reads.
 */
export async function kindedChainDb(): Promise<PGlite> {
  const db = await chainDb("0017_backfill_tool_kind.sql");
  for (const statement of splitStatements(readMigration("0017_backfill_tool_kind.sql"))) await db.exec(statement);
  return db;
}

export const ROWS: HarnessInputRow[] = parseHarnessInputs(
  readFileSync(path.join(REPO_ROOT, "docs/refresh/harness-inputs-2026-10.json"), "utf8")
).rows;

/** Tools that De4 (d) leaves alone even though they carry parent-level-looking figures. */
export const KEPT_TOOLS = ["replit-agent", "devin", "sourcegraph-cody"] as const;

function setPath(target: Record<string, unknown>, keys: readonly string[], value: unknown): void {
  let node = target;
  for (const key of keys.slice(0, -1)) node = (node[key] ??= {}) as Record<string, unknown>;
  node[keys[keys.length - 1] as string] = value;
}

/** The `data` a tool holds before 0024: every expected-old value in place, absent paths left out. */
export function oldData(slug: string, name: string): Record<string, unknown> {
  const data: Record<string, unknown> = { name };
  for (const row of ROWS.filter((r) => r.slug === slug && !r.expected_old_absent)) setPath(data, row.path, structuredClone(row.expected_old));
  // The package or extension a row assumes (its identity guard).
  for (const row of ROWS.filter((r) => r.slug === slug && r.identity)) setPath(data, row.identity!.path, row.identity!.value);
  // The stored provenance of a removed parent-level value (D-series pass), and one that stays.
  const fields: Record<string, unknown> = {};
  for (const row of ROWS.filter((r) => r.slug === slug && r.group === "d")) fields[row.field] = { value: row.expected_old, source: "stored", as_of: "2026-05-28" };
  if (Object.keys(fields).length > 0) data["business_metrics_provenance"] = { parent_note: "corporate-level", fields };
  return data;
}

/** Writes the old state of the 30 tools and the three kept tools. */
export async function seedOldState(db: PGlite): Promise<void> {
  for (const slug of [...new Set(ROWS.map((r) => r.slug))]) {
    const { rows } = await db.query<{ name: string }>(`SELECT name FROM public."tools" WHERE slug = $1`, [slug]);
    await db.query(`UPDATE public."tools" SET data = $2::jsonb WHERE slug = $1`, [slug, JSON.stringify(oldData(slug, rows[0]!.name))]);
  }
  // Production keeps three harness rows as redirects; the audit seed lists them as active.
  for (const [slug, to] of [["clawdbot", "openclaw"], ["moltbot", "openclaw"], ["cowork-ai", "cowork"]] as const) {
    await db.query(`UPDATE public."tools" SET status = 'redirect', data = data || $2::jsonb WHERE slug = $1`, [slug, JSON.stringify({ redirect_to: to })]);
  }
  for (const slug of KEPT_TOOLS) {
    await db.query(`UPDATE public."tools" SET data = data || $2::jsonb WHERE slug = $1`, [
      slug,
      JSON.stringify({ metrics: { valuation: 9000000000, funding: 400000000, monthly_arr: 1000000000 } }),
    ]);
  }
}

export interface SeedArticle {
  slug: string;
  title: string;
  mentions?: unknown;
  status?: string;
  daysAgo?: number;
  /** Leave published_date NULL so created_at dates the article. */
  noPublishedDate?: boolean;
}

export async function addArticle(db: PGlite, a: SeedArticle): Promise<void> {
  const at = `now() - interval '${a.daysAgo ?? 10} days'`;
  await db.query(
    `INSERT INTO public."articles" (slug, title, content, ingestion_type, tool_mentions, status, published_date, created_at)
     VALUES ($1, $2, 'body', 'text', $3::jsonb, $4, ${a.noPublishedDate ? "NULL" : at}, ${at})`,
    [a.slug, a.title, JSON.stringify(a.mentions ?? []), a.status ?? "active"]
  );
}

/** Everything in the tools table, for before/after comparison. */
export async function toolsState(db: PGlite) {
  return (await db.query(`SELECT slug, to_jsonb(t) AS row FROM public."tools" AS t ORDER BY slug`)).rows;
}

/** The TypeScript corpus rule over the database's own rows: slug -> active articles in the last 12 months. */
export async function expectedNewsCounts(db: PGlite): Promise<Record<string, number>> {
  const toolRows = (await db.query<{ id: string; slug: string; name: string; status: string; kind: string; data: Record<string, unknown> }>(
    `SELECT id, slug, name, status, kind, data FROM public."tools" ORDER BY ctid`
  )).rows;
  const tools: CatalogueTool[] = toolRows.map((t) => ({
    id: (t.data["id"] as string) || t.id,
    slug: t.slug,
    name: t.name,
    ...t.data,
    db_id: t.id,
    kind: t.kind,
    status: t.status,
    redirect_to: t.data["redirect_to"],
  })) as CatalogueTool[];
  const catalogue = buildToolCatalogue(tools);
  const articles = (await db.query<{ title: string; tool_mentions: unknown }>(
    `SELECT title, tool_mentions FROM public."articles"
      WHERE status = 'active' AND COALESCE(published_date, created_at) BETWEEN now() - interval '12 months' AND now()`
  )).rows;
  const counts: Record<string, number> = {};
  for (const article of articles) {
    for (const tag of articleToolTags({ title: article.title, toolMentions: article.tool_mentions }, catalogue)) {
      counts[tag.slug] = (counts[tag.slug] ?? 0) + 1;
    }
  }
  return counts;
}

export async function apply0024(db: PGlite, migrationDb: ReturnType<typeof pgliteMigrationDb>, force = false) {
  return runMigrations(
    { db: migrationDb, files: { list: () => [...MIGRATION_FILES], read: readMigration }, log: () => {} },
    { dryRun: false, only: HARNESS_INPUTS_MIGRATION, showColumns: null, force }
  );
}
