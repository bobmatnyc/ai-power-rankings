/**
 * #334: the seed upsert's curated-column guard on real Postgres (PGlite).
 *
 * Why: the planner refuses a curated overwrite, but a value can change between the plan and the
 *   write. Only the upsert's WHERE stops that write, and only an executor can show it does.
 * What: builds `tools` as of migration 0016 with one `minimax` model row, runs `loadModelSeeds`
 *   for the committed `minimax` seed row and checks the stored values afterwards. Two race arms
 *   change the row inside the write transaction just before the upsert and expect result 1 with
 *   the row as the race left it. One arm overwrites all five curated columns with `--overwrite`.
 * Test: `npx vitest run tests/unit/model-seed-curated-pglite-334.test.ts`. No server, no network.
 */

import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MODEL_SEED_UPSERT_SQL,
  type ModelSeedDb,
  type ModelSeedQueryable,
  type SeedOverwrite,
} from "../../lib/db/repositories/model-seed-writer";
import { splitStatements } from "../../scripts/apply-migrations";
import { loadModelSeeds, readModelSeeds } from "../../scripts/load-model-seeds";
import { MIGRATION_0016_SQL, TOOLS_AT_0015 } from "./fixtures/tool-links-183-fixture";

// These tests run migrations and queries on PGlite, which can pass 5000 ms on a loaded machine.
vi.setConfig({ testTimeout: 60_000 });

const ENTRY = readModelSeeds("open-weight", (file) => readFileSync(file, "utf8")).find((e) => e.row.slug === "minimax")!;

let pg: PGlite | null = null;

afterEach(async () => {
  await pg?.close();
  pg = null;
});

const COLUMNS = ["hf_repo", "licence", "parameters_b", "active_parameters_b", "release_date"] as const;
type Curated = Record<(typeof COLUMNS)[number], string | null>;

async function freshDb(stored: Curated): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(TOOLS_AT_0015);
  for (const statement of splitStatements(MIGRATION_0016_SQL)) await db.exec(statement);
  await db.query(
    `INSERT INTO public."tools" (slug, name, category, kind, status, open_weight, hf_repo, licence, parameters_b, active_parameters_b, release_date, data)
     VALUES ('minimax', 'MiniMax', 'other', 'model', 'inactive', true, $1, $2, $3::numeric, $4::numeric, $5::date, '{}'::jsonb)`,
    [stored.hf_repo, stored.licence, stored.parameters_b, stored.active_parameters_b, stored.release_date]
  );
  return db;
}

/** A ModelSeedDb over PGlite; `race` runs inside the transaction just before the seed upsert. */
function asSeedDb(db: PGlite, race?: string): ModelSeedDb {
  const run = async (q: { query: PGlite["query"] }, text: string, params?: unknown[]) => ({ rows: (await q.query(text, params)).rows as unknown[] });
  return {
    query: (text, params) => run(db, text, params),
    transaction: (fn) =>
      db.transaction((tx) => {
        const q: ModelSeedQueryable = {
          query: async (text, params) => {
            if (race && text === MODEL_SEED_UPSERT_SQL) await tx.query(race);
            return run(tx, text, params);
          },
        };
        return fn(q);
      }),
  };
}

async function stored(db: PGlite): Promise<Curated> {
  const { rows } = await db.query<Curated>(
    `SELECT hf_repo, licence, parameters_b::text AS parameters_b, active_parameters_b::text AS active_parameters_b,
       release_date::text AS release_date FROM public."tools" WHERE slug = 'minimax'`
  );
  return rows[0]!;
}

const SEEDED: Curated = {
  hf_repo: "MiniMaxAI/MiniMax-M3.1-Flash",
  licence: "minimax-community",
  parameters_b: "428",
  active_parameters_b: "23",
  release_date: "2026-10-23",
};

describe("#334 curated seed columns on PGlite", () => {
  it("fills a null and keeps an equal value", async () => {
    pg = await freshDb({ ...SEEDED, parameters_b: "428.0", release_date: null });
    expect(await loadModelSeeds(asSeedDb(pg), [ENTRY], true, () => {})).toBe(0);
    // The equal numeric value may come back at the seed's scale (428.0 -> 428); its value is unchanged.
    const after = await stored(pg);
    expect({ ...after, parameters_b: Number(after.parameters_b) }).toEqual({ ...SEEDED, parameters_b: 428 });
  });

  it("rolls back when a planned null fill finds a different value stored at write time", async () => {
    pg = await freshDb({ ...SEEDED, licence: null });
    const log: string[] = [];
    const race = `UPDATE public."tools" SET licence = 'other' WHERE slug = 'minimax'`;
    expect(await loadModelSeeds(asSeedDb(pg, race), [ENTRY], true, (l) => log.push(l))).toBe(1);
    expect(log).toContain("  licence: (null) -> minimax-community");
    expect(log.at(-1)).toMatch(/^apply: rolled back, nothing written: /);
    expect((await stored(pg)).licence).toBeNull();
  });

  it("rolls back an overwrite when the stored value changed after the plan", async () => {
    pg = await freshDb({ ...SEEDED, parameters_b: "456" });
    const log: string[] = [];
    const race = `UPDATE public."tools" SET parameters_b = 500 WHERE slug = 'minimax'`;
    const overwrites: SeedOverwrite[] = [{ slug: "minimax", column: "parameters_b" }];
    expect(await loadModelSeeds(asSeedDb(pg, race), [ENTRY], true, (l) => log.push(l), null, [], overwrites)).toBe(1);
    expect(log).toContain("  parameters_b: 456 -> 428 (overwrite)");
    expect(log.at(-1)).toMatch(/^apply: rolled back, nothing written: /);
    expect((await stored(pg)).parameters_b).toBe("456");
  });

  it("overwrites every named curated column and shows each in the plan", async () => {
    const old: Curated = {
      hf_repo: "MiniMaxAI/MiniMax-M3",
      licence: "other",
      parameters_b: "456",
      active_parameters_b: "45.9",
      release_date: "2026-06-01",
    };
    pg = await freshDb(old);
    const log: string[] = [];
    expect(await loadModelSeeds(asSeedDb(pg), [ENTRY], false, (l) => log.push(l))).toBe(1);
    expect(await stored(pg)).toEqual(old);
    const overwrites = COLUMNS.map((column) => ({ slug: "minimax", column }));
    log.length = 0;
    expect(await loadModelSeeds(asSeedDb(pg), [ENTRY], true, (l) => log.push(l), null, [], overwrites)).toBe(0);
    for (const c of COLUMNS) expect(log).toContain(`  ${c}: ${old[c]} -> ${SEEDED[c]} (overwrite)`);
    expect(await stored(pg)).toEqual(SEEDED);
  });
});
