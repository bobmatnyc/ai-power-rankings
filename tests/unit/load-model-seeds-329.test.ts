/**
 * #329: the model seed loader and writer.
 *
 * Why: the loader writes `tools` rows in production. Its default must write nothing, and an
 *   apply must never activate a row or change an existing row's status or metrics.
 * What: runs `loadModelSeeds` over the committed seeds against a stand-in for the database
 *   boundary (`query` / `transaction`) that records each SQL statement and returns given rows,
 *   then checks what the loader sent: statements, parameters, transactions and exit codes.
 * Test: `npx vitest run tests/unit/load-model-seeds-329.test.ts`. No database, no network.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  MODEL_SEED_SELECT_SQL,
  MODEL_SEED_UPSERT_SQL,
  type ModelSeedDb,
  modelSeedProvenance,
  SEED_COLUMNS,
} from "../../lib/db/repositories/model-seed-writer";
import { loadModelSeeds, parseArgs, readModelSeeds, SEEDS } from "../../scripts/load-model-seeds";

const ROOT = path.resolve(__dirname, "../..");
const readFile = (file: string) => readFileSync(path.join(ROOT, file), "utf8");
const ALL = readModelSeeds("all", readFile);

interface Call {
  sql: string;
  params: unknown[];
  inTransaction: boolean;
}

/** The database boundary: records statements; SELECT returns `existing`, an upsert returns `upsertRows`. */
function boundary(existing: Record<string, unknown>[], upsertRows: (params: unknown[]) => unknown[] = (p) => [{ slug: p[0] }]) {
  const calls: Call[] = [];
  let transactions = 0;
  const answer = (sql: string, params: unknown[]) => (sql === MODEL_SEED_SELECT_SQL ? existing : upsertRows(params));
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

function existingRow(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    kind: "model",
    status: "active",
    redirect_to: null,
    open_weight: null,
    hf_repo: null,
    licence: null,
    parameters_b: null,
    active_parameters_b: null,
    release_date: null,
    model_seed: null,
    ...overrides,
  };
}

/** The `DO UPDATE SET ... WHERE` clause: everything the statement can change on an existing row. */
function updateClause(sql: string): string {
  const m = /ON CONFLICT \(slug\) DO UPDATE SET([\s\S]*?)\nWHERE /.exec(sql);
  if (!m) throw new Error("no ON CONFLICT DO UPDATE clause");
  return m[1]!;
}

/** On an existing row the statement writes seed columns, the modelSeed key and updated_at only. */
function assertNeverTouchesStatusOrMetrics(sql: string): void {
  const clause = updateClause(sql);
  expect(clause).not.toMatch(/\bstatus\b/);
  expect(clause).not.toMatch(/metrics/);
  const assigned = clause.split(",\n").map((part) => part.trim().split(" = ")[0]);
  expect(assigned).toEqual([...SEED_COLUMNS, "data", "updated_at"]);
  expect(clause).toContain("data = tools.data || jsonb_build_object('modelSeed', EXCLUDED.data->'modelSeed')");
  // A new row is always inserted inactive, and status is never a parameter.
  expect(sql).toMatch(/VALUES \(\$1, \$2, 'other', 'inactive', 'model', /);
}

describe("#329 loader arguments", () => {
  it("defaults to a dry run over every seed", () => {
    expect(parseArgs([])).toEqual({ seed: "all", apply: false });
    expect(parseArgs(["--seed", "closed"])).toEqual({ seed: "closed", apply: false });
  });

  it("writes only with --apply, and refuses mixed or unknown flags", () => {
    expect(parseArgs(["--apply"])).toEqual({ seed: "all", apply: true });
    expect(parseArgs(["--apply", "--dry-run"])).toHaveProperty("errors");
    expect(parseArgs(["--force"])).toHaveProperty("errors");
    expect(parseArgs(["--seed", "muse"])).toHaveProperty("errors");
  });
});

describe("#329 readModelSeeds", () => {
  it("validates the committed seeds together", () => {
    // #329: 8 closed + 5 open-weight + the per-major seed.
    expect(ALL.map((e) => e.row.slug)).toHaveLength(13 + readModelSeeds("majors", readFile).length);
    expect(readModelSeeds("open-weight", readFile).every((e) => e.seedFile === SEEDS["open-weight"].file)).toBe(true);
  });

  it("throws on a slug used in two seed files", () => {
    const clash = (file: string) =>
      file === SEEDS["open-weight"].file ? readFile(file).replace('"slug": "deepseek"', '"slug": "claude-haiku"') : readFile(file);
    expect(() => readModelSeeds("all", clash)).toThrow(/duplicate slug: claude-haiku/);
  });
});

describe("#329 loadModelSeeds", () => {
  it("writes nothing by default: one SELECT, no transaction, a diff and totals", async () => {
    const { db, calls, transactions } = boundary([]);
    const lines: string[] = [];
    const args = parseArgs([]);
    if ("errors" in args) throw new Error("default args refused");
    const code = await loadModelSeeds(db, ALL, args.apply, (l) => lines.push(l));
    expect(code).toBe(0);
    expect(calls.map((c) => c.sql)).toEqual([MODEL_SEED_SELECT_SQL]);
    expect(transactions()).toBe(0);
    expect(lines).toContain("  hf_repo: (null) -> deepseek-ai/DeepSeek-V4.1-Flash");
    expect(lines).toContain(`totals: ${ALL.length} row(s), ${ALL.length} insert, 0 update, 0 unchanged, 0 refused`);
    expect(lines.at(-1)).toBe("dry run: nothing written (pass --apply to write)");
  });

  it("on apply, refreshes an existing active row without writing its status or metrics", async () => {
    const deepseek = existingRow({ slug: "deepseek", hf_repo: "deepseek-ai/DeepSeek-V3.2", licence: "mit", parameters_b: "685.4" });
    const { db, calls, transactions } = boundary([deepseek]);
    const lines: string[] = [];
    const entries = ALL.filter((e) => e.row.slug === "deepseek");
    // #334: replacing a stored curated value needs the owner's overwrite.
    const overwrites = [
      { slug: "deepseek", column: "hf_repo" as const },
      { slug: "deepseek", column: "parameters_b" as const },
    ];
    expect(await loadModelSeeds(db, entries, true, (l) => lines.push(l), null, [], overwrites)).toBe(0);
    expect(lines).toContain("  hf_repo: deepseek-ai/DeepSeek-V3.2 -> deepseek-ai/DeepSeek-V4.1-Flash (overwrite)");
    expect(lines).toContain("  parameters_b: 685.4 -> 552 (overwrite)");
    expect(transactions()).toBe(1);
    const writes = calls.filter((c) => c.inTransaction);
    expect(writes).toHaveLength(1);
    expect(writes[0]!.sql).toBe(MODEL_SEED_UPSERT_SQL);
    expect(writes[0]!.params).not.toContain("active");
    assertNeverTouchesStatusOrMetrics(writes[0]!.sql);
  });

  it("the status-and-metrics check fails on a statement that writes either", () => {
    const setsStatus = MODEL_SEED_UPSERT_SQL.replace("  updated_at = now()", "  status = EXCLUDED.status,\n  updated_at = now()");
    const setsMetrics = MODEL_SEED_UPSERT_SQL.replace("'modelSeed', EXCLUDED.data->'modelSeed'", "'metrics', EXCLUDED.data->'metrics'");
    expect(setsStatus).not.toBe(MODEL_SEED_UPSERT_SQL);
    expect(setsMetrics).not.toBe(MODEL_SEED_UPSERT_SQL);
    expect(() => assertNeverTouchesStatusOrMetrics(setsStatus)).toThrow();
    expect(() => assertNeverTouchesStatusOrMetrics(setsMetrics)).toThrow();
  });

  it("is idempotent: a row that already matches the seed is unchanged and not written", async () => {
    const entry = ALL.find((e) => e.row.slug === "minimax")!;
    // jsonb returns keys in its own order; the comparison must not depend on it.
    const stored = Object.fromEntries(Object.entries(modelSeedProvenance(entry)).reverse());
    const minimax = existingRow({
      slug: "minimax",
      open_weight: true,
      hf_repo: "MiniMaxAI/MiniMax-M3.1-Flash",
      licence: "minimax-community",
      parameters_b: "428.0",
      active_parameters_b: "23",
      release_date: "2026-10-23",
      model_seed: stored,
    });
    const { db, calls } = boundary([minimax]);
    const lines: string[] = [];
    expect(await loadModelSeeds(db, [entry], true, (l) => lines.push(l))).toBe(0);
    expect(lines[0]).toBe(`unchanged: minimax (${SEEDS["open-weight"].file})`);
    expect(calls.filter((c) => c.sql === MODEL_SEED_UPSERT_SQL)).toHaveLength(0);
  });

  it.each([
    ["a slug held by a harness row", existingRow({ slug: "glm", kind: "harness" }), /held by a harness row/],
    ["a stored open_weight that disagrees", existingRow({ slug: "glm", open_weight: false }), /stored open_weight is false/],
    // #329: a hidden redirect alias must never receive seed facts.
    [
      "a redirect alias",
      existingRow({ slug: "glm", status: "redirect", redirect_to: "glm-family" }),
      /redirect alias \(data\.redirect_to: glm-family\)/,
    ],
  ])("refuses %s and writes nothing on apply", async (_name, row, reason) => {
    const { db, calls, transactions } = boundary([row]);
    const lines: string[] = [];
    expect(await loadModelSeeds(db, ALL, true, (l) => lines.push(l))).toBe(1);
    expect(lines.some((l) => l.startsWith("REFUSED: glm") && reason.test(l))).toBe(true);
    expect(transactions()).toBe(0);
    expect(calls.filter((c) => c.sql === MODEL_SEED_UPSERT_SQL)).toHaveLength(0);
  });

  it("the upsert's guard excludes redirect rows, so a row turned into an alias after planning matches nothing", () => {
    expect(MODEL_SEED_UPSERT_SQL).toMatch(/\nWHERE tools\.kind = 'model' AND tools\.status <> 'redirect'\n/);
  });

  it("rolls back and exits 1 when a guarded upsert matches no row", async () => {
    const { db } = boundary([], () => []);
    const lines: string[] = [];
    expect(await loadModelSeeds(db, ALL, true, (l) => lines.push(l))).toBe(1);
    expect(lines.at(-1)).toMatch(/^apply: rolled back, nothing written: /);
  });
});
