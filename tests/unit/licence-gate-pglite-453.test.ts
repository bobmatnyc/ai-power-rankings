/**
 * #453: the licence-review activation guard in each UPDATE, on real Postgres (PGlite).
 *
 * Why: a planner reads the row once; the row can change before the write. The guard in the
 *   UPDATE is what stops a row whose review turned pending after planning, and the apply must
 *   then roll back like the other refusals. A reseed must also keep a recorded review.
 * What: runs `MODEL_STATUS_UPDATE_SQL` and `MODEL_ACTIVATE_SQL` against rows with each review
 *   value, then `loadModelSeeds` and the metrics apply with a change between plan and apply,
 *   and a reseed over a stored `reviewed` review.
 * Test: `npx vitest run tests/unit/licence-gate-pglite-453.test.ts`. No server, no network.
 */

import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MODEL_STATUS_UPDATE_SQL, type ModelLifecycle } from "../../lib/db/repositories/model-lifecycle";
import { applyModelMetricPlans, MODEL_ACTIVATE_SQL, planModelMetrics } from "../../lib/db/repositories/model-metrics-writer";
import { MODEL_SEED_UPSERT_SQL, type ModelSeedDb, type ModelSeedQueryable } from "../../lib/db/repositories/model-seed-writer";
import { MODEL_TERMINAL_BENCH_SOURCE } from "../../lib/rankings/lists";
import { splitStatements } from "../../scripts/apply-migrations";
import { loadModelSeeds, readModelLifecycle, readModelSeeds } from "../../scripts/load-model-seeds";
import { MIGRATION_0016_SQL, TOOLS_AT_0015 } from "./fixtures/tool-links-183-fixture";

vi.setConfig({ testTimeout: 60_000 });

const readFile = (file: string) => readFileSync(file, "utf8");
const LIFECYCLE = readModelLifecycle(readFile);
const MINIMAX = readModelSeeds("open-weight", readFile).find((e) => e.row.slug === "minimax")!;
const one = (slug: string): ModelLifecycle => ({ checkedAt: LIFECYCLE.checkedAt, rows: LIFECYCLE.rows.filter((r) => r.slug === slug) });

const PENDING = { licenceReview: "pending" };
const REVIEWED = { licenceReview: "reviewed", licenceReviewRuling: "D88" };
const METRICS = {
  metrics: { terminal_bench: 41.2 },
  metrics_provenance: { terminal_bench: { source: MODEL_TERMINAL_BENCH_SOURCE, as_of: "2026-10-01" } },
};

let pg: PGlite | null = null;
afterEach(async () => {
  await pg?.close();
  pg = null;
});

async function freshDb(rows: [slug: string, status: string, data: unknown][]): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(TOOLS_AT_0015);
  for (const statement of splitStatements(MIGRATION_0016_SQL)) await db.exec(statement);
  for (const [slug, status, data] of rows) {
    await db.query(
      `INSERT INTO public."tools" (slug, name, category, kind, status, open_weight, data) VALUES ($1, $1, 'other', 'model', $2, true, $3::jsonb)`,
      [slug, status, JSON.stringify(data)]
    );
  }
  return db;
}

type Hook = (sql: string, tx: ModelSeedQueryable) => Promise<void>;

function asSeedDb(db: PGlite, beforeWrite?: Hook): ModelSeedDb {
  const run = async (q: { query: PGlite["query"] }, text: string, params?: unknown[]) => ({ rows: (await q.query(text, params)).rows as unknown[] });
  return {
    query: (text, params) => run(db, text, params),
    transaction: (fn) =>
      db.transaction((tx) =>
        fn({
          query: async (text, params) => {
            if (beforeWrite) await beforeWrite(text, { query: (t, p) => run(tx, t, p) });
            return run(tx, text, params);
          },
        })
      ),
  };
}

async function row(db: PGlite, slug: string) {
  const { rows } = await db.query<{ status: string; data: Record<string, unknown> }>(`SELECT status, data FROM public."tools" WHERE slug = $1`, [slug]);
  return rows[0]!;
}

describe("UPDATE guards (#453)", () => {
  const record = JSON.stringify({ issue: 453 });

  it.each<[string, string, unknown, string, number]>([
    ["refuses inactive -> active with a pending review", "inactive", { modelSeed: PENDING }, "active", 0],
    ["refuses a reviewed review without a ruling", "inactive", { modelSeed: { licenceReview: "reviewed" } }, "active", 0],
    ["refuses an unknown review value", "inactive", { modelSeed: { licenceReview: "approved" } }, "active", 0],
    ["refuses a modelSeed that is not an object", "inactive", { modelSeed: "pending" }, "active", 0],
    ["sets active -> active on a pending row (D83)", "active", { modelSeed: PENDING }, "active", 1],
    ["activates a reviewed row with a ruling", "inactive", { modelSeed: REVIEWED }, "active", 1],
    ["activates a not_required row", "inactive", { modelSeed: { licenceReview: "not_required" } }, "active", 1],
    ["activates a null review", "inactive", { modelSeed: { licenceReview: null } }, "active", 1],
    ["activates a row with no modelSeed", "inactive", {}, "active", 1],
    ["archives a pending row", "inactive", { modelSeed: PENDING }, "deprecated", 1],
  ])("status step: %s", async (_name, status, data, target, matched) => {
    pg = await freshDb([["m", status, data]]);
    const { rows } = await pg.query(MODEL_STATUS_UPDATE_SQL, ["m", target, record]);
    expect(rows).toHaveLength(matched);
    expect((await row(pg, "m")).status).toBe(matched === 1 ? target : status);
  });

  it("metrics activation matches a reviewed row and never a pending one", async () => {
    pg = await freshDb([
      ["pend", "inactive", { ...METRICS, modelSeed: PENDING }],
      ["rev", "inactive", { ...METRICS, modelSeed: REVIEWED }],
      ["legacy", "inactive", METRICS],
    ]);
    const { rows } = await pg.query<{ slug: string }>(MODEL_ACTIVATE_SQL, [["pend", "rev", "legacy"], MODEL_TERMINAL_BENCH_SOURCE]);
    expect(rows.map((r) => r.slug).sort()).toEqual(["legacy", "rev"]);
    expect((await row(pg, "pend")).status).toBe("inactive");
  });
});

describe("write-time refusal rolls the apply back (#453)", () => {
  it("--set-status: a review turned pending after planning writes nothing", async () => {
    pg = await freshDb([["minimax", "inactive", { modelSeed: REVIEWED }]]);
    const before = await row(pg, "minimax");
    let fired = false;
    const db = asSeedDb(pg, async (sql, tx) => {
      if (sql === MODEL_STATUS_UPDATE_SQL && !fired) {
        fired = true;
        await tx.query(`UPDATE public."tools" SET data = jsonb_set(data, '{modelSeed,licenceReview}', '"pending"') WHERE slug = 'minimax'`);
      }
    });
    const log: string[] = [];
    expect(await loadModelSeeds(db, [], true, (l) => log.push(l), one("minimax"))).toBe(1);
    expect(fired).toBe(true);
    expect(log.at(-1)).toMatch(/^apply: rolled back, nothing written: minimax: row changed since planning/);
    expect(await row(pg, "minimax")).toEqual(before);
  });

  it("--activate: a review turned pending after planning writes nothing", async () => {
    pg = await freshDb([["minimax", "inactive", { ...METRICS, modelSeed: REVIEWED }]]);
    const plan = await planModelMetrics(asSeedDb(pg), [], ["minimax"]);
    expect(plan.activation).toEqual([{ slug: "minimax", outcome: "activate" }]);
    await pg.query(`UPDATE public."tools" SET data = jsonb_set(data, '{modelSeed,licenceReview}', '"pending"') WHERE slug = 'minimax'`);
    await expect(asSeedDb(pg).transaction((tx) => applyModelMetricPlans(tx, plan))).rejects.toThrow(/activation matched 0 of 1/);
    expect((await row(pg, "minimax")).status).toBe("inactive");
  });

  it("--set-status: a pending seed row is refused at plan time and nothing is written", async () => {
    pg = await freshDb([]);
    const log: string[] = [];
    expect(await loadModelSeeds(asSeedDb(pg), [MINIMAX], true, (l) => log.push(l), one("minimax"))).toBe(1);
    expect(log.some((l) => /minimax.*licence review is pending/.test(l))).toBe(true);
    expect(log.at(-1)).toBe("apply: nothing written because a row was refused");
    expect((await pg.query(`SELECT 1 FROM public."tools"`)).rows).toHaveLength(0);
  });
});

describe("reseed keeps a recorded review (#453)", () => {
  it("an unchanged pending seed leaves a stored reviewed review and its ruling, and the row can activate", async () => {
    pg = await freshDb([]);
    expect(await loadModelSeeds(asSeedDb(pg), [MINIMAX], true, () => {})).toBe(0);
    // The owner's ruling recorded on the stored row.
    await pg.query(`UPDATE public."tools" SET data = jsonb_set(data, '{modelSeed}', data->'modelSeed' || '{"licenceReview":"reviewed","licenceReviewRuling":"D88"}') WHERE slug = 'minimax'`);
    const log: string[] = [];
    expect(await loadModelSeeds(asSeedDb(pg), [MINIMAX], true, (l) => log.push(l), one("minimax"))).toBe(0);
    expect(log).toContain("totals: 1 row(s), 0 insert, 0 update, 1 unchanged, 0 refused");
    const after = await row(pg, "minimax");
    expect(after.status).toBe("active");
    expect(after.data["modelSeed"]).toMatchObject(REVIEWED);
  });

  it("a stored review changed between plan and a reseed write rolls the reseed back", async () => {
    pg = await freshDb([]);
    expect(await loadModelSeeds(asSeedDb(pg), [MINIMAX], true, () => {})).toBe(0);
    await pg.query(
      `UPDATE public."tools" SET data = jsonb_set(data, '{modelSeed}', data->'modelSeed' || '{"licenceReview":"reviewed","licenceReviewRuling":"D88","checkedAt":"2000-01-01"}') WHERE slug = 'minimax'`
    );
    const before = await row(pg, "minimax");
    let fired = false;
    const db = asSeedDb(pg, async (sql, tx) => {
      if (sql === MODEL_SEED_UPSERT_SQL && !fired) {
        fired = true;
        await tx.query(`UPDATE public."tools" SET data = jsonb_set(data, '{modelSeed,licenceReviewRuling}', '"D99"') WHERE slug = 'minimax'`);
      }
    });
    expect(await loadModelSeeds(db, [MINIMAX], true, () => {})).toBe(1);
    expect(fired).toBe(true);
    expect(await row(pg, "minimax")).toEqual(before);
  });
});
