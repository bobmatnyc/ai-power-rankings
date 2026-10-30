/**
 * #334: the model seed refuses to overwrite a curated value unless the owner names it.
 *
 * Why: the seed upsert used to replace a stored non-null `hf_repo`, `licence`, `parameters_b`,
 *   `active_parameters_b` or `release_date` with the seed's value and report it as an update.
 * What: runs `loadModelSeeds` on the committed `minimax` seed row (it states all five curated
 *   columns) against a stand-in for the database boundary that records each statement. Checks a
 *   per-field refusal, a null fill, an equal value, the `--overwrite` opt-in with its diff mark and
 *   guard parameter, and the argument parsing. The SQL guard itself runs on PGlite in
 *   `tests/unit/model-seed-curated-pglite-334.test.ts`.
 * Test: `npx vitest run tests/unit/model-seed-curated-334.test.ts`. No database, no network.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CURATED_COLUMNS,
  MODEL_SEED_SELECT_SQL,
  MODEL_SEED_UPSERT_SQL,
  type ModelSeedDb,
  modelSeedProvenance,
  type SeedOverwrite,
} from "../../lib/db/repositories/model-seed-writer";
import { loadModelSeeds, parseArgs, readModelSeeds } from "../../scripts/load-model-seeds";

const ROOT = path.resolve(__dirname, "../..");
const ENTRY = readModelSeeds("open-weight", (file) => readFileSync(path.join(ROOT, file), "utf8")).find((e) => e.row.slug === "minimax")!;

// Spelled out so each case runs, and fails on its own, even where the writer lacks the export.
const COLUMNS = ["hf_repo", "licence", "parameters_b", "active_parameters_b", "release_date"] as const;

/** The stored row that already matches the seed in every column. */
const MATCHING: Record<string, unknown> = {
  slug: "minimax",
  kind: "model",
  status: "inactive",
  redirect_to: null,
  open_weight: true,
  hf_repo: "MiniMaxAI/MiniMax-M3.1-Flash",
  licence: "minimax-community",
  parameters_b: "428.0",
  active_parameters_b: "23",
  release_date: "2026-10-23",
  model_seed: modelSeedProvenance(ENTRY),
};

/** A stored value that differs from the seed, per curated column. */
const OTHER: Record<(typeof COLUMNS)[number], string> = {
  hf_repo: "MiniMaxAI/MiniMax-M3",
  licence: "other",
  parameters_b: "456",
  active_parameters_b: "45.9",
  release_date: "2026-06-01",
};

function boundary(existing: Record<string, unknown>) {
  const upserts: unknown[][] = [];
  const db: ModelSeedDb = {
    async query(sql) {
      return { rows: sql === MODEL_SEED_SELECT_SQL ? [existing] : [] };
    },
    async transaction(fn) {
      return fn({
        async query(sql, params = []) {
          if (sql === MODEL_SEED_UPSERT_SQL) upserts.push(params);
          return { rows: [{ slug: params[0] }] };
        },
      });
    },
  };
  return { db, upserts };
}

async function run(existing: Record<string, unknown>, apply: boolean, overwrites: SeedOverwrite[] = []) {
  const { db, upserts } = boundary(existing);
  const lines: string[] = [];
  const code = await loadModelSeeds(db, [ENTRY], apply, (l) => lines.push(l), null, [], overwrites);
  return { code, lines, upserts };
}

describe("#334 curated seed columns", () => {
  it("the writer's curated columns are the five the seed only fills", () => {
    expect(CURATED_COLUMNS).toEqual(COLUMNS);
  });

  it.each(COLUMNS.map((c) => [c]))("refuses a seed value that differs from a stored %s, naming the field", async (column) => {
    const { code, lines, upserts } = await run({ ...MATCHING, [column]: OTHER[column] }, true);
    expect(code).toBe(1);
    const refusal = lines.find((l) => l.startsWith("REFUSED: minimax"));
    expect(refusal).toContain(`stored ${column} is ${OTHER[column]}; the seed says `);
    expect(refusal).toContain(`--overwrite minimax:${column}`);
    expect(upserts).toHaveLength(0);
  });

  it.each(COLUMNS.map((c) => [c]))("fills a stored null %s", async (column) => {
    const { code, lines, upserts } = await run({ ...MATCHING, [column]: null }, true);
    expect(code).toBe(0);
    const changes = lines.filter((l) => l.startsWith("  "));
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatch(new RegExp(`^  ${column}: \\(null\\) -> \\S+$`));
    expect(upserts).toHaveLength(1);
    expect(upserts[0]![9]).toBe("{}");
  });

  it("treats equal curated values as no change, so only the provenance is refreshed", async () => {
    const { code, lines, upserts } = await run({ ...MATCHING, model_seed: { issue: 329 } }, true);
    expect(code).toBe(0);
    expect(lines.filter((l) => l.startsWith("  "))).toEqual(["  data.modelSeed: (set) -> (seed provenance)"]);
    // No curated value is replaced, so the guard is given no overwrite.
    expect(upserts[0]![9]).toBe("{}");
  });

  it("overwrites a named field, marks it in the diff with old and new, and passes the planned value to the guard", async () => {
    const { code, lines, upserts } = await run({ ...MATCHING, licence: "other" }, true, [{ slug: "minimax", column: "licence" }]);
    expect(code).toBe(0);
    expect(lines).toContain("will update: minimax (docs/refresh/open-weight-models-refresh.json)");
    expect(lines).toContain("  licence: other -> minimax-community (overwrite)");
    expect(upserts).toHaveLength(1);
    expect(JSON.parse(upserts[0]![9] as string)).toEqual({ licence: "other" });
  });

  it("an overwrite for one field does not unlock another", async () => {
    const stored = { ...MATCHING, licence: "other", hf_repo: OTHER.hf_repo };
    const { code, lines } = await run(stored, false, [{ slug: "minimax", column: "licence" }]);
    expect(code).toBe(1);
    const refusal = lines.find((l) => l.startsWith("REFUSED: minimax"))!;
    expect(refusal).toContain("stored hf_repo is");
    expect(refusal).not.toContain("stored licence is");
  });

  it("refuses an overwrite naming a slug outside the selected seed before any query", async () => {
    const { code, lines, upserts } = await run(MATCHING, false, [{ slug: "glm", column: "licence" }]);
    expect(code).toBe(1);
    expect(lines[0]).toBe("REFUSED overwrite: glm:licence: the slug is not in the selected seed");
    expect(upserts).toHaveLength(0);
  });
});

describe("#334 --overwrite argument", () => {
  it("takes slug:column pairs, comma-separated or repeated", () => {
    expect(parseArgs(["--overwrite", "glm:licence,deepseek-pro:hf_repo", "--overwrite", "kimi:release_date"])).toEqual({
      seed: "all",
      apply: false,
      overwrites: [
        { slug: "glm", column: "licence" },
        { slug: "deepseek-pro", column: "hf_repo" },
        { slug: "kimi", column: "release_date" },
      ],
    });
  });

  it.each([["glm:status"], ["glm:open_weight"], ["glm"], [""], ["glm:licence,"]])("refuses %j", (value) => {
    expect(parseArgs(["--overwrite", value])).toHaveProperty("errors");
  });

  it("refuses --overwrite with no value", () => {
    expect(parseArgs(["--overwrite"])).toHaveProperty("errors");
  });
});
