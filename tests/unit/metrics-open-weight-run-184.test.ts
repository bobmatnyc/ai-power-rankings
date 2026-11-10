/**
 * #184: one open-weight collection run, its store, and the guarantee that the scheduled
 * metrics run and scoring do not reach it.
 *
 * Why: a failed or missing model must mark the run partial or failed and write no row (never
 *   a 0), the store must write only the history table, and the scheduled run must stay as it was.
 * What: `runOpenWeightCollection` over an in-memory store (every error arm, concurrency bound);
 *   the real drizzle store over a recording `pg-proxy` database; source checks on the cron
 *   route, registry, vercel.json, the workflow and the scoring read path.
 * Test: `npx vitest run tests/unit/metrics-open-weight-run-184.test.ts`. No server, no network.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { drizzle } from "drizzle-orm/pg-proxy";
import { describe, expect, it } from "vitest";
import type { ModelMetricLeaves } from "../../lib/metrics-collectors/huggingface";
import { COLLECTOR_PARTS, SHARD_COUNTS } from "../../lib/metrics-collectors/registry";
import {
  type OpenWeightModel,
  type OpenWeightRunResult,
  runOpenWeightCollection,
} from "../../lib/metrics-history/collect-open-weight";
import type { HistoryRow } from "../../lib/metrics-history/collect-shard";
import { createOpenWeightStore } from "../../lib/metrics-history/store";
import { exitCodeFor } from "../../scripts/collect-open-weight-metrics";

const ROOT = path.resolve(__dirname, "../..");
const NOW = Date.parse("2026-11-03T10:00:00.000Z");

const MODELS: OpenWeightModel[] = [
  { id: "id-a", slug: "model-a", hfRepo: "acme/a" },
  { id: "id-b", slug: "model-b", hfRepo: "acme/b" },
  { id: "id-c", slug: "model-c", hfRepo: "acme/c" },
];
const LEAVES: ModelMetricLeaves = {
  likes: { value: 4, source: "https://huggingface.co/api/models/acme/a", as_of: "x" },
};

function memoryStore(models: OpenWeightModel[], opts: { failUpsert?: boolean } = {}) {
  const rows: HistoryRow[] = [];
  return {
    rows,
    store: {
      listModels: async () => models,
      upsertMetrics: async (row: HistoryRow) => {
        if (opts.failUpsert) throw new Error("db connection lost");
        rows.push(row);
      },
    },
  };
}

const run = (
  store: ReturnType<typeof memoryStore>["store"],
  collect: Parameters<typeof runOpenWeightCollection>[0]["collect"],
  extra = {}
) => runOpenWeightCollection({ store, collect, now: () => NOW, ...extra });

function invariant(counts: OpenWeightRunResult["counts"]) {
  expect(counts.recorded + counts.not_found + counts.failed + counts.skipped_timeout).toBe(counts.attempted);
}

describe("#184 runOpenWeightCollection", () => {
  it("records one row per model under the huggingface key and finishes ok", async () => {
    const m = memoryStore(MODELS);
    const result = await run(m.store, async () => LEAVES);
    expect(result.status).toBe("ok");
    expect(result.counts).toMatchObject({ attempted: 3, recorded: 3, failed: 0 });
    expect(m.rows.map((r) => r.toolSlug)).toEqual(["model-a", "model-b", "model-c"]);
    expect(m.rows[0]).toMatchObject({
      collectedDate: "2026-11-03",
      period: "2026-11",
      metrics: { huggingface: LEAVES },
    });
  });

  it("a failed fetch for one repo counts failed, writes no row for it, and makes the run partial", async () => {
    const m = memoryStore(MODELS);
    const result = await run(m.store, async (repo) => {
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
    const result = await run(m.store, async (repo) => (repo === "acme/c" ? null : LEAVES));
    expect(result.status).toBe("partial");
    expect(result.counts).toMatchObject({ recorded: 2, not_found: 1 });
    expect(m.rows.map((r) => r.toolSlug)).not.toContain("model-c");
    invariant(result.counts);
  });

  it("every fetch failing makes the run failed and writes no row", async () => {
    const m = memoryStore(MODELS);
    const result = await run(m.store, async () => {
      throw new Error("fetch failed");
    });
    expect(result.status).toBe("failed");
    expect(result.counts).toMatchObject({ recorded: 0, failed: 3 });
    expect(m.rows).toHaveLength(0);
  });

  it("an empty model set is a failed run, not a clean one", async () => {
    const result = await run(memoryStore([]).store, async () => LEAVES);
    expect(result.status).toBe("failed");
    expect(result.error).toMatch(/no model with an hf_repo/);
  });

  it("a store throw is fatal: the run fails and the unreached models count as failed", async () => {
    const m = memoryStore(MODELS, { failUpsert: true });
    const result = await run(m.store, async () => LEAVES, { concurrency: 1 });
    expect(result.status).toBe("failed");
    expect(result.error).toBe("db connection lost");
    expect(result.counts).toMatchObject({ recorded: 0, failed: 3 });
    invariant(result.counts);
  });

  it("past the deadline the remaining models are skipped and no row is written for them", async () => {
    const m = memoryStore(MODELS);
    let clock = NOW;
    const result = await run(
      m.store,
      async () => {
        clock += 2000;
        return LEAVES;
      },
      { now: () => clock, deadlineMs: 1000, concurrency: 1 }
    );
    expect(result.status).toBe("partial");
    expect(result.counts).toMatchObject({ recorded: 1, skipped_timeout: 2 });
    expect(m.rows).toHaveLength(1);
    invariant(result.counts);
  });

  it("never runs more fetches at once than the concurrency bound", async () => {
    const models = Array.from({ length: 9 }, (_, i) => ({ id: `id-${i}`, slug: `m-${i}`, hfRepo: `acme/m${i}` }));
    let active = 0;
    let peak = 0;
    const result = await run(
      memoryStore(models).store,
      async () => {
        active++;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active--;
        return LEAVES;
      },
      { concurrency: 3 }
    );
    expect(result.counts.recorded).toBe(9);
    expect(peak).toBe(3);
  });

  it("a dry run collects and counts but writes no row", async () => {
    const m = memoryStore(MODELS);
    const result = await run(m.store, async () => LEAVES, { dryRun: true });
    expect(result.counts.recorded).toBe(3);
    expect(m.rows).toHaveLength(0);
  });

  it("maps statuses to exit codes: ok 0, partial 2, failed 1", () => {
    expect([exitCodeFor("ok"), exitCodeFor("partial"), exitCodeFor("failed")]).toEqual([0, 2, 1]);
  });
});

describe("#184 createOpenWeightStore SQL", () => {
  it("reads tools once and writes only the history table", async () => {
    const statements: Array<{ text: string; params: unknown[] }> = [];
    const db = drizzle(async (text: string, params: unknown[]) => {
      statements.push({ text, params });
      return { rows: text.startsWith("select") ? [["id-a", "model-a", "acme/a"]] : [] };
    });
    const store = createOpenWeightStore(db);
    expect(await store.listModels()).toEqual([{ id: "id-a", slug: "model-a", hfRepo: "acme/a" }]);
    await store.upsertMetrics({
      toolId: "id-a",
      toolSlug: "model-a",
      collectedDate: "2026-11-03",
      period: "2026-11",
      metrics: { huggingface: LEAVES },
    });
    const [select, upsert] = statements;
    expect(select?.text).toMatch(/from "tools" where/i);
    expect(select?.params).toEqual(["model"]);
    expect(upsert?.text).toMatch(/^insert into "tool_metrics_history"/i);
    expect(statements).toHaveLength(2);
  });
});

describe("#184 the scheduled run and scoring cannot reach the open-weight collector", () => {
  const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
  const NEEDLE = /huggingface|open-weight|open_weight|collect-open-weight/i;

  it.each([
    "app/api/cron/collect-metrics/route.ts",
    "lib/metrics-collectors/registry.ts",
    "lib/metrics-history/collect-shard.ts",
    "lib/metrics-history/point-in-time.ts",
    "vercel.json",
    ".github/workflows/check-metrics-history.yml",
  ])("%s does not mention the open-weight collector", (file) => {
    expect(read(file)).not.toMatch(NEEDLE);
  });

  it("the registered parts and shard counts are unchanged", () => {
    expect([...COLLECTOR_PARTS]).toEqual(["github", "pypi", "npm", "vscode"]);
    // #95: github moved from 1 to 6 shards for the token run; the parts are unchanged.
    expect(SHARD_COUNTS).toEqual({ github: 6, pypi: 2, npm: 4, vscode: 4 });
  });

  it("the shared store file imports the runner module for its type only", () => {
    const imports = read("lib/metrics-history/store.ts").match(/^import .*collect-open-weight.*$/gm) ?? [];
    expect(imports).toHaveLength(1);
    expect(imports[0]).toMatch(/^import type /);
  });
});
