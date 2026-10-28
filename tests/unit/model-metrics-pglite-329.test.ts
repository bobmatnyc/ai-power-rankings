/**
 * #329: the model metrics write and activation on real Postgres (PGlite).
 *
 * Why: the merge of two jsonb keys, the redirect and kind guards, the activation guard and the
 *   all-or-nothing rollback are executor behaviour a recorded-SQL double cannot show.
 * What: builds `tools` as of migration 0016 with model, redirect and harness rows, then runs
 *   `loadModelMetrics` (the real `MODEL_METRIC_UPDATE_SQL` and `MODEL_ACTIVATE_SQL`) over PGlite
 *   with synthetic figures. Asserts every other key of `data`, `data.metrics` and
 *   `data.metrics_provenance` survives, status never changes without `--activate`, activation
 *   flips only the listed inactive model rows, a redirect row is never written, a failure mid-way
 *   rolls the whole write back, and a re-run is unchanged.
 * Test: `npx vitest run tests/unit/model-metrics-pglite-329.test.ts`. No server, no network.
 */

import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { metricDataAfterWrite, parseModelMetricsSeed } from "../../lib/db/repositories/model-metrics-seed.repository";
import {
  applyModelMetricPlans,
  MODEL_ACTIVATE_SQL,
  MODEL_METRIC_UPDATE_SQL,
  planModelMetrics,
} from "../../lib/db/repositories/model-metrics-writer";
import type { ModelSeedDb } from "../../lib/db/repositories/model-seed-writer";
import { hasCodingMetric, MODEL_TERMINAL_BENCH_SOURCE } from "../../lib/rankings/lists";
import { splitStatements } from "../../scripts/apply-migrations";
import { loadModelMetrics } from "../../scripts/load-model-metrics";
import { MIGRATION_0016_SQL, TOOLS_AT_0015 } from "./fixtures/tool-links-183-fixture";
import { syntheticMetricRow, syntheticMetricsDoc } from "./fixtures/model-metrics-329-fixture";

const PRIOR_DATA = {
  info: { description: "Open-weight model family.", company: "Z.ai" },
  modelSeed: { issue: 329, seedFile: "docs/refresh/open-weight-models-refresh.json" },
  metrics: { users: 1200, swe_bench: { verified: 12.5 }, terminal_bench: 3 },
  metrics_provenance: { users: { source: "https://example.com/users", as_of: "2026-01-01" }, terminal_bench: { source: "https://example.com/old", as_of: "2025-01-01" } },
};

const KNOWN = new Set(["glm", "kimi", "qwen", "deepseek"]);

async function freshDb(): Promise<PGlite> {
  const pg = new PGlite();
  await pg.exec(TOOLS_AT_0015);
  for (const statement of splitStatements(MIGRATION_0016_SQL)) await pg.exec(statement);
  const insert = (slug: string, kind: string, status: string, data: unknown) =>
    pg.query(`INSERT INTO public."tools" (slug, name, category, kind, status, data) VALUES ($1, $1, 'other', $2, $3, $4::jsonb)`, [
      slug,
      kind,
      status,
      JSON.stringify(data),
    ]);
  await insert("glm", "model", "inactive", PRIOR_DATA);
  await insert("kimi", "model", "inactive", {});
  await insert("qwen", "model", "active", { metrics: { users: 5 } });
  await insert("deepseek-v3-2", "model", "redirect", { redirect_to: "deepseek", previous_status: "active" });
  await insert("gemma", "model", "inactive", {});
  await insert("cursor", "harness", "active", {});
  return pg;
}

function asDb(pg: PGlite): ModelSeedDb {
  return {
    query: async (text, params) => ({ rows: (await pg.query(text, params)).rows }),
    transaction: (fn) => pg.transaction((tx) => fn({ query: async (text, params) => ({ rows: (await tx.query(text, params)).rows }) })),
  };
}

async function rows(pg: PGlite): Promise<Record<string, { status: string; data: Record<string, unknown> }>> {
  const res = await pg.query<{ slug: string; status: string; data: Record<string, unknown> }>(`SELECT slug, status, data FROM tools ORDER BY slug`);
  return Object.fromEntries(res.rows.map((r) => [r.slug, { status: r.status, data: r.data }]));
}

const seedOf = (slugs: string[]) =>
  parseModelMetricsSeed(JSON.stringify(syntheticMetricsDoc(slugs, slugs.map((s, i) => syntheticMetricRow(s, i)))), KNOWN);
const quiet = () => {};

describe("model metrics write on PGlite (#329)", () => {
  let pg: PGlite;
  beforeEach(async () => {
    pg = await freshDb();
  });
  afterEach(async () => {
    await pg.close();
  });

  it("merges the two keys only, keeps every other key and never changes status by default", async () => {
    const before = await rows(pg);
    const seed = seedOf(["glm", "kimi", "qwen"]);
    expect(await loadModelMetrics(asDb(pg), seed, { apply: true, activationTargets: null, hideValues: false }, quiet)).toBe(0);
    const after = await rows(pg);
    const glm = after["glm"]!.data;
    const expected = metricDataAfterWrite(seed.rows[0]!);
    expect(glm).toEqual({
      ...PRIOR_DATA,
      metrics: { ...PRIOR_DATA.metrics, terminal_bench: expected.metrics.terminal_bench },
      metrics_provenance: { ...PRIOR_DATA.metrics_provenance, terminal_bench: expected.metrics_provenance.terminal_bench },
    });
    expect(after["kimi"]!.data).toEqual(metricDataAfterWrite(seed.rows[1]!));
    expect(after["qwen"]!.data["metrics"]).toEqual({ users: 5, terminal_bench: seed.rows[2]!.value });
    for (const slug of ["glm", "kimi", "qwen"]) expect(hasCodingMetric(after[slug]!.data)).toBe(true);
    // Status unchanged on every row; untouched rows are byte-identical.
    for (const slug of Object.keys(before)) expect(after[slug]!.status).toBe(before[slug]!.status);
    for (const slug of ["deepseek-v3-2", "gemma", "cursor"]) expect(after[slug]).toEqual(before[slug]);
    // A re-run plans nothing.
    const replan = await planModelMetrics(asDb(pg), seed.rows, null);
    expect(replan.metrics.map((p) => p.outcome)).toEqual(["unchanged", "unchanged", "unchanged"]);
  });

  it("never writes a redirect row or another kind, even when the SQL is called directly", async () => {
    const before = await rows(pg);
    for (const slug of ["deepseek-v3-2", "cursor"]) {
      const res = await pg.query(MODEL_METRIC_UPDATE_SQL, [slug, 41, MODEL_TERMINAL_BENCH_SOURCE, "2026-10-20"]);
      expect(res.rows).toEqual([]);
    }
    await pg.query(`UPDATE tools SET data = data || '{"metrics":{"terminal_bench":41},"metrics_provenance":{"terminal_bench":{"source":"${MODEL_TERMINAL_BENCH_SOURCE}"}}}'::jsonb WHERE slug IN ('deepseek-v3-2', 'cursor')`);
    const act = await pg.query(MODEL_ACTIVATE_SQL, [["deepseek-v3-2", "cursor"], MODEL_TERMINAL_BENCH_SOURCE]);
    expect(act.rows).toEqual([]);
    const after = await rows(pg);
    expect(after["deepseek-v3-2"]!.status).toBe(before["deepseek-v3-2"]!.status);
    expect(after["cursor"]!.status).toBe(before["cursor"]!.status);
  });

  it("refuses a redirect slug at planning and writes nothing at all", async () => {
    const before = await rows(pg);
    const seed = parseModelMetricsSeed(
      JSON.stringify(syntheticMetricsDoc([], [syntheticMetricRow("glm", 0), syntheticMetricRow("deepseek-v3-2", 1)])),
      new Set([...KNOWN, "deepseek-v3-2"])
    );
    const log: string[] = [];
    expect(await loadModelMetrics(asDb(pg), seed, { apply: true, activationTargets: null, hideValues: false }, (l) => log.push(l))).toBe(1);
    expect(log).toContain("REFUSED: deepseek-v3-2: slug is a redirect alias (data.redirect_to: deepseek)");
    expect(await rows(pg)).toEqual(before);
  });

  it("activates only the listed inactive model rows, in the same transaction as the metrics", async () => {
    const seed = seedOf(["glm", "kimi", "qwen"]);
    const log: string[] = [];
    const code = await loadModelMetrics(asDb(pg), seed, { apply: true, activationTargets: ["glm", "kimi", "qwen"], hideValues: false }, (l) =>
      log.push(l)
    );
    expect(code).toBe(0);
    expect(log).toContain("apply: committed, 3 metric row(s) written, 2 row(s) activated");
    const after = await rows(pg);
    expect([after["glm"]!.status, after["kimi"]!.status, after["qwen"]!.status]).toEqual(["active", "active", "active"]);
    expect(after["gemma"]!.status).toBe("inactive");
    expect(after["deepseek-v3-2"]!.status).toBe("redirect");
  });

  it("refuses activation when a target row would carry no Vals figure, and writes nothing", async () => {
    const before = await rows(pg);
    const seed = seedOf(["glm"]);
    const log: string[] = [];
    const code = await loadModelMetrics(asDb(pg), seed, { apply: true, activationTargets: ["glm", "gemma"], hideValues: false }, (l) => log.push(l));
    expect(code).toBe(1);
    expect(log).toContain("REFUSED activation: gemma: row would carry no Vals Terminal-Bench 4.0 figure after the write");
    expect(await rows(pg)).toEqual(before);
  });

  it("rolls the whole write back when a row changes between planning and the write", async () => {
    const before = await rows(pg);
    const seed = seedOf(["glm", "kimi"]);
    const plan = await planModelMetrics(asDb(pg), seed.rows, ["glm", "kimi"]);
    await pg.query(`UPDATE tools SET status = 'redirect' WHERE slug = 'kimi'`);
    await expect(asDb(pg).transaction((tx) => applyModelMetricPlans(tx, plan))).rejects.toThrow(/kimi: row changed since planning/);
    const after = await rows(pg);
    expect(after["glm"]).toEqual(before["glm"]);
    expect(after["kimi"]!.data).toEqual(before["kimi"]!.data);
  });
});
