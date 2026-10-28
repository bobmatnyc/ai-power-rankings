/**
 * #329: the per-major seed, status step and redirect re-point applied on real Postgres (PGlite).
 *
 * Why: the acceptance is the state after the apply: one active row per line and major, every
 *   superseded or unavailable point `deprecated`, nothing deleted, the Opus 4.x aliases on
 *   claude-opus-4 and no metric changed; and a failed guard must leave nothing written. Only an
 *   executor can show that.
 * What: builds `tools` as of migration 0016 with the live model rows, the two Opus 4.x redirect
 *   aliases, a harness and the inactive seed rows of the first seed apply, then runs
 *   `loadModelSeeds` with every shipped seed, the shipped lifecycle and `MODEL_REDIRECT_REPOINTS`.
 *   A second run is unchanged. Two rollback arms change a row between plan and apply and expect
 *   result 1 with every row as it was.
 * Test: `npx vitest run tests/unit/model-lifecycle-pglite-329.test.ts`. No server, no network.
 */

import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, it } from "vitest";
import { MODEL_STATUS_UPDATE_SQL } from "../../lib/db/repositories/model-lifecycle";
import { MODEL_REDIRECT_REPOINT_SQL, MODEL_REDIRECT_REPOINTS } from "../../lib/db/repositories/model-redirect-repoint";
import type { ModelSeedDb, ModelSeedQueryable } from "../../lib/db/repositories/model-seed-writer";
import { splitStatements } from "../../scripts/apply-migrations";
import { loadModelSeeds, readModelLifecycle, readModelSeeds } from "../../scripts/load-model-seeds";
import { MIGRATION_0016_SQL, TOOLS_AT_0015 } from "./fixtures/tool-links-183-fixture";

const readFile = (file: string) => readFileSync(file, "utf8");
const ENTRIES = readModelSeeds("all", readFile);
const LIFECYCLE = readModelLifecycle(readFile);
const CLAUDE_OPUS_DATA = { info: { company: "Anthropic" }, metrics: { users: 9 }, ruling: "D91" };

let pg: PGlite | null = null;

async function freshDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(TOOLS_AT_0015);
  for (const statement of splitStatements(MIGRATION_0016_SQL)) await db.exec(statement);
  const insert = (slug: string, kind: string, status: string, openWeight: boolean | null, data: unknown) =>
    db.query(
      `INSERT INTO public."tools" (slug, name, category, kind, status, open_weight, data) VALUES ($1, $1, 'other', $2, $3, $4, $5::jsonb)`,
      [slug, kind, status, openWeight, JSON.stringify(data)]
    );
  // Live rows (D91 families and the 0017 backfill).
  await insert("claude-opus", "model", "active", false, CLAUDE_OPUS_DATA);
  await insert("claude-sonnet", "model", "active", false, {});
  await insert("grok", "model", "active", false, {});
  await insert("devstral-small-2", "model", "active", true, {});
  await insert("glm", "model", "active", true, {});
  await insert("kimi", "model", "active", true, {});
  await insert("deepseek", "model", "active", true, {});
  for (const alias of ["opus-4-6", "opus-4-5"]) {
    await insert(alias, "model", "redirect", false, { redirect_to: "claude-opus", previous_status: "active" });
  }
  await insert("cursor", "harness", "active", null, {});
  // The first seed apply inserted the remaining closed and open-weight rows inactive.
  for (const slug of ["claude-haiku", "claude-fable", "gpt-astra", "gpt-luna", "gpt-sol", "gpt-terra", "gemini-argon", "gemini-flash"]) {
    await insert(slug, "model", "inactive", false, {});
  }
  for (const slug of ["qwen", "minimax"]) await insert(slug, "model", "inactive", true, {});
  return db;
}

type Hook = (sql: string, tx: ModelSeedQueryable) => Promise<void>;

/** A ModelSeedDb over PGlite; `beforeWrite` runs inside the transaction before each statement. */
function asSeedDb(db: PGlite, beforeWrite?: Hook): ModelSeedDb {
  const run = async (q: { query: PGlite["query"] }, text: string, params?: unknown[]) => ({ rows: (await q.query(text, params)).rows as unknown[] });
  return {
    query: (text, params) => run(db, text, params),
    transaction: (fn) =>
      db.transaction((tx) => {
        const q: ModelSeedQueryable = {
          query: async (text, params) => {
            if (beforeWrite) await beforeWrite(text, { query: (t, p) => run(tx, t, p) });
            return run(tx, text, params);
          },
        };
        return fn(q);
      }),
  };
}

async function snapshot(db: PGlite): Promise<string> {
  const { rows } = await db.query(`SELECT slug, status, data FROM public."tools" ORDER BY slug`);
  return JSON.stringify(rows);
}

async function statuses(db: PGlite): Promise<Map<string, string>> {
  const { rows } = await db.query<{ slug: string; status: string }>(`SELECT slug, status FROM public."tools"`);
  return new Map(rows.map((r) => [r.slug, r.status]));
}

async function redirectTo(db: PGlite, slug: string): Promise<string | null> {
  const { rows } = await db.query<{ t: string | null }>(`SELECT data->>'redirect_to' AS t FROM public."tools" WHERE slug = $1`, [slug]);
  return rows[0]?.t ?? null;
}

afterEach(async () => {
  await pg?.close();
  pg = null;
});

describe("per-major apply on PGlite (#329)", () => {
  it("ends with one active row per line and major, the rest deprecated, the aliases re-pointed, metrics untouched", async () => {
    pg = await freshDb();
    const log: string[] = [];
    expect(await loadModelSeeds(asSeedDb(pg), ENTRIES, true, (l) => log.push(l), LIFECYCLE, MODEL_REDIRECT_REPOINTS)).toBe(0);
    expect(log.at(-1)).toMatch(/^apply: committed, \d+ row\(s\) written, \d+ status\(es\) set, 2 redirect\(s\) re-pointed$/);

    const after = await statuses(pg);
    for (const row of LIFECYCLE.rows) expect(after.get(row.slug), row.slug).toBe(row.targetStatus);
    const activeModels = [...after].filter(([slug, s]) => s === "active" && slug !== "cursor").map(([slug]) => slug);
    const keys = activeModels.map((slug) => {
      const row = LIFECYCLE.rows.find((r) => r.slug === slug)!;
      return `${row.line}#${row.major}`;
    });
    expect(new Set(keys).size).toBe(keys.length);
    expect(after.get("opus-4-6")).toBe("redirect");
    expect(after.get("opus-4-5")).toBe("redirect");
    expect(await redirectTo(pg, "opus-4-6")).toBe("claude-opus-4");
    expect(await redirectTo(pg, "opus-4-5")).toBe("claude-opus-4");
    expect(after.get("cursor")).toBe("active");

    const { rows } = await pg.query<{ data: Record<string, unknown> }>(`SELECT data FROM public."tools" WHERE slug = 'claude-opus'`);
    const data = rows[0]!.data;
    expect(data["metrics"]).toEqual(CLAUDE_OPUS_DATA.metrics);
    expect(data["modelSeed"]).toBeUndefined();
    expect(data["modelLifecycle"]).toMatchObject({ major: 5, availability: { available: true, checked_at: LIFECYCLE.checkedAt } });
  });

  it("a second run changes nothing", async () => {
    pg = await freshDb();
    const db = asSeedDb(pg);
    expect(await loadModelSeeds(db, ENTRIES, true, () => {}, LIFECYCLE, MODEL_REDIRECT_REPOINTS)).toBe(0);
    const log: string[] = [];
    expect(await loadModelSeeds(db, ENTRIES, false, (l) => log.push(l), LIFECYCLE, MODEL_REDIRECT_REPOINTS)).toBe(0);
    expect(log).toContain(`totals: ${ENTRIES.length} row(s), 0 insert, 0 update, ${ENTRIES.length} unchanged, 0 refused`);
    expect(log).toContain(`status: ${LIFECYCLE.rows.length} row(s), 0 set active, 0 set deprecated, ${LIFECYCLE.rows.length} unchanged, 0 refused`);
    expect(log).toContain("redirects: 2 alias(es), 0 re-point, 2 unchanged, 0 refused");
  });

  // M1: a row that turns into a redirect between plan and apply makes the guarded status update
  // match nothing; the whole transaction, seed inserts included, rolls back.
  it.each<[string, string, string]>([
    ["a lifecycle row turned redirect", MODEL_STATUS_UPDATE_SQL, `UPDATE public."tools" SET status = 'redirect' WHERE slug = 'gpt-astra'`],
    ["an alias re-pointed elsewhere", MODEL_REDIRECT_REPOINT_SQL, `UPDATE public."tools" SET data = data || '{"redirect_to": "claude-sonnet"}'::jsonb WHERE slug = 'opus-4-5'`],
  ])("rolls everything back when %s between plan and apply", async (_name, trigger, change) => {
    pg = await freshDb();
    const before = await snapshot(pg);
    let fired = false;
    const db = asSeedDb(pg, async (sql, tx) => {
      if (sql === trigger && !fired) {
        fired = true;
        await tx.query(change);
      }
    });
    const log: string[] = [];
    expect(await loadModelSeeds(db, ENTRIES, true, (l) => log.push(l), LIFECYCLE, MODEL_REDIRECT_REPOINTS)).toBe(1);
    expect(fired).toBe(true);
    expect(log.at(-1)).toMatch(/^apply: rolled back, nothing written: /);
    expect(await snapshot(pg)).toBe(before);
    expect((await statuses(pg)).has("claude-opus-4")).toBe(false);
  });
});
