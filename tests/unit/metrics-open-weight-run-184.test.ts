/**
 * #184: one open-weight collection run, its store, and the guarantee that the scheduled
 * metrics run does not reach it.
 *
 * Why: a failed or missing model must mark the run partial or failed and write no row (never
 *   a 0), the store must write only the two history tables, and the 11-01 scheduled run must
 *   stay exactly as it was: no route, registry entry or cron may name the new collector.
 * What: `runOpenWeightCollection` over an in-memory store (every error arm); the real drizzle
 *   store over a recording `pg-proxy` database; and source-contract checks on the cron route,
 *   registry, vercel.json and the check workflow.
 * Test: `npx vitest run tests/unit/metrics-open-weight-run-184.test.ts`. No server, no network.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { drizzle } from "drizzle-orm/pg-proxy";
import { describe, expect, it } from "vitest";
import { COLLECTOR_PARTS, SHARD_COUNTS } from "../../lib/metrics-collectors/registry";
import type { ModelMetricLeaves } from "../../lib/metrics-collectors/huggingface";
import type { HistoryRow } from "../../lib/metrics-history/collect-shard";
import {
  OPEN_WEIGHT_COLLECTOR,
  type OpenWeightModel,
  type OpenWeightRunResult,
  runOpenWeightCollection,
} from "../../lib/metrics-history/collect-open-weight";
import { createOpenWeightStore } from "../../lib/metrics-history/store";
import { exitCodeFor } from "../../scripts/collect-open-weight-metrics";

const ROOT = path.resolve(__dirname, "../..");
const NOW = Date.parse("2026-11-03T10:00:00.000Z");

const MODELS: OpenWeightModel[] = [
  { id: "id-a", slug: "model-a", hfRepo: "acme/a" },
  { id: "id-b", slug: "model-b", hfRepo: "acme/b" },
  { id: "id-c", slug: "model-c", hfRepo: "acme/c" },
];
const LEAVES: ModelMetricLeaves = { likes: { value: 4, source: "huggingface-hub-api", as_of: "x" } };

function memoryStore(models: OpenWeightModel[], opts: { failUpsert?: boolean; failLedger?: boolean } = {}) {
  const rows: HistoryRow[] = [];
  const runs: OpenWeightRunResult[] = [];
  return {
    rows,
    runs,
    store: {
      listModels: async () => models,
      upsertMetrics: async (row: HistoryRow) => {
        if (opts.failUpsert) throw new Error("db connection lost");
        rows.push(row);
      },
      recordRun: async (result: OpenWeightRunResult) => {
        if (opts.failLedger) throw new Error("ledger down");
        runs.push(result);
      },
    },
  };
}

const run = (store: ReturnType<typeof memoryStore>["store"], collect: Parameters<typeof runOpenWeightCollection>[0]["collect"], extra = {}) =>
  runOpenWeightCollection({ store, collect, now: () => NOW, pause: async () => {}, ...extra });

function invariant(counts: OpenWeightRunResult["counts"]) {
  expect(counts.recorded + counts.not_found + counts.failed + counts.skipped_timeout).toBe(counts.attempted);
}

describe("#184 runOpenWeightCollection", () => {
  it("records one row per model under the huggingface key and finishes ok", async () => {
    const m = memoryStore(MODELS);
    const { result, ledgerError } = await run(m.store, async () => LEAVES);
    expect(result.status).toBe("ok");
    expect(result.counts).toMatchObject({ attempted: 3, recorded: 3, failed: 0 });
    expect(m.rows.map((r) => r.toolSlug)).toEqual(["model-a", "model-b", "model-c"]);
    expect(m.rows[0]).toMatchObject({ collectedDate: "2026-11-03", period: "2026-11", metrics: { huggingface: LEAVES } });
    expect(m.runs).toHaveLength(1);
    expect(ledgerError).toBeNull();
  });

  it("a throwing model counts failed, writes no row, and makes the run partial", async () => {
    const m = memoryStore(MODELS);
    const { result } = await run(m.store, async (repo) => {
      if (repo === "acme/b") throw new Error("Hugging Face Hub returned HTTP 429 for a model request");
      return LEAVES;
    });
    expect(result.status).toBe("partial");
    expect(result.counts).toMatchObject({ recorded: 2, failed: 1 });
    expect(result.error).toContain("model-b");
    expect(m.rows.map((r) => r.toolSlug)).toEqual(["model-a", "model-c"]);
    invariant(result.counts);
  });

  it("a 404 (null) counts not_found, writes no row, and makes the run partial", async () => {
    const m = memoryStore(MODELS);
    const { result } = await run(m.store, async (repo) => (repo === "acme/c" ? null : LEAVES));
    expect(result.status).toBe("partial");
    expect(result.counts).toMatchObject({ recorded: 2, not_found: 1 });
    expect(m.rows.map((r) => r.toolSlug)).not.toContain("model-c");
    invariant(result.counts);
  });

  it("every model failing makes the run failed and writes no history row", async () => {
    const m = memoryStore(MODELS);
    const { result } = await run(m.store, async () => {
      throw new Error("fetch failed");
    });
    expect(result.status).toBe("failed");
    expect(result.counts).toMatchObject({ recorded: 0, failed: 3 });
    expect(m.rows).toHaveLength(0);
    expect(m.runs[0]?.status).toBe("failed");
  });

  it("an empty model set is a failed run, not a clean one", async () => {
    const m = memoryStore([]);
    const { result } = await run(m.store, async () => LEAVES);
    expect(result.status).toBe("failed");
    expect(result.error).toMatch(/no open-weight model/);
    expect(m.runs[0]?.status).toBe("failed");
  });

  it("a store throw is fatal: the run fails and the unreached models count as failed", async () => {
    const m = memoryStore(MODELS, { failUpsert: true });
    const { result } = await run(m.store, async () => LEAVES);
    expect(result.status).toBe("failed");
    expect(result.error).toBe("db connection lost");
    expect(result.counts).toMatchObject({ recorded: 0, failed: 3 });
    invariant(result.counts);
  });

  it("a ledger throw is reported, not hidden", async () => {
    const m = memoryStore(MODELS, { failLedger: true });
    const { result, ledgerError } = await run(m.store, async () => LEAVES);
    expect(result.status).toBe("ok");
    expect(ledgerError).toBe("ledger down");
    expect(exitCodeFor(result.status, ledgerError)).toBe(1);
  });

  it("past the deadline the remaining models are skipped and no row is written for them", async () => {
    const m = memoryStore(MODELS);
    let clock = NOW;
    const { result } = await run(m.store, async () => LEAVES, {
      now: () => clock,
      deadlineMs: 1000,
      pause: async () => {
        clock += 2000;
      },
    });
    expect(result.status).toBe("partial");
    expect(result.counts).toMatchObject({ recorded: 1, skipped_timeout: 2 });
    expect(m.rows).toHaveLength(1);
    invariant(result.counts);
  });

  it("a dry run collects and counts but writes no history row and no ledger row", async () => {
    const m = memoryStore(MODELS);
    const { result } = await run(m.store, async () => LEAVES, { dryRun: true });
    expect(result.counts.recorded).toBe(3);
    expect(m.rows).toHaveLength(0);
    expect(m.runs).toHaveLength(0);
  });

  it("maps statuses to exit codes: ok 0, partial 2, failed 1", () => {
    expect([exitCodeFor("ok", null), exitCodeFor("partial", null), exitCodeFor("failed", null)]).toEqual([0, 2, 1]);
  });
});

describe("#184 createOpenWeightStore SQL", () => {
  it("reads tools once, writes only the two history tables, and tags the ledger row", async () => {
    const statements: Array<{ text: string; params: unknown[] }> = [];
    const db = drizzle(async (text: string, params: unknown[]) => {
      statements.push({ text, params });
      return { rows: text.startsWith("select") ? [["id-a", "model-a", "acme/a"]] : [] };
    });
    const store = createOpenWeightStore(db);
    expect(await store.listModels()).toEqual([{ id: "id-a", slug: "model-a", hfRepo: "acme/a" }]);
    await store.upsertMetrics({ toolId: "id-a", toolSlug: "model-a", collectedDate: "2026-11-03", period: "2026-11", metrics: { huggingface: LEAVES } });
    const now = new Date(NOW);
    await store.recordRun({ collectedDate: "2026-11-03", period: "2026-11", status: "ok", counts: { attempted: 1, recorded: 1, not_found: 0, failed: 0, skipped_timeout: 0 }, error: null, startedAt: now, finishedAt: now });

    const [select, upsert, ledger] = statements;
    expect(select?.text).toMatch(/from "tools" where/i);
    expect(select?.text).toMatch(/"kind" = \$1/);
    expect(select?.params).toEqual(["model", true]);
    expect(upsert?.text).toMatch(/^insert into "tool_metrics_history"/i);
    expect(ledger?.text).toMatch(/^insert into "metrics_collection_runs"/i);
    expect(ledger?.params).toContain(OPEN_WEIGHT_COLLECTOR);
    const writes = statements.filter((s) => !/^select/i.test(s.text));
    expect(writes.every((s) => !/"tools"/.test(s.text.replace(/"tool_metrics_history"/g, "")))).toBe(true);
  });
});

describe("#184 the scheduled metrics run cannot reach the open-weight collector", () => {
  const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
  const NEEDLE = /huggingface|open-weight|open_weight|collect-open-weight/i;

  it.each([
    "app/api/cron/collect-metrics/route.ts",
    "lib/metrics-collectors/registry.ts",
    "lib/metrics-history/collect-shard.ts",
    "vercel.json",
    ".github/workflows/check-metrics-history.yml",
  ])("%s does not mention the open-weight collector", (file) => {
    expect(read(file)).not.toMatch(NEEDLE);
  });

  it("the registered parts and shard counts are unchanged", () => {
    expect([...COLLECTOR_PARTS]).toEqual(["github", "pypi", "npm", "vscode"]);
    expect(SHARD_COUNTS).toEqual({ github: 1, pypi: 2, npm: 4, vscode: 4 });
  });

  it("the shared store file imports the runner module for its type only, so the cron route never loads it", () => {
    const imports = read("lib/metrics-history/store.ts").match(/^import .*collect-open-weight.*$/gm) ?? [];
    expect(imports).toHaveLength(1);
    expect(imports[0]).toMatch(/^import type /);
  });

  it("no app route imports the collector or the runner", () => {
    const importers = ["app/api/cron/collect-metrics/route.ts", "app/api/cron/regenerate-rankings/route.ts"];
    for (const file of importers) expect(read(file)).not.toMatch(/collect-open-weight|metrics-collectors\/huggingface/);
  });
});
