/**
 * #183: migration 0017, the tools.kind backfill, on the real migration chain (PGlite).
 *
 * Why: 0017 is generated from the reviewed sheet and applied to production on its own
 *   (Q-A9). It must set the sheet's kind and subcategory on every sheet slug, touch no
 *   other column, change nothing on a re-run, and refuse loudly, writing nothing, when a
 *   sheet slug has no tools row: a silent no-op on a missing slug would leave a tool on
 *   the default kind.
 * What: applies migrations 0000..0016 from disk to PGlite, seeds the 114 audit tools and
 *   two tools outside the sheet, links four models to harnesses, then applies the
 *   committed 0017 through `runMigrations --only`. Checks the file is what the builder
 *   renders from the sheet, the kind per slug, the 69/15/30 totals, every other column
 *   unchanged, a forced re-run updating 0 rows, the missing-slug refusal and the
 *   `TOOL_LINK_KIND_VIOLATIONS_SQL` result before and after.
 * Test: `npx vitest run tests/unit/tool-kind-backfill-0017-183.test.ts`. No server, no network.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildKindBackfillSql, KIND_COUNT_SQL, parseKindSheet } from "../../lib/db/tool-kind-sheet";
import { TOOL_LINK_KIND_VIOLATIONS_SQL } from "../../lib/db/tool-links";
import { runMigrations, splitStatements } from "../../scripts/apply-migrations";
import { chainDb, EXTRA_TOOLS, MIGRATION_FILES, readMigration, REPO_ROOT } from "./fixtures/migration-chain-183";
import { pgliteMigrationDb } from "./fixtures/timestamptz-237-fixture";

const FILE = "0017_backfill_tool_kind.sql";
const SHEET = parseKindSheet(readFileSync(path.join(REPO_ROOT, "docs/refresh/tool-kind-mapping.csv"), "utf8"));
const LINKS = [
  ["opus-4-6", "claude-code", "native"],
  ["sonnet-4-5", "claude-code", "native"],
  ["glm-5-0", "cline", "supports"],
  ["kimi-2-5", "openhands", "supports"],
] as const;

async function apply0017(db: PGlite, migrationDb: ReturnType<typeof pgliteMigrationDb>, force = false) {
  return runMigrations(
    { db: migrationDb, files: { list: () => [...MIGRATION_FILES], read: readMigration }, log: () => {} },
    { dryRun: false, only: FILE, showColumns: null, force }
  );
}

/** Every tools column except kind and subcategory, per slug. */
async function otherColumns(db: PGlite) {
  return (
    await db.query(`SELECT slug, to_jsonb(t) - 'kind' - 'subcategory' AS rest FROM public."tools" AS t ORDER BY slug`)
  ).rows;
}

async function kinds(db: PGlite): Promise<Map<string, [string, string | null]>> {
  const rows = (await db.query<{ slug: string; kind: string; subcategory: string | null }>(
    `SELECT slug, kind, subcategory FROM public."tools"`
  )).rows;
  return new Map(rows.map((r) => [r.slug, [r.kind, r.subcategory]]));
}

const counts = async (db: PGlite) => (await db.query<{ kind: string; n: number }>(KIND_COUNT_SQL)).rows;

describe("#183 the committed 0017 file", () => {
  it("is the builder's output for the committed sheet, one guarded statement", () => {
    expect(SHEET.errors).toEqual([]);
    const sql = readMigration(FILE);
    expect(sql).toBe(buildKindBackfillSql(SHEET.rows));
    expect(splitStatements(sql)).toHaveLength(1);
    expect(sql).toContain("SET LOCAL lock_timeout = '5s';");
    // Writes kind and subcategory only (D38 option 1): no other column is assigned.
    expect(sql).toMatch(/^\s+SET kind = v\.kind, subcategory = v\.subcategory::text$/m);
    expect(sql.match(/\bUPDATE\b/g)).toHaveLength(1);
    expect(sql).not.toMatch(/\b(INSERT|DELETE|DROP|ALTER|TRUNCATE)\b|open_weight|status|updated_at =/);
  });
});

describe("#183 0017 on the migration chain 0000..0016 (PGlite)", () => {
  let db: PGlite;
  let migrationDb: ReturnType<typeof pgliteMigrationDb>;
  let before: Awaited<ReturnType<typeof otherColumns>>;
  let firstRun: Awaited<ReturnType<typeof apply0017>>;
  let violationsBefore: unknown[];

  beforeAll(async () => {
    db = await chainDb(FILE);
    for (const [model, harness, relation] of LINKS) {
      await db.query(
        `INSERT INTO public."tool_links" (model_tool_id, harness_tool_id, relation)
         SELECT m.id, h.id, $3 FROM public."tools" m, public."tools" h WHERE m.slug = $1 AND h.slug = $2`,
        [model, harness, relation]
      );
    }
    violationsBefore = (await db.query(TOOL_LINK_KIND_VIOLATIONS_SQL)).rows;
    before = await otherColumns(db);
    migrationDb = pgliteMigrationDb(db);
    firstRun = await apply0017(db, migrationDb);
  });
  afterAll(async () => {
    await db.close();
  });

  it("applies through the runner and records the file once", async () => {
    expect(firstRun.exitCode).toBe(0);
    expect(await migrationDb.listAppliedFilenames()).toEqual([FILE]);
    const changed = SHEET.rows.filter((r) => r.kind !== "harness" || r.subcategory !== null).length;
    expect(migrationDb.notices).toContain(`#183 0017: updated ${changed} tools rows`);
  });

  it("sets each sheet slug's kind and subcategory and leaves tools outside the sheet alone", async () => {
    const got = await kinds(db);
    for (const row of SHEET.rows) expect([row.slug, ...got.get(row.slug)!]).toEqual([row.slug, row.kind, row.subcategory]);
    for (const extra of EXTRA_TOOLS) expect(got.get(extra.slug)).toEqual(["harness", null]);
    expect(await counts(db)).toEqual([
      { kind: "harness", n: 69 + EXTRA_TOOLS.length },
      { kind: "model", n: 15 },
      { kind: "other", n: 30 },
    ]);
    const sheetSlugs = SHEET.rows.map((r) => r.slug);
    const bySheet = (
      await db.query<{ kind: string; n: number }>(
        `SELECT kind, count(*)::int AS n FROM public."tools" WHERE slug = ANY($1) GROUP BY kind ORDER BY kind`,
        [sheetSlugs]
      )
    ).rows;
    expect(bySheet).toEqual([
      { kind: "harness", n: 69 },
      { kind: "model", n: 15 },
      { kind: "other", n: 30 },
    ]);
    const builders = [...got].filter(([, [, sub]]) => sub === "app_builder").map(([slug]) => slug).sort();
    expect(builders).toEqual(["bolt-new", "claude-artifacts", "flint", "lovable", "rocket-new", "v0-vercel", "wabi"]);
  });

  it("touches no other column: status, open_weight, data and updated_at are unchanged (D38 option 1)", async () => {
    expect(await otherColumns(db)).toEqual(before);
    const live = (
      await db.query<{ slug: string; status: string; kind: string }>(
        `SELECT slug, status, kind FROM public."tools" WHERE slug IN ('opus-4-6', 'sonnet-4-5', 'glm-5-0', 'kimi-2-5') ORDER BY slug`
      )
    ).rows;
    expect(live.map((r) => [r.slug, r.status, r.kind])).toEqual([
      ["glm-5-0", "active", "model"],
      ["kimi-2-5", "active", "model"],
      ["opus-4-6", "active", "model"],
      ["sonnet-4-5", "active", "model"],
    ]);
  });

  it("leaves no wrong-sided link: the B-1 violation query returns zero rows", async () => {
    expect(violationsBefore).toHaveLength(LINKS.length); // every model side was still a harness
    expect((await db.query(TOOL_LINK_KIND_VIOLATIONS_SQL)).rows).toEqual([]);
  });

  it("a forced re-run updates 0 rows and changes nothing", async () => {
    const state = (await db.query(`SELECT to_jsonb(t) AS row FROM public."tools" AS t ORDER BY slug`)).rows;
    migrationDb.notices.length = 0;
    const again = await apply0017(db, migrationDb, true);
    expect(again.exitCode).toBe(0);
    expect(migrationDb.notices).toEqual(["#183 0017: updated 0 tools rows"]);
    expect((await db.query(`SELECT to_jsonb(t) AS row FROM public."tools" AS t ORDER BY slug`)).rows).toEqual(state);
    expect(await migrationDb.listAppliedFilenames()).toEqual([FILE]);
  });
});

describe("#183 0017 refuses a sheet slug missing from tools", () => {
  it("raises, writes nothing and records nothing", async () => {
    const db = await chainDb(FILE, ["flint", "zed"]);
    const migrationDb = pgliteMigrationDb(db);
    const result = await apply0017(db, migrationDb);
    expect(result.exitCode).toBe(1);
    expect(result.lines.join("\n")).toContain("#183 0017: sheet slugs missing from tools: flint, zed");
    expect(await counts(db)).toEqual([{ kind: "harness", n: 112 + EXTRA_TOOLS.length }]);
    expect((await db.query(`SELECT count(*)::int AS n FROM public."tools" WHERE subcategory IS NOT NULL`)).rows).toEqual([{ n: 0 }]);
    expect(await migrationDb.listAppliedFilenames()).toEqual([]);
    await db.close();
  });
});
