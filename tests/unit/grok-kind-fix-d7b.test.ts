/**
 * D7b: migration 0022 gives the three stray Grok point rows their model kind (PGlite).
 *
 * Why: 0022 rewrites production rows in one DO block and must fail closed. Its claims — the
 *   fixed state, a no-op re-run, a raise on a partial state, and each guard raising with every
 *   row as it was — are Postgres behaviour, so they run on real Postgres.
 * What: builds `tools` and `tool_links` as of 0016 with the live `grok` row, a harness, an
 *   unrelated link and the three strays as production holds them (harness/pending_review, no
 *   subcategory), then applies 0022 statement by statement with the runner's `splitStatements`.
 *   Each guard arm breaks one precondition and expects the guard's own message and an unchanged
 *   snapshot of both tables. The seed arm plans the seed upsert and status step before and after
 *   the fix with the shipped seed and lifecycle files, runs the planned status writes, and
 *   re-plans to unchanged.
 * Test: `npx vitest run tests/unit/grok-kind-fix-d7b.test.ts`. No server, no network.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MODEL_STATUS_UPDATE_SQL, planModelStatus } from "../../lib/db/repositories/model-lifecycle";
import { planModelSeedRows } from "../../lib/db/repositories/model-seed-writer";
import { splitStatements } from "../../scripts/apply-migrations";
import { readModelLifecycle, readModelSeeds } from "../../scripts/load-model-seeds";
import { MIGRATION_0016_SQL, TOOLS_AT_0015 } from "./fixtures/tool-links-183-fixture";

// These tests run migrations and queries on PGlite, which can pass 5000 ms on a loaded machine.
vi.setConfig({ testTimeout: 60_000 });

const SQL_0022 = readFileSync(path.resolve(__dirname, "../../lib/db/migrations/0022_fix_grok_stray_kind.sql"), "utf8");
const STRAYS = ["grok-4-5", "grok-4-6", "grok-4-7"];
const MARK = "migration 0022_fix_grok_stray_kind (D7b)";

let pg: PGlite | null = null;

async function freshDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(TOOLS_AT_0015);
  for (const statement of splitStatements(MIGRATION_0016_SQL)) await db.exec(statement);
  const insert = (slug: string, kind: string, status: string, subcategory: string | null, data: unknown = {}) =>
    db.query(
      `INSERT INTO public."tools" (slug, name, category, kind, status, subcategory, data) VALUES ($1, $1, 'other', $2, $3, $4, $5::jsonb)`,
      [slug, kind, status, subcategory, JSON.stringify(data)]
    );
  await insert("grok", "model", "active", null, { info: { company: "xAI" } });
  await insert("cursor", "harness", "active", "code_editor");
  // The strays as the D7b pre-check found them in production: the 0016 kind default,
  // pending_review, no subcategory, no open_weight.
  for (const slug of STRAYS) await insert(slug, "harness", "pending_review", null, { autoCreated: true });
  await link(db, "grok", "cursor");
  return db;
}

async function link(db: PGlite, model: string, harness: string): Promise<void> {
  await db.query(
    `INSERT INTO public."tool_links" (model_tool_id, harness_tool_id, relation)
     SELECT m.id, h.id, 'supports' FROM public."tools" m, public."tools" h WHERE m.slug = $1 AND h.slug = $2`,
    [model, harness]
  );
}

async function apply(db: PGlite): Promise<void> {
  for (const statement of splitStatements(SQL_0022)) await db.exec(statement);
}

/** Every column of both tables, so "unchanged" covers updated_at and data too. */
async function snapshot(db: PGlite): Promise<string> {
  const tools = await db.query(`SELECT * FROM public."tools" ORDER BY slug`);
  const links = await db.query(`SELECT * FROM public."tool_links" ORDER BY id`);
  return JSON.stringify([tools.rows, links.rows]);
}

interface Row {
  slug: string;
  kind: string;
  status: string;
  subcategory: string | null;
  data: Record<string, unknown>;
}

async function rows(db: PGlite): Promise<Map<string, Row>> {
  const { rows: r } = await db.query<Row>(`SELECT slug, kind, status, subcategory, data FROM public."tools"`);
  return new Map(r.map((row) => [row.slug, row]));
}

afterEach(async () => {
  await pg?.close();
  pg = null;
});

describe("migration 0022 fixes the stray Grok rows (D7b)", () => {
  it("sets all three to kind model, archives all three, and leaves the other rows alone", async () => {
    pg = await freshDb();
    const before = await rows(pg);
    await apply(pg);
    const after = await rows(pg);

    for (const slug of STRAYS) {
      const row = after.get(slug)!;
      expect(row.kind, slug).toBe("model");
      expect(row.subcategory, slug).toBeNull();
      expect(row.status, slug).toBe("deprecated");
      expect(row.data["autoCreated"], slug).toBe(true);
      expect(row.data["d7b"], slug).toEqual({
        by: MARK,
        from_kind: "harness",
        from_subcategory: null,
        from_status: "pending_review",
        supersededBy: "grok",
        archiveReason: "superseded",
      });
    }
    expect(after.get("grok")).toEqual(before.get("grok"));
    expect(after.get("cursor")).toEqual(before.get("cursor"));
  });

  it("a second run changes nothing", async () => {
    pg = await freshDb();
    await apply(pg);
    const once = await snapshot(pg);
    await apply(pg);
    expect(await snapshot(pg)).toBe(once);
  });

  it("raises on a partial state (2 of 3 rows fixed) and writes nothing", async () => {
    pg = await freshDb();
    await apply(pg);
    await pg.query(`UPDATE public."tools" SET kind = 'harness', status = 'pending_review', data = data - 'd7b' WHERE slug = 'grok-4-7'`);
    const before = await snapshot(pg);
    await expect(apply(pg)).rejects.toThrow(/partial state, 2 of 3 rows already marked/);
    expect(await snapshot(pg)).toBe(before);
  });

  it("raises when all three rows are marked but one differs from the fixed state, and writes nothing", async () => {
    pg = await freshDb();
    await apply(pg);
    await pg.query(`UPDATE public."tools" SET kind = 'harness' WHERE slug = 'grok-4-5'`);
    const before = await snapshot(pg);
    await expect(apply(pg)).rejects.toThrow(/marked as fixed but differ/);
    expect(await snapshot(pg)).toBe(before);
  });

  const guardArms: { name: string; breakIt: (db: PGlite) => Promise<unknown>; message: RegExp }[] = [
    {
      name: "a stray that is not kind harness",
      breakIt: (db) => db.query(`UPDATE public."tools" SET kind = 'other' WHERE slug = 'grok-4-6'`),
      message: /precondition failed, nothing written: grok-4-6 is other\/pending_review/,
    },
    {
      name: "a tool_links row on a stray",
      breakIt: (db) => link(db, "grok", "grok-4-7"),
      message: /1 tool_links row\(s\) touch the stray rows/,
    },
    {
      name: "a stray with status redirect",
      breakIt: (db) => db.query(`UPDATE public."tools" SET status = 'redirect', data = '{"redirect_to": "grok"}' WHERE slug = 'grok-4-5'`),
      message: /precondition failed, nothing written: grok-4-5 is harness\/redirect/,
    },
    {
      name: "a stray with another status (active)",
      breakIt: (db) => db.query(`UPDATE public."tools" SET status = 'active' WHERE slug = 'grok-4-7'`),
      message: /precondition failed, nothing written: grok-4-7 is harness\/active, expected harness\/pending_review/,
    },
    {
      name: "a missing stray",
      breakIt: (db) => db.query(`DELETE FROM public."tools" WHERE slug = 'grok-4-6'`),
      message: /precondition failed, nothing written: grok-4-6 is missing/,
    },
    {
      name: "grok not active",
      breakIt: (db) => db.query(`UPDATE public."tools" SET status = 'inactive' WHERE slug = 'grok'`),
      message: /grok is not an active model row/,
    },
    {
      name: "grok held by a harness row",
      breakIt: (db) => db.query(`UPDATE public."tools" SET kind = 'harness' WHERE slug = 'grok'`),
      message: /grok is not an active model row/,
    },
  ];

  for (const arm of guardArms) {
    it(`raises on ${arm.name} with every row unchanged`, async () => {
      pg = await freshDb();
      await arm.breakIt(pg);
      const before = await snapshot(pg);
      await expect(apply(pg)).rejects.toThrow(arm.message);
      expect(await snapshot(pg)).toBe(before);
    });
  }

  it("before the fix the seed refuses grok-4-5 and grok-4-6; after it, it sets deprecated -> deprecated, refuses nothing and never names grok-4-7", async () => {
    pg = await freshDb();
    const db = pg;
    const lifecycle = readModelLifecycle((file) => readFileSync(file, "utf8"));
    const seeds = readModelSeeds("all", (file) => readFileSync(file, "utf8")).filter((e) => e.row.slug.startsWith("grok"));
    const seedDb = { query: async (text: string, params?: unknown[]) => ({ rows: (await db.query(text, params)).rows as unknown[] }) };
    const statusPlan = async () => (await planModelStatus(seedDb, lifecycle, new Set())).filter((p) => p.slug.startsWith("grok-4-"));

    expect(seeds.map((e) => e.row.slug).sort()).toEqual(["grok-4-5", "grok-4-6"]);
    const harnessRefusal = { outcome: "refused", reason: "slug is held by a harness row, not a model" };
    for (const plan of await planModelSeedRows(seedDb, seeds)) expect(plan, plan.slug).toMatchObject(harnessRefusal);
    const pre = await statusPlan();
    expect(pre.map((p) => p.slug).sort()).toEqual(["grok-4-5", "grok-4-6"]);
    for (const plan of pre) expect(plan, plan.slug).toMatchObject(harnessRefusal);

    await apply(db);
    for (const plan of await planModelSeedRows(seedDb, seeds)) expect(plan.outcome, plan.slug).not.toBe("refused");
    const post = await statusPlan();
    expect(post.map((p) => p.slug).sort()).toEqual(["grok-4-5", "grok-4-6"]);
    for (const plan of post) {
      expect(plan, plan.slug).toMatchObject({ outcome: "set", from: "deprecated", to: "deprecated" });
      if (plan.outcome !== "set") continue;
      expect((await db.query(MODEL_STATUS_UPDATE_SQL, plan.params)).rows, plan.slug).toHaveLength(1);
    }
    for (const plan of await statusPlan()) expect(plan.outcome, plan.slug).toBe("unchanged");
    const after = await rows(db);
    for (const slug of ["grok-4-5", "grok-4-6"]) {
      expect(after.get(slug)!.status, slug).toBe("deprecated");
      expect(after.get(slug)!.data["d7b"], slug).toMatchObject({ supersededBy: "grok" });
      expect(after.get(slug)!.data["modelLifecycle"], slug).toMatchObject({ supersededBy: "grok", targetStatus: "deprecated" });
    }
  });
});
