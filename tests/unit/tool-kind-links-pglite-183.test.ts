/**
 * #183: migration 0016 and the 0017 backfill on real Postgres (PGlite).
 *
 * Why: the CHECKs, the cascade, the partial index, the no-rewrite claim and the re-run
 *   no-op are catalog and executor behaviour the in-memory MigrationDb double cannot show
 *   (plan 1.7 criteria 1, 5, 6, 7, 9; 1.8 integration).
 * What: builds `tools` as it stands after 0015, with rows, and applies 0016 through
 *   `runMigrations --only` over PGlite. Asserts each constraint refuses its bad row, the
 *   link rows cascade, `TOOL_LINK_KIND_VIOLATIONS_SQL` finds both kinds of wrong-sided link
 *   (no trigger, Q-A5), a forced re-run changes nothing and records no second row, the
 *   table is not rewritten, and a backfill built from a fixture sheet sets the kinds once.
 * Test: `npx vitest run tests/unit/tool-kind-links-pglite-183.test.ts`. No server, no network.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildKindBackfillSql, KIND_COUNT_SQL, parseKindSheet } from "../../lib/db/tool-kind-sheet";
import { TOOL_LINK_KIND_VIOLATIONS_SQL } from "../../lib/db/tool-links";
import { runMigrations, splitStatements } from "../../scripts/apply-migrations";
import { pgliteMigrationDb, relfilenodes } from "./fixtures/timestamptz-237-fixture";

const FILE = "0016_add_tool_kind_and_links.sql";
const SQL_TEXT = readFileSync(path.resolve(__dirname, "../../lib/db/migrations", FILE), "utf8");
const PRIOR = ["0014_add_tool_metrics_history.sql", "0015_timestamptz_utc.sql"];

// `tools` as lib/db/schema.ts declared it after 0015, before 0016.
const TOOLS_AT_0015 = `CREATE TABLE public."tools" (
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
const SLUGS = ["claude-code", "opus-4-6", "opus-4-5", "cursor", "anthropic"];

async function apply(db: PGlite, migrationDb: ReturnType<typeof pgliteMigrationDb>, force = false) {
  return runMigrations(
    { db: migrationDb, files: { list: () => [...PRIOR, FILE], read: () => SQL_TEXT }, log: () => {} },
    { dryRun: false, only: FILE, showColumns: null, force }
  );
}

async function catalogState(db: PGlite) {
  const q = async (sql: string) => (await db.query(sql)).rows;
  return {
    columns: await q(`SELECT table_name, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns WHERE table_schema = 'public' ORDER BY 1, 2`),
    constraints: await q(`SELECT conrelid::regclass::text AS t, conname, pg_get_constraintdef(oid) AS def
      FROM pg_constraint WHERE connamespace = 'public'::regnamespace ORDER BY 1, 2`),
    indexes: await q(`SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' ORDER BY 1`),
    rows: await q(`SELECT slug, kind, updated_at::text FROM public."tools" ORDER BY slug`),
  };
}

async function toolId(db: PGlite, slug: string): Promise<string> {
  return (await db.query<{ id: string }>(`SELECT id FROM public."tools" WHERE slug = $1`, [slug])).rows[0]!.id;
}

async function link(db: PGlite, model: string, harness: string, relation = "native") {
  await db.query(
    `INSERT INTO public."tool_links" (model_tool_id, harness_tool_id, relation) VALUES ($1, $2, $3)`,
    [await toolId(db, model), await toolId(db, harness), relation]
  );
}

describe("#183 migration 0016 on PGlite", () => {
  let db: PGlite;
  let migrationDb: ReturnType<typeof pgliteMigrationDb>;
  let before: Record<string, number>;
  let firstRun: Awaited<ReturnType<typeof apply>>;

  beforeAll(async () => {
    db = new PGlite();
    await db.exec(TOOLS_AT_0015);
    for (const slug of SLUGS) {
      await db.query(`INSERT INTO public."tools" (slug, name, category, updated_at) VALUES ($1, $1, 'other', '2026-01-01T00:00:00Z')`, [slug]);
    }
    migrationDb = pgliteMigrationDb(db);
    before = await relfilenodes(db);
    firstRun = await apply(db, migrationDb);
    // Kinds as the reviewed sheet would set them; 0017 does this in production.
    await db.exec(`UPDATE public."tools" SET kind = 'model' WHERE slug IN ('opus-4-6', 'opus-4-5');
      UPDATE public."tools" SET kind = 'other', subcategory = 'company' WHERE slug = 'anthropic'`);
  });
  afterAll(async () => {
    await db.close();
  });

  it("applies all twelve statements, records the file once, and does not rewrite tools", async () => {
    expect(firstRun.exitCode).toBe(0);
    expect(migrationDb.executed).toEqual(splitStatements(SQL_TEXT));
    expect(await migrationDb.listAppliedFilenames()).toEqual([FILE]);
    expect((await relfilenodes(db)).tools).toBe(before.tools);
  });

  it("defaults kind to harness on existing rows and refuses kind='banana' (criterion 1)", async () => {
    const rows = (await db.query<{ kind: string }>(`SELECT kind FROM public."tools" WHERE slug = 'cursor'`)).rows;
    expect(rows).toEqual([{ kind: "harness" }]);
    await expect(db.query(`UPDATE public."tools" SET kind = 'banana' WHERE slug = 'cursor'`)).rejects.toThrow(/tools_kind_check/);
    await expect(db.query(`UPDATE public."tools" SET kind = NULL WHERE slug = 'cursor'`)).rejects.toThrow(/null value/);
  });

  it("refuses a subcategory that is not an underscore slug", async () => {
    await expect(db.query(`UPDATE public."tools" SET subcategory = 'app-builder' WHERE slug = 'cursor'`)).rejects.toThrow(
      /tools_subcategory_check/
    );
    await db.query(`UPDATE public."tools" SET subcategory = 'app_builder' WHERE slug = 'cursor'`);
    await db.query(`UPDATE public."tools" SET subcategory = NULL WHERE slug = 'cursor'`);
  });

  it("allows open_weight only on a model (criterion 5)", async () => {
    await expect(db.query(`UPDATE public."tools" SET open_weight = true WHERE slug = 'cursor'`)).rejects.toThrow(
      /tools_open_weight_check/
    );
    await expect(db.query(`UPDATE public."tools" SET open_weight = false WHERE slug = 'cursor'`)).rejects.toThrow(
      /tools_open_weight_check/
    );
    await db.query(`UPDATE public."tools" SET open_weight = false WHERE slug = 'opus-4-6'`);
    await db.query(`UPDATE public."tools" SET open_weight = NULL WHERE slug = 'opus-4-6'`);
  });

  it("creates the partial open-weight index and timestamptz link timestamps (criterion 9)", async () => {
    const { indexes, columns } = await catalogState(db);
    const def = (indexes as Array<{ indexname: string; indexdef: string }>).find((i) => i.indexname === "tools_open_weight_idx");
    expect(def?.indexdef).toMatch(/\(open_weight\) WHERE \(kind = 'model'::text\)$/);
    const ts = (columns as Array<{ table_name: string; column_name: string; data_type: string }>).filter(
      (c) => c.table_name === "tool_links" && c.column_name.endsWith("_at")
    );
    expect(ts.map((c) => [c.column_name, c.data_type])).toEqual([
      ["created_at", "timestamp with time zone"],
      ["updated_at", "timestamp with time zone"],
    ]);
  });

  it("refuses a duplicate pair, a self-link and an unknown relation (criterion 6)", async () => {
    await link(db, "opus-4-6", "claude-code");
    await expect(link(db, "opus-4-6", "claude-code", "supports")).rejects.toThrow(/tool_links_model_harness_idx/);
    await expect(link(db, "opus-4-6", "opus-4-6")).rejects.toThrow(/tool_links_no_self_link_check/);
    await expect(link(db, "opus-4-6", "cursor", "runs")).rejects.toThrow(/tool_links_relation_check/);
    await link(db, "opus-4-6", "cursor", "supports");
  });

  it("finds wrong-sided links with the test query, since no trigger refuses them (Q-A5)", async () => {
    expect((await db.query(TOOL_LINK_KIND_VIOLATIONS_SQL)).rows).toEqual([]);
    await link(db, "cursor", "claude-code"); // model side is a harness
    await link(db, "opus-4-5", "opus-4-6"); // harness side is a model
    await link(db, "opus-4-6", "anthropic"); // harness side is a vendor row (kind 'other'), not a harness
    const found = (await db.query<{ model_kind: string; harness_kind: string }>(TOOL_LINK_KIND_VIOLATIONS_SQL)).rows;
    expect(found.map((r) => [r.model_kind, r.harness_kind]).sort()).toEqual([
      ["harness", "harness"],
      ["model", "model"],
      ["model", "other"],
    ]);
    await db.exec(`DELETE FROM public."tool_links" WHERE model_tool_id IN (SELECT id FROM public."tools" WHERE slug IN ('cursor', 'opus-4-5'))
      OR harness_tool_id = (SELECT id FROM public."tools" WHERE slug = 'anthropic')`);
    expect((await db.query(TOOL_LINK_KIND_VIOLATIONS_SQL)).rows).toEqual([]);
  });

  it("deletes a tool's link rows with the tool, on either side (criterion 6)", async () => {
    const count = async () => (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public."tool_links"`)).rows[0]!.n;
    expect(await count()).toBe(2);
    await db.query(`DELETE FROM public."tools" WHERE slug = 'cursor'`);
    expect(await count()).toBe(1);
    await db.query(`DELETE FROM public."tools" WHERE slug = 'opus-4-6'`);
    expect(await count()).toBe(0);
  });

  it("a forced second run changes nothing and records no second row (criterion 7)", async () => {
    const state = await catalogState(db);
    const nodes = await relfilenodes(db);
    expect((await apply(db, migrationDb)).exitCode).toBe(1); // --only refuses an applied file
    const again = await apply(db, migrationDb, true);
    expect(again.exitCode).toBe(0);
    expect(await catalogState(db)).toEqual(state);
    expect(await relfilenodes(db)).toEqual(nodes);
    expect(await migrationDb.listAppliedFilenames()).toEqual([FILE]);
  });
});

describe("#183 the 0017 backfill on PGlite", () => {
  const SHEET = [
    "slug,kind,subcategory,open_weight,retired,survivor,confidence,note",
    "claude-code,harness,autonomous_agent,,false,,normal,",
    "opus-4-6,model,,false,false,,normal,",
    "opus-4-5,model,,,true,opus-4-6,normal,",
    "anthropic,other,company,,false,,normal,",
    "not-in-db,harness,,,false,,low,",
  ].join("\n");

  it("sets the sheet's kinds, leaves updated_at alone, and is a no-op on re-run", async () => {
    const db = new PGlite();
    await db.exec(TOOLS_AT_0015);
    for (const slug of [...SLUGS, "aider"]) {
      await db.query(`INSERT INTO public."tools" (slug, name, category, updated_at) VALUES ($1, $1, 'other', '2026-01-01T00:00:00Z')`, [slug]);
    }
    for (const statement of splitStatements(SQL_TEXT)) await db.exec(statement);
    const { rows, errors } = parseKindSheet(SHEET);
    expect(errors).toEqual([]);
    const backfill = splitStatements(buildKindBackfillSql(rows));
    expect(backfill).toHaveLength(1);

    const counts = async () => (await db.query<{ kind: string; n: number }>(KIND_COUNT_SQL)).rows;
    expect(await counts()).toEqual([{ kind: "harness", n: 6 }]);
    const first = await db.query(backfill[0] as string);
    expect(first.affectedRows).toBe(4); // claude-code, opus-4-6, opus-4-5, anthropic
    expect(await counts()).toEqual([
      { kind: "harness", n: 3 }, // claude-code, cursor and aider (not in the sheet)
      { kind: "model", n: 2 },
      { kind: "other", n: 1 },
    ]);
    const row = (
      await db.query(`SELECT kind, subcategory, open_weight, updated_at = '2026-01-01T00:00:00Z'::timestamptz AS kept FROM public."tools" WHERE slug = 'opus-4-6'`)
    ).rows[0];
    expect(row).toEqual({ kind: "model", subcategory: null, open_weight: false, kept: true });
    expect((await db.query(backfill[0] as string)).affectedRows).toBe(0);
    await db.close();
  });
});
