/**
 * #329: the model metrics loader's arguments, defaults and statements.
 *
 * Why: the loader writes `tools` rows in production. Its default must write nothing and never
 *   activate; activation must need `--apply` and a separate flag; the public workflow log must
 *   carry no figure.
 * What: checks `parseArgs` (defaults, the metrics path sources, refused combinations), then runs
 *   `loadModelMetrics` over synthetic figures against a stand-in database boundary that records
 *   each statement, and checks statements, transactions, exit codes and printed lines.
 * Test: `npx vitest run tests/unit/load-model-metrics-329.test.ts`. No database, no network.
 */

import { describe, expect, it } from "vitest";
import { MODEL_METRICS_DEFAULT_PATH, parseModelMetricsSeed } from "../../lib/db/repositories/model-metrics-seed.repository";
import {
  MODEL_ACTIVATE_SQL,
  MODEL_METRIC_UPDATE_SQL,
  MODEL_METRICS_SELECT_SQL,
} from "../../lib/db/repositories/model-metrics-writer";
import type { ModelSeedDb } from "../../lib/db/repositories/model-seed-writer";
import { MODEL_TERMINAL_BENCH_SOURCE } from "../../lib/rankings/lists";
import { loadModelMetrics, parseArgs } from "../../scripts/load-model-metrics";
import { METRIC_SLUGS, syntheticMetricsDoc, syntheticValue } from "./fixtures/model-metrics-329-fixture";

const SEED = parseModelMetricsSeed(JSON.stringify(syntheticMetricsDoc()), new Set(METRIC_SLUGS));

interface Call {
  sql: string;
  params: unknown[];
  inTransaction: boolean;
}

function existing(slug: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    slug,
    kind: "model",
    status: "inactive",
    redirect_to: null,
    metrics_type: null,
    provenance_type: null,
    metric_data: { metrics: null, metrics_provenance: null },
    ...overrides,
  };
}

function boundary(found: Record<string, unknown>[], activated?: (params: unknown[]) => unknown[]) {
  const calls: Call[] = [];
  let transactions = 0;
  const answer = (sql: string, params: unknown[]): unknown[] => {
    if (sql === MODEL_METRICS_SELECT_SQL) return found;
    if (sql === MODEL_ACTIVATE_SQL) return activated ? activated(params) : (params[0] as string[]).map((slug) => ({ slug }));
    return [{ slug: params[0] }];
  };
  const db: ModelSeedDb = {
    async query(sql, params = []) {
      calls.push({ sql, params, inTransaction: false });
      return { rows: answer(sql, params) };
    },
    async transaction(fn) {
      transactions++;
      return fn({
        async query(sql, params = []) {
          calls.push({ sql, params, inTransaction: true });
          return { rows: answer(sql, params) };
        },
      });
    },
  };
  return { db, calls, transactions: () => transactions };
}

const ALL_INACTIVE = METRIC_SLUGS.map((slug) => existing(slug));

describe("parseArgs (#329)", () => {
  it("defaults to a dry run with no activation, reading the gitignored path", () => {
    expect(parseArgs([], {})).toEqual({
      metricsFile: MODEL_METRICS_DEFAULT_PATH,
      apply: false,
      activate: false,
      checkActivation: false,
      hideValues: false,
    });
    expect(parseArgs(["--apply"], {})).toMatchObject({ apply: true, activate: false });
  });

  it("takes the metrics path from MODEL_METRICS_FILE, and the flag over the env", () => {
    expect(parseArgs([], { MODEL_METRICS_FILE: "/secure/m.json" })).toMatchObject({ metricsFile: "/secure/m.json" });
    expect(parseArgs(["--metrics-file", "/tmp/x.json"], { MODEL_METRICS_FILE: "/secure/m.json" })).toMatchObject({ metricsFile: "/tmp/x.json" });
  });

  it.each([
    [["--activate"], "--activate needs --apply"],
    [["--dry-run", "--activate"], "--activate needs --apply"],
    [["--apply", "--dry-run"], "--dry-run and --apply are exclusive"],
    [["--apply", "--check-activation"], "--check-activation is for a dry run; pass --activate with --apply"],
    [["--metrics-file"], "--metrics-file needs a path"],
    [["--seed", "closed"], "unknown argument --seed"],
  ])("refuses %j", (argv, error) => {
    const parsed = parseArgs(argv, {});
    expect("errors" in parsed && parsed.errors).toContain(error);
  });
});

describe("loadModelMetrics (#329)", () => {
  it("a dry run plans with one SELECT, prints the diff and writes nothing", async () => {
    const { db, calls, transactions } = boundary(ALL_INACTIVE);
    const log: string[] = [];
    expect(await loadModelMetrics(db, SEED, { apply: false, activationTargets: null, hideValues: false }, (l) => log.push(l))).toBe(0);
    expect(calls.map((c) => c.sql)).toEqual([MODEL_METRICS_SELECT_SQL]);
    expect(transactions()).toBe(0);
    expect(log).toContain(`would update: ${METRIC_SLUGS[0]}`);
    expect(log).toContain(`  metrics.terminal_bench: (null) -> ${syntheticValue(0)}`);
    expect(log).toContain(
      `totals: ${METRIC_SLUGS.length} metric row(s), ${METRIC_SLUGS.length} update, 0 unchanged, 0 refused; activation: not requested`
    );
    expect(log.at(-1)).toBe("dry run: nothing written (pass --apply to write)");
  });

  it("an apply without --activate writes the metrics in one transaction and never activates", async () => {
    const { db, calls, transactions } = boundary(ALL_INACTIVE);
    const log: string[] = [];
    expect(await loadModelMetrics(db, SEED, { apply: true, activationTargets: null, hideValues: false }, (l) => log.push(l))).toBe(0);
    expect(transactions()).toBe(1);
    const writes = calls.filter((c) => c.inTransaction);
    expect(writes.map((c) => c.sql)).toEqual(METRIC_SLUGS.map(() => MODEL_METRIC_UPDATE_SQL));
    expect(writes[0]!.params).toEqual([METRIC_SLUGS[0], syntheticValue(0), MODEL_TERMINAL_BENCH_SOURCE, "2026-10-20"]);
    expect(calls.some((c) => c.sql === MODEL_ACTIVATE_SQL)).toBe(false);
    expect(log.at(-1)).toBe(`apply: committed, ${METRIC_SLUGS.length} metric row(s) written, 0 row(s) activated`);
  });

  it("the metric statement never names status; the activation statement guards kind, status and the Vals source", () => {
    expect(MODEL_METRIC_UPDATE_SQL).not.toMatch(/SET[\s\S]*\bstatus\s*=/);
    expect(MODEL_METRIC_UPDATE_SQL).toContain("status <> 'redirect'");
    expect(MODEL_ACTIVATE_SQL).toContain("kind = 'model' AND status = 'inactive'");
    expect(MODEL_ACTIVATE_SQL).toContain("split_part(data->'metrics_provenance'->'terminal_bench'->>'source', '#', 1) = $2");
  });

  it("with --activate, activates the inactive targets after the metric writes, inside the same transaction", async () => {
    const found = METRIC_SLUGS.map((slug, i) => existing(slug, i === 0 ? { status: "active" } : {}));
    const { db, calls, transactions } = boundary(found);
    const log: string[] = [];
    const code = await loadModelMetrics(db, SEED, { apply: true, activationTargets: METRIC_SLUGS, hideValues: false }, (l) => log.push(l));
    expect(code).toBe(0);
    expect(transactions()).toBe(1);
    const last = calls.at(-1)!;
    expect(last).toEqual({ sql: MODEL_ACTIVATE_SQL, params: [METRIC_SLUGS.slice(1), MODEL_TERMINAL_BENCH_SOURCE], inTransaction: true });
    expect(log).toContain(`already active: ${METRIC_SLUGS[0]}`);
    expect(log).toContain(`will activate: ${METRIC_SLUGS[1]}`);
  });

  it("rolls back when the activation matches fewer rows than planned", async () => {
    const { db } = boundary(ALL_INACTIVE, () => []);
    const log: string[] = [];
    expect(await loadModelMetrics(db, SEED, { apply: true, activationTargets: METRIC_SLUGS, hideValues: false }, (l) => log.push(l))).toBe(1);
    expect(log.at(-1)).toMatch(new RegExp(`^apply: rolled back, nothing written: activation matched 0 of ${METRIC_SLUGS.length} row\\(s\\)`));
  });

  it.each([
    ["a missing row", (slug: string) => (slug === "glm" ? null : existing(slug)), "REFUSED: glm: no tools row with this slug; load the model seed first"],
    ["a redirect row", (slug: string) => existing(slug, slug === "glm" ? { status: "redirect", redirect_to: "x" } : {}), "REFUSED: glm: slug is a redirect alias (data.redirect_to: x)"],
    ["a harness row", (slug: string) => existing(slug, slug === "glm" ? { kind: "harness" } : {}), "REFUSED: glm: slug is held by a harness row, not a model"],
    ["a non-object metrics value", (slug: string) => existing(slug, slug === "glm" ? { metrics_type: "string" } : {}), "REFUSED: glm: data.metrics is a string, not an object"],
  ])("refuses %s and writes nothing", async (_name, make, line) => {
    const { db, transactions } = boundary(METRIC_SLUGS.map(make).filter((r) => r !== null) as Record<string, unknown>[]);
    const log: string[] = [];
    expect(await loadModelMetrics(db, SEED, { apply: true, activationTargets: null, hideValues: false }, (l) => log.push(l))).toBe(1);
    expect(log).toContain(line);
    expect(log.at(-1)).toBe("apply: nothing written because a row was refused");
    expect(transactions()).toBe(0);
  });

  it("refuses activation of a target row with no figure, and of a row in another status", async () => {
    const partial = parseModelMetricsSeed(JSON.stringify(syntheticMetricsDoc(METRIC_SLUGS.slice(1))), new Set(METRIC_SLUGS));
    const found = METRIC_SLUGS.map((slug) => existing(slug, slug === METRIC_SLUGS[1] ? { status: "deprecated" } : {}));
    const { db, transactions } = boundary(found);
    const log: string[] = [];
    expect(await loadModelMetrics(db, partial, { apply: true, activationTargets: METRIC_SLUGS, hideValues: false }, (l) => log.push(l))).toBe(1);
    expect(log).toContain(`REFUSED activation: ${METRIC_SLUGS[0]}: row would carry no Vals Terminal-Bench 4.0 figure after the write`);
    expect(log).toContain(`REFUSED activation: ${METRIC_SLUGS[1]}: status is deprecated; only inactive rows are activated`);
    expect(transactions()).toBe(0);
  });

  it("--hide-values prints no figure", async () => {
    const { db } = boundary(ALL_INACTIVE);
    const log: string[] = [];
    await loadModelMetrics(db, SEED, { apply: false, activationTargets: METRIC_SLUGS, hideValues: true }, (l) => log.push(l));
    expect(log).toContain("  metrics.terminal_bench: (unset) -> (new value)");
    // #329: the totals line holds row counts, not figures; a count can equal a synthetic value.
    const text = log.filter((l) => !l.startsWith("totals: ")).join("\n");
    for (const row of SEED.rows) expect(text).not.toMatch(new RegExp(`\\b${row.value}\\b`));
  });
});
