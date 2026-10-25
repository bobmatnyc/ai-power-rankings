/**
 * D91: migrations 0018 (create the four model family rows) and 0019 (fold seven
 * per-version rows into them) on the real migration chain (PGlite).
 *
 * Why: the fold rewrites ranked, linked rows in production in one transaction. Its claims —
 *   the rows are created inactive with an explicit kind, every guard arm refuses and
 *   writes nothing, a post-count mismatch rolls the fold back, the link and metrics clashes
 *   settle exactly as D90's `planMerge` settles them, the survivor's data and scores move
 *   to the family, no FK is left on a retired id, a re-run is a no-op, and the generator,
 *   /api/tools and the sitemap read the four families in place of the seven — are
 *   executor and constraint behaviour, so they run on the schema the files build.
 * What: chain 0000..0016 with the audit's tools, then 0017, 0018 and 0019 through
 *   `runMigrations --only`, with synthetic data, links and metrics rows on the old ids
 *   (production's link shape: 4, 4, 2, 1 on the survivors) plus each clash kind. The D90
 *   parity test plans the same fixture with `planMerge` and checks 0019's result row by row.
 * Test: `npx vitest run tests/unit/model-family-fold-d91.test.ts`. No server, no network.
 */

import type { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const { holder } = vi.hoisted(() => ({ holder: { db: null as unknown } }));
vi.mock("../../lib/db/connection", () => ({ getDb: () => holder.db }));
vi.mock("../../lib/db/repositories/news", () => ({ newsRepository: { getPublishedSlugs: async () => [] } }));
vi.mock("../../lib/services/whats-new-summary.service", () => ({ listPeriods: async () => [] }));

import { readFileSync } from "node:fs";
import path from "node:path";
import { D91_FAMILY_ROWS, D91_FOLD_PAIRS, D91_SURVIVORS } from "../../lib/db/model-families";
import { ToolsRepository } from "../../lib/db/repositories/tools.repository";
import { parseKindSheet } from "../../lib/db/tool-kind-sheet";
import { TOOL_LINK_KIND_VIOLATIONS_SQL } from "../../lib/db/tool-links";
import { createDbPersistence } from "../../lib/services/ranking-generation.service";
import { buildSitemapEntries } from "../../lib/sitemap";
import { runMigrations } from "../../scripts/apply-migrations";
import { derivePairs, loadMergeState, type MergePlan, planMerge } from "../../scripts/duplicate-tool-merge";
import { chainDb, MIGRATION_FILES, readMigration, REPO_ROOT } from "./fixtures/migration-chain-183";
import { pgliteMigrationDb } from "./fixtures/timestamptz-237-fixture";

const F17 = "0017_backfill_tool_kind.sql";
const F18 = "0018_create_model_family_rows.sql";
const F19 = "0019_fold_model_families.sql";
const FAMILIES = ["claude-opus", "claude-sonnet", "glm", "kimi"];
const OLD = D91_FOLD_PAIRS.map((p) => p.oldSlug);

interface Ctx {
  db: PGlite;
  mdb: ReturnType<typeof pgliteMigrationDb>;
}

async function apply(ctx: Ctx, only: string, opts: { force?: boolean; edit?: (sql: string) => string } = {}) {
  const read = (file: string) => (opts.edit && file === only ? opts.edit(readMigration(file)) : readMigration(file));
  return runMigrations(
    { db: ctx.mdb, files: { list: () => [...MIGRATION_FILES], read }, log: () => {} },
    { dryRun: false, only, showColumns: null, force: opts.force ?? false }
  );
}

/** Chain to 0017 with the audit's tools, plus the unrelated `opus` row production holds. */
async function setup(through: readonly string[] = [F17]): Promise<Ctx> {
  const db = await chainDb(F17);
  const ctx = { db, mdb: pgliteMigrationDb(db) };
  await db.query(
    `INSERT INTO public."tools" (slug, name, category, status, kind, data) VALUES ('opus', 'Opus', 'other', 'pending_review', 'harness', '{"name": "Opus"}')`
  );
  for (const file of through) expect((await apply(ctx, file)).exitCode).toBe(0);
  return ctx;
}

const idOf = async (db: PGlite, slug: string) =>
  (await db.query<{ id: string }>(`SELECT id FROM public."tools" WHERE slug = $1`, [slug])).rows[0]!.id;

async function link(db: PGlite, model: string, harness: string, relation: string, at: string) {
  const r = await db.query(
    `INSERT INTO public."tool_links" (model_tool_id, harness_tool_id, relation, created_at)
     SELECT m.id, h.id, $3, $4::timestamptz FROM public."tools" m, public."tools" h WHERE m.slug = $1 AND h.slug = $2`,
    [model, harness, relation, at]
  );
  expect(r.affectedRows).toBe(1);
}

async function metric(db: PGlite, slug: string, day: string) {
  await db.query(
    `INSERT INTO public."tool_metrics_history" (tool_id, tool_slug, collected_date, period) VALUES ($1, $2, $3, '2026-10')`,
    [await idOf(db, slug), slug, day]
  );
}

/** Every row of the three tables, as text, for before/after equality. */
async function snapshot(db: PGlite) {
  const q = async (sql: string) => (await db.query(sql)).rows;
  return {
    tools: await q(`SELECT to_jsonb(t)::text AS row FROM public."tools" t ORDER BY slug`),
    links: await q(`SELECT to_jsonb(l)::text AS row FROM public."tool_links" l ORDER BY id`),
    metrics: await q(`SELECT to_jsonb(m)::text AS row FROM public."tool_metrics_history" m ORDER BY id`),
  };
}

/** Synthetic survivor data and scores, and the production-shaped links plus every clash kind. */
async function seedFold(db: PGlite) {
  let n = 0;
  for (const [i, slug] of OLD.entries()) {
    await db.query(
      `UPDATE public."tools" SET data = jsonb_build_object('name', $2::text, 'autoCreated', true, 'createdByArticleId', 'synthetic-article',
         'firstMentionedDate', '2026-01-0' || $3::text, 'metrics', jsonb_build_object('synthetic', $3::int)),
         baseline_score = jsonb_build_object('synthetic', $3::int), delta_score = '{"synthetic": 0}', current_score = jsonb_build_object('synthetic', $3::int),
         score_updated_at = '2026-10-01T00:00:00Z' WHERE slug = $1`,
      [slug, `Synthetic ${slug}`, String(i + 1)]
    );
  }
  const at = () => `2026-10-01T00:00:${String(n++).padStart(2, "0")}Z`;
  // Alias rows created first, so "earlier pair wins" is tested against "earlier row".
  await link(db, "moonshot-kimi-2-5", "openhands", "supports", at()); // two-to-one with kimi-2-5: dropped
  await link(db, "opus-4-5", "cursor", "supports", at()); // two-to-one with opus-4-6: dropped
  await link(db, "opus-4-5", "cline", "supports", at()); // moves
  await link(db, "glm", "goose", "supports", at()); // already on the family
  await link(db, "zhipu-glm-5-0", "goose", "native", at()); // collides with the family's row: dropped
  for (const h of ["claude-code", "cursor", "warp", "kiro"]) await link(db, "opus-4-6", h, h === "claude-code" ? "native" : "supports", at());
  for (const h of ["claude-code", "cursor", "warp", "kiro"]) await link(db, "sonnet-4-5", h, h === "claude-code" ? "native" : "supports", at());
  for (const h of ["kiro", "openhands"]) await link(db, "glm-5-0", h, "supports", at());
  await link(db, "kimi-2-5", "openhands", "supports", at());
  await link(db, "deepseek", "kiro", "supports", at()); // unrelated
  await metric(db, "opus-4-5", "2026-10-01"); // two-to-one with opus-4-6 below: nulled
  await metric(db, "opus-4-6", "2026-10-01");
  await metric(db, "opus-4-5", "2026-10-02"); // moves
  await metric(db, "glm", "2026-10-03");
  await metric(db, "glm-5-0", "2026-10-03"); // collides with the family's row: nulled
  await metric(db, "kimi-2-5", "2026-10-04"); // moves
}

const sql18 = readMigration(F18);
const sql19 = readMigration(F19);
const arrayIn = (sql: string, name: string) =>
  [...(new RegExp(`${name} constant text\\[\\] := ARRAY\\[([^\\]]*)\\]`).exec(sql)?.[1] ?? "").matchAll(/'([^']+)'/g)].map((m) => m[1]);

describe("D91 constants and files", () => {
  it("the fold pairs are the signed URL table's 308 targets, survivors first", () => {
    expect(derivePairs(OLD)).toEqual(D91_FOLD_PAIRS);
    expect(D91_SURVIVORS).toEqual({ "claude-opus": "opus-4-6", "claude-sonnet": "sonnet-4-5", glm: "glm-5-0", kimi: "kimi-2-5" });
    // The survivor is the first pair of its family, so it wins every two-to-one clash.
    for (const [family, survivor] of Object.entries(D91_SURVIVORS)) {
      expect(D91_FOLD_PAIRS.find((p) => p.newSlug === family)?.oldSlug).toBe(survivor);
    }
  });

  it("0019 carries the constant's slugs in the constant's order; neither file pattern-matches a slug", () => {
    expect(arrayIn(sql19, "old_slugs")).toEqual(OLD);
    expect(arrayIn(sql19, "family_of")).toEqual(D91_FOLD_PAIRS.map((p) => p.newSlug));
    expect(arrayIn(sql19, "survivor_slugs")).toEqual(Object.values(D91_SURVIVORS));
    expect(arrayIn(sql19, "family_slugs")).toEqual(Object.keys(D91_SURVIVORS));
    for (const sql of [sql18, sql19]) expect(sql).not.toMatch(/\bI?LIKE\b|SIMILAR TO|~\*?\s*'|left\(|starts_with/i);
  });

  it("0018's open_weight per family matches the reviewed sheet", () => {
    const sheet = parseKindSheet(readFileSync(path.join(REPO_ROOT, "docs/refresh/tool-kind-mapping.csv"), "utf8"));
    for (const family of D91_FAMILY_ROWS) {
      expect([family.slug, sheet.rows.find((r) => r.slug === family.slug)?.openWeight]).toEqual([family.slug, family.openWeight]);
    }
  });
});

describe("D91 0018 creates the family rows inactive", () => {
  let ctx: Ctx;
  beforeAll(async () => {
    ctx = await setup();
  }, 120_000);
  afterAll(async () => {
    await ctx.db.close();
  });

  it("the rows are absent before 0018 and inactive models after it", async () => {
    const families = async () =>
      (
        await ctx.db.query(
          `SELECT slug, name, category, status, kind, company_id, open_weight, licence, data FROM public."tools" WHERE slug = ANY($1) ORDER BY slug`,
          [FAMILIES]
        )
      ).rows;
    expect(await families()).toEqual([]);
    expect((await apply(ctx, F18)).exitCode).toBe(0);
    expect(ctx.mdb.notices).toContain("D91 0018: inserted 4 family rows");
    const data = { createdBy: "migration 0018_create_model_family_rows", ruling: "D91", source: "#197" };
    expect(await families()).toEqual(
      D91_FAMILY_ROWS.map((f) => ({
        slug: f.slug,
        name: f.name,
        category: "other",
        status: "inactive",
        kind: "model",
        company_id: null,
        open_weight: f.openWeight,
        licence: f.licence,
        data,
      }))
    );
    expect(D91_FAMILY_ROWS.map((f) => f.name)).toEqual(["Claude Opus", "Claude Sonnet", "GLM", "Kimi"]);
  });

  it("a forced re-run inserts 0 rows and changes nothing", async () => {
    const before = await snapshot(ctx.db);
    ctx.mdb.notices.length = 0;
    expect((await apply(ctx, F18, { force: true })).exitCode).toBe(0);
    expect(ctx.mdb.notices).toEqual(["D91 0018: inserted 0 family rows"]);
    expect(await snapshot(ctx.db)).toEqual(before);
  });
});

describe("D91 0018 refusals write nothing", () => {
  it.each([
    [
      "a missing explicit kind (the column default is harness)",
      async () => {},
      (sql: string) => sql.replace("status, kind, open_weight", "status, open_weight").replaceAll("'inactive', 'model', ", "'inactive', "),
      /tools_open_weight_check|D91 0018: 0 family rows of kind model/,
    ],
    [
      "a family slug held by a harness row",
      async (db: PGlite) => {
        await db.query(`INSERT INTO public."tools" (slug, name, category, status, kind) VALUES ('glm', 'GLM', 'other', 'active', 'harness')`);
      },
      undefined,
      /D91 0018: family slugs exist with another kind: glm \(kind harness\)/,
    ],
  ])("refuses %s", async (_name, arrange, edit, message) => {
    const ctx = await setup();
    await arrange(ctx.db);
    const before = await snapshot(ctx.db);
    const result = await apply(ctx, F18, { edit });
    expect(result.exitCode).toBe(1);
    expect(result.lines.join("\n")).toMatch(message);
    expect(await snapshot(ctx.db)).toEqual(before);
    expect(await ctx.mdb.listAppliedFilenames()).toEqual([F17]);
    await ctx.db.close();
  }, 120_000);
});

/** What the generator, /api/tools and the sitemap list, read through the app's own code. */
async function selections(db: PGlite) {
  holder.db = drizzle(db);
  const generator = (await createDbPersistence().loadActiveTools()).map((t) => t.slug);
  const api = (await new ToolsRepository().findByStatus("active")).map((t) => t.slug);
  const sitemap = (await buildSitemapEntries("https://example.test"))
    .map((e) => new URL(e.url).pathname)
    .filter((p) => p.startsWith("/en/tools/"))
    .map((p) => p.slice("/en/tools/".length));
  holder.db = null;
  const pick = (slugs: string[]) => [...FAMILIES, ...OLD, "opus"].filter((s) => slugs.includes(s)).sort();
  return { generator: pick(generator), api: pick(api), sitemap: pick(sitemap) };
}

describe("D91 0019 folds the seven rows into the four families", () => {
  let ctx: Ctx;
  let plan: MergePlan;
  let before: Awaited<ReturnType<typeof snapshot>>;
  let beforeSelections: Awaited<ReturnType<typeof selections>>;
  let firstRun: Awaited<ReturnType<typeof apply>>;
  const ids = new Map<string, string>();

  beforeAll(async () => {
    ctx = await setup([F17, F18]);
    await seedFold(ctx.db);
    for (const slug of [...FAMILIES, ...OLD]) ids.set(slug, await idOf(ctx.db, slug));
    plan = planMerge(D91_FOLD_PAIRS, await loadMergeState(ctx.db, D91_FOLD_PAIRS));
    before = await snapshot(ctx.db);
    beforeSelections = await selections(ctx.db);
    firstRun = await apply(ctx, F19);
  }, 120_000);
  afterAll(async () => {
    await ctx.db.close();
  });

  it("applies in one statement and reports the D90 plan's counts", () => {
    expect(firstRun.exitCode).toBe(0);
    const t = plan.totals;
    expect([t.linksMoved, t.linksDropped, t.metricsRepointed, t.metricsNulled]).toEqual([12, 3, 3, 2]);
    expect(ctx.mdb.notices).toContain(
      `D91 0019: folded 7 rows into 4 families; links moved ${t.linksMoved}, dropped ${t.linksDropped}; metrics moved ${t.metricsRepointed}, nulled ${t.metricsNulled}`
    );
  });

  it("settles every link and metrics row exactly as D90's planMerge does (one rule set)", async () => {
    // Before 0019 the only D90 objection is that the families are not active yet: activation is 0019's job.
    for (const p of plan.pairs) expect(p.problems).toEqual([`target row ${p.newSlug} is inactive, not active`]);
    const links = new Map((await ctx.db.query<{ id: string; m: string; h: string }>(
      `SELECT id::text, model_tool_id::text AS m, harness_tool_id::text AS h FROM public."tool_links"`
    )).rows.map((r) => [r.id, r]));
    const metrics = new Map((await ctx.db.query<{ id: string; tool_id: string | null }>(
      `SELECT id::text, tool_id::text FROM public."tool_metrics_history"`
    )).rows.map((r) => [r.id, r.tool_id]));
    for (const l of plan.pairs.flatMap((p) => p.links)) {
      if (l.action === "move") expect(links.get(l.linkId)).toEqual({ id: l.linkId, m: l.to.modelId, h: l.to.harnessId });
      else expect([l.action, links.has(l.linkId)]).toEqual(["drop-collision", false]);
    }
    for (const m of plan.pairs.flatMap((p) => p.metrics)) {
      expect([m.action, metrics.get(m.rowId)]).toEqual([m.action, m.action === "repoint" ? m.newToolId : null]);
    }
    // The survivor's link beat the earlier-created alias link; the family's own row was kept.
    const pairs = (await ctx.db.query<{ p: string }>(
      `SELECT m.slug || ' x ' || h.slug || ' ' || l.relation AS p FROM public."tool_links" l
       JOIN public."tools" m ON m.id = l.model_tool_id JOIN public."tools" h ON h.id = l.harness_tool_id
       WHERE m.slug = ANY($1) ORDER BY 1`, [FAMILIES]
    )).rows.map((r) => r.p);
    expect(pairs).toContain("glm x goose supports");
    expect(pairs).toContain("kimi x openhands supports");
    expect(pairs).toContain("claude-opus x cline supports");
    expect(pairs).toHaveLength(13);
  });

  it("leaves zero tool_links or tool_metrics_history rows on a retired id", async () => {
    const oldIds = OLD.map((s) => ids.get(s)!);
    const n = async (sql: string) => (await ctx.db.query<{ n: number }>(sql, [oldIds])).rows[0]!.n;
    expect(await n(`SELECT count(*)::int AS n FROM public."tool_links" WHERE model_tool_id = ANY($1::uuid[]) OR harness_tool_id = ANY($1::uuid[])`)).toBe(0);
    expect(await n(`SELECT count(*)::int AS n FROM public."tool_metrics_history" WHERE tool_id = ANY($1::uuid[])`)).toBe(0);
    expect((await ctx.db.query(TOOL_LINK_KIND_VIOLATIONS_SQL)).rows).toEqual([]);
  });

  it("carries the survivor's data and scores onto each family, without the article keys", async () => {
    const rows = (await ctx.db.query<Record<string, unknown>>(
      `SELECT slug, status, data, baseline_score, delta_score, current_score, extract(epoch FROM score_updated_at)::int AS at FROM public."tools" WHERE slug = ANY($1) ORDER BY slug`,
      [FAMILIES]
    )).rows;
    for (const row of rows) {
      const survivor = D91_SURVIVORS[row["slug"] as string]!;
      const ord = String(OLD.indexOf(survivor) + 1);
      expect(row).toEqual({
        slug: row["slug"],
        status: "active",
        data: {
          firstMentionedDate: `2026-01-0${ord}`,
          metrics: { synthetic: Number(ord) },
          createdBy: "migration 0018_create_model_family_rows",
          ruling: "D91",
          source: "#197",
          foldedBy: "migration 0019_fold_model_families",
          carriedFrom: survivor,
        },
        baseline_score: { synthetic: Number(ord) },
        delta_score: { synthetic: 0 },
        current_score: { synthetic: Number(ord) },
        at: Date.parse("2026-10-01T00:00:00Z") / 1000,
      });
    }
  });

  it("retires the seven as applyMerge does: redirect, redirect_to, redirect_reason, previous_status", async () => {
    const rows = (await ctx.db.query<{ slug: string; status: string; to: string; reason: string; prev: string }>(
      `SELECT slug, status, data->>'redirect_to' AS to, data->>'redirect_reason' AS reason, data->>'previous_status' AS prev
         FROM public."tools" WHERE slug = ANY($1)`, [OLD]
    )).rows;
    expect(new Map(rows.map((r) => [r.slug, [r.status, r.to, r.reason, r.prev]]))).toEqual(
      new Map(D91_FOLD_PAIRS.map((p) => [p.oldSlug, ["redirect", p.newSlug, `D91: folded into ${p.newSlug}`, "active"]]))
    );
  });

  it("touches no tools row outside the eleven, including the unrelated opus row", async () => {
    const outside = (s: Awaited<ReturnType<typeof snapshot>>) =>
      s.tools.filter((r) => ![...FAMILIES, ...OLD].includes(JSON.parse((r as { row: string }).row).slug));
    const after = await snapshot(ctx.db);
    expect(outside(after)).toEqual(outside(before));
    expect(outside(after).some((r) => JSON.parse((r as { row: string }).row).slug === "opus")).toBe(true);
  });

  it("the generator, /api/tools and the sitemap list the four families instead of the seven", async () => {
    // After 0018 alone: the inactive families are off every list; the seven are on it.
    expect(beforeSelections).toEqual({ generator: [...OLD].sort(), api: [...OLD].sort(), sitemap: [...OLD].sort() });
    expect(await selections(ctx.db)).toEqual({ generator: FAMILIES, api: FAMILIES, sitemap: FAMILIES });
  });

  it("a forced re-run is a no-op, and so is 0018 again", async () => {
    const state = await snapshot(ctx.db);
    ctx.mdb.notices.length = 0;
    expect((await apply(ctx, F19, { force: true })).exitCode).toBe(0);
    expect((await apply(ctx, F18, { force: true })).exitCode).toBe(0);
    expect(ctx.mdb.notices).toEqual(["D91 0019: already folded, 0 rows changed", "D91 0018: inserted 0 family rows"]);
    expect(await snapshot(ctx.db)).toEqual(state);
  });
});

describe("D91 0019 refusals and post-count checks roll back", () => {
  const exec = (sql: string) => async (db: PGlite) => void (await db.query(sql));
  it.each([
    ["a missing family row", exec(`DELETE FROM public."tools" WHERE slug = 'kimi'`), undefined, "D91 0019: precondition failed: kimi is missing"],
    ["a family row already active", exec(`UPDATE public."tools" SET status = 'active' WHERE slug = 'glm'`), undefined, "glm is model/active, expected model/inactive"],
    ["a missing old row", exec(`DELETE FROM public."tools" WHERE slug = 'zhipu-glm-5-0'`), undefined, "D91 0019: precondition failed: zhipu-glm-5-0 is missing"],
    ["an old row that is not a model", exec(`UPDATE public."tools" SET kind = 'harness' WHERE slug = 'sonnet-4-5'`), undefined, "sonnet-4-5 is harness/active, expected model/active"],
    ["an old row that is not active", exec(`UPDATE public."tools" SET status = 'pending_review' WHERE slug = 'opus-4-5'`), undefined, "opus-4-5 is model/pending_review"],
    [
      "a half-folded state",
      exec(`UPDATE public."tools" SET status = 'redirect', data = data || '{"redirect_to": "kimi", "redirect_reason": "D91: folded into kimi"}' WHERE slug = 'kimi-2-5'`),
      undefined,
      "kimi-2-5 is model/redirect, expected model/active",
    ],
    [
      "a model row on the harness side of a link",
      async (db: PGlite) => {
        await db.query(`INSERT INTO public."tool_links" (model_tool_id, harness_tool_id, relation) VALUES ($1, $2, 'supports')`, [
          await idOf(db, "deepseek"),
          await idOf(db, "opus-4-5"),
        ]);
      },
      undefined,
      "tool_links name a model row on the harness side: opus-4-5",
    ],
    [
      "a link left on a retired id (post-count)",
      async () => {},
      (sql: string) => sql.replace("   WHERE l.model_tool_id = o.id;", "   WHERE false AND l.model_tool_id = o.id;"),
      "tool_links rows still on retired ids",
    ],
    [
      "a metrics row left on a retired id (post-count)",
      async () => {},
      (sql: string) => sql.replace("   WHERE m.tool_id = o.id;", "   WHERE false AND m.tool_id = o.id;"),
      "tool_metrics_history rows still on retired ids",
    ],
    [
      "a row not retired (post-count)",
      async () => {},
      (sql: string) => sql.replace("WHERE t.slug = x.old_slug AND t.status <> 'redirect';", "WHERE t.slug = x.old_slug AND t.status <> 'redirect' AND t.slug <> 'opus-4-5';"),
      "carried 4, activated 4, retired 6; expected 4, 4, 7",
    ],
  ])("refuses %s, writing nothing", async (_name, arrange, edit, message) => {
    const ctx = await setup([F17, F18]);
    await seedFold(ctx.db);
    await arrange(ctx.db);
    const before = await snapshot(ctx.db);
    const result = await apply(ctx, F19, { edit });
    expect(result.exitCode).toBe(1);
    expect(result.lines.join("\n")).toContain(message);
    expect(await snapshot(ctx.db)).toEqual(before);
    expect(await ctx.mdb.listAppliedFilenames()).toEqual([F17, F18]);
    await ctx.db.close();
  }, 120_000);
});

describe("D91 0019 re-run after the fold refuses a row on a retired id", () => {
  it.each([
    ["a tool_links row", async (db: PGlite) => link(db, "opus-4-5", "windsurf", "supports", "2026-10-02T00:00:00Z")],
    ["a tool_metrics_history row", async (db: PGlite) => metric(db, "kimi-2-5", "2026-10-05")],
  ])("refuses %s pointing at a retired id, writing nothing", async (_name, arrange) => {
    const ctx = await setup([F17, F18]);
    await seedFold(ctx.db);
    expect((await apply(ctx, F19)).exitCode).toBe(0);
    await arrange(ctx.db);
    const before = await snapshot(ctx.db);
    const result = await apply(ctx, F19, { force: true });
    expect(result.exitCode).toBe(1);
    expect(result.lines.join("\n")).toContain("D91 0019: already folded, but rows point at a retired id again");
    expect(await snapshot(ctx.db)).toEqual(before);
    expect(await ctx.mdb.listAppliedFilenames()).toEqual([F17, F18, F19]);
    await ctx.db.close();
  }, 120_000);
});
