/**
 * #184: the open-weight model seed file and its loader, on PGlite.
 *
 * Why: the seed is the reviewed source for licence, size and price of the open-weight models.
 *   The loader must be all-or-nothing, must not overwrite a reviewed value, and must create
 *   rows that no public list shows (`inactive`).
 * What: validates the committed seed file (shape, 25-ish rows, unique slugs, https sources),
 *   then drives `loadOpenWeightModels` over a PGlite `tools` table at migration 0016.
 * Test: `npx vitest run tests/unit/open-weight-seed-184.test.ts`. No server, no network.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  applyOpenWeightRow,
  planOpenWeightRow,
  type OpenWeightSeed,
  type OpenWeightSeedDb,
  parseOpenWeightSeed,
  validateOpenWeightRow,
} from "../../lib/db/repositories/open-weight-seed.repository";
import { DEFAULT_SEED, loadOpenWeightModels, parseArgs } from "../../scripts/load-open-weight-models";
import { type FixtureTool, linkedDb } from "./fixtures/tool-links-183-fixture";

const ROOT = path.resolve(__dirname, "../..");
const REAL = parseOpenWeightSeed(readFileSync(path.join(ROOT, DEFAULT_SEED), "utf8"));

function seedOf(...models: Partial<OpenWeightSeed["models"][number]>[]): OpenWeightSeed {
  const base = REAL.models[0]!;
  return {
    checkedAt: "2026-10-26",
    sources: { hub: "x" },
    basis: { size: "y" },
    models: models.map((m, i) => ({ ...base, slug: `seed-model-${i}`, hfRepo: `acme/m${i}`, ...m })),
  };
}

describe("#184 committed seed file", () => {
  it("has about 25 models, unique slugs, and every row passes validation", () => {
    expect(REAL.models.length).toBeGreaterThanOrEqual(20);
    expect(REAL.models.length).toBeLessThanOrEqual(30);
    expect(new Set(REAL.models.map((m) => m.slug)).size).toBe(REAL.models.length);
    for (const row of REAL.models) expect(validateOpenWeightRow(row), row.slug).toBeNull();
  });

  it("records licence, size, a source and a licence URL for every row, and the terms of each source", () => {
    for (const row of REAL.models) {
      expect(row.licence, row.slug).not.toBe("");
      expect(row.parametersB, row.slug).toBeGreaterThan(0);
      expect(row.sourceUrl.startsWith("https://huggingface.co/"), row.slug).toBe(true);
      expect(row.licenceUrl.startsWith("https://"), row.slug).toBe(true);
    }
    const sources = REAL.sources as Record<string, { url: string; terms: string }>;
    for (const source of Object.values(sources)) {
      expect(source.url).toMatch(/^https:\/\//);
      expect(source.terms.length).toBeGreaterThan(10);
    }
  });

  it("carries no secret-shaped or host-shaped text", () => {
    const text = readFileSync(path.join(ROOT, DEFAULT_SEED), "utf8");
    expect(text).not.toMatch(/postgres(ql)?:\/\/|ghp_|sk-[A-Za-z0-9]{10}|neon\.tech|BEGIN [A-Z ]*KEY/);
  });
});

describe("#184 validateOpenWeightRow", () => {
  const ok = REAL.models[0]!;
  it.each([
    ["bad slug", { slug: "Bad Slug" }],
    ["bad repo", { hfRepo: "no-owner" }],
    ["http source", { sourceUrl: "http://example.test/a" }],
    ["zero size", { parametersB: 0 }],
    ["NaN size", { parametersB: Number.NaN }],
    ["active above total", { activeParametersB: ok.parametersB + 1 }],
    ["negative price", { priceInPerMtok: -1 }],
    ["bad date", { releaseDate: "2026/01/01" }],
    ["empty licence", { licence: "" }],
  ])("refuses %s", (_name, patch) => {
    expect(validateOpenWeightRow({ ...ok, ...patch })).not.toBeNull();
  });
});

describe("#184 load-open-weight-models", () => {
  let pg: PGlite;
  let db: OpenWeightSeedDb;
  const EXISTING: FixtureTool[] = [
    { slug: "seed-model-1", name: "Existing", kind: "model" },
    { slug: "a-harness", name: "Harness", kind: "harness" },
    { slug: "a-closed-model", name: "Closed", kind: "model" },
  ];
  beforeEach(async () => {
    ({ pg, db } = await linkedDb(EXISTING));
    await pg.query(`UPDATE public."tools" SET open_weight = false WHERE slug = 'a-closed-model'`);
  });
  afterEach(async () => {
    await pg.close();
  });

  const lines = () => {
    const out: string[] = [];
    return { out, log: (l: string) => out.push(l) };
  };
  const count = async () => (await pg.query<{ n: number }>(`SELECT count(*)::int AS n FROM public."tools"`)).rows[0]!.n;

  it("dry run plans every row and writes nothing", async () => {
    const { out, log } = lines();
    const code = await loadOpenWeightModels(db, seedOf({}, {}), false, log);
    expect(code).toBe(0);
    expect(out.join("\n")).toContain("would inserted: row 1 seed-model-0");
    expect(out.join("\n")).toContain("would updated: row 2 seed-model-1");
    expect(await count()).toBe(EXISTING.length);
  });

  it("--apply inserts new rows inactive and as open-weight models, with the sources in data", async () => {
    const { log } = lines();
    expect(await loadOpenWeightModels(db, seedOf({ licence: "mit", parametersB: 7 }), true, log)).toBe(0);
    const row = (await pg.query<Record<string, unknown>>(`SELECT * FROM public."tools" WHERE slug = 'seed-model-0'`)).rows[0]!;
    expect(row).toMatchObject({ kind: "model", status: "inactive", open_weight: true, licence: "mit", hf_repo: "acme/m0" });
    expect(Number(row["parameters_b"])).toBe(7);
    expect((row["data"] as { openWeightSeed: { issue: number; sources: unknown } }).openWeightSeed).toMatchObject({
      issue: 184,
      sources: { hub: "x" },
    });
  });

  it("fills NULL columns of an existing model row and never overwrites a set one", async () => {
    await pg.query(`UPDATE public."tools" SET licence = 'reviewed-licence' WHERE slug = 'seed-model-1'`);
    const { log } = lines();
    await loadOpenWeightModels(db, seedOf({}, { licence: "mit", parametersB: 9 }), true, log);
    const row = (await pg.query<Record<string, unknown>>(`SELECT * FROM public."tools" WHERE slug = 'seed-model-1'`)).rows[0]!;
    expect(row["licence"]).toBe("reviewed-licence");
    expect(Number(row["parameters_b"])).toBe(9);
    expect(row["open_weight"]).toBe(true);
    expect(row["status"]).toBe("active");
  });

  it("refuses a slug held by a non-model row or a closed model; --apply then writes nothing", async () => {
    const { out, log } = lines();
    const code = await loadOpenWeightModels(db, seedOf({}, { slug: "a-harness" }, { slug: "a-closed-model" }), true, log);
    expect(code).toBe(1);
    expect(out.join("\n")).toContain("held by a harness row");
    expect(out.join("\n")).toContain("open_weight = false");
    expect(await count()).toBe(EXISTING.length);
  });

  it("refuses the same slug twice in one seed", async () => {
    const { out, log } = lines();
    const code = await loadOpenWeightModels(db, seedOf({ slug: "dup-one" }, { slug: "dup-one" }), true, log);
    expect(code).toBe(1);
    expect(out.join("\n")).toContain("appears earlier");
    expect(await count()).toBe(EXISTING.length);
  });

  it("rolls everything back when a write fails mid-transaction", async () => {
    // The second row has a null name: validation passes, the NOT NULL constraint fails the insert.
    const bad = seedOf({}, { slug: "seed-model-9", name: "x" });
    (bad.models[1] as { name: string }).name = null as unknown as string;
    const { out, log } = lines();
    const code = await loadOpenWeightModels(db, bad, true, log);
    expect(code).toBe(1);
    expect(out.join("\n")).toMatch(/rolled back/);
    expect(await count()).toBe(EXISTING.length);
  });

  it("write time: a value set after planning is kept, and a row that stopped qualifying fails the write", async () => {
    const seed = seedOf({}, {});
    const plan = await planOpenWeightRow(db, seed.models[1]!);
    if (!plan.ok) throw new Error("plan should be ok");
    // Another writer sets the licence between plan and write.
    await pg.query(`UPDATE public."tools" SET licence = 'set-later' WHERE slug = 'seed-model-1'`);
    await applyOpenWeightRow(db, seed.models[1]!, plan, seed);
    const row = (await pg.query<Record<string, unknown>>(`SELECT licence, hf_repo FROM public."tools" WHERE slug = 'seed-model-1'`)).rows[0]!;
    expect(row["licence"]).toBe("set-later");
    expect(row["hf_repo"]).toBe("acme/m1");

    // The row is then marked closed; the same stale plan must throw and change nothing.
    await pg.query(`UPDATE public."tools" SET open_weight = false, hf_repo = NULL WHERE slug = 'seed-model-1'`);
    await expect(applyOpenWeightRow(db, seed.models[1]!, plan, seed)).rejects.toThrow(/changed since planning/);
    const after = (await pg.query<Record<string, unknown>>(`SELECT hf_repo FROM public."tools" WHERE slug = 'seed-model-1'`)).rows[0]!;
    expect(after["hf_repo"]).toBeNull();
  });

  it("parses arguments: dry run by default, exclusive flags, default seed path", () => {
    expect(parseArgs([])).toEqual({ file: DEFAULT_SEED, apply: false });
    expect(parseArgs(["--apply"])).toEqual({ file: DEFAULT_SEED, apply: true });
    expect(parseArgs(["--apply", "--dry-run"])).toHaveProperty("errors");
    expect(parseArgs(["--nope"])).toHaveProperty("errors");
  });
});
