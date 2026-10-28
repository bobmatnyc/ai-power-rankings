/**
 * #329: the per-major seed and status step applied on real Postgres (PGlite).
 *
 * Why: the acceptance is the state after the apply: one active row per line and major, every
 *   superseded or unavailable point `deprecated`, nothing deleted, no redirect row touched and
 *   no metric changed. Only an executor can show that.
 * What: builds `tools` as of migration 0016 with the live model rows, a redirect alias, a harness
 *   and the inactive seed rows of the first seed apply, then runs `loadModelSeeds` with every
 *   shipped seed and the shipped lifecycle (`--apply --set-status`). A second run is unchanged.
 * Test: `npx vitest run tests/unit/model-lifecycle-pglite-329.test.ts`. No server, no network.
 */

import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, it } from "vitest";
import type { ModelSeedDb } from "../../lib/db/repositories/model-seed-writer";
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
  await insert("opus-4-6", "model", "redirect", false, { redirect_to: "claude-opus", previous_status: "active" });
  await insert("cursor", "harness", "active", null, {});
  // The first seed apply inserted the remaining closed and open-weight rows inactive.
  for (const slug of ["claude-haiku", "claude-fable", "gpt-astra", "gpt-luna", "gpt-sol", "gpt-terra", "gemini-argon", "gemini-flash"]) {
    await insert(slug, "model", "inactive", false, {});
  }
  for (const slug of ["qwen", "minimax"]) await insert(slug, "model", "inactive", true, {});
  return db;
}

function asSeedDb(db: PGlite): ModelSeedDb {
  const query = async (text: string, params?: unknown[]) => ({ rows: (await db.query(text, params)).rows as unknown[] });
  return { query, transaction: (fn) => db.transaction((tx) => fn({ query: async (t, p) => ({ rows: (await tx.query(t, p)).rows as unknown[] }) })) };
}

async function statuses(db: PGlite): Promise<Map<string, string>> {
  const { rows } = await db.query<{ slug: string; status: string }>(`SELECT slug, status FROM public."tools"`);
  return new Map(rows.map((r) => [r.slug, r.status]));
}

afterEach(async () => {
  await pg?.close();
  pg = null;
});

describe("per-major apply on PGlite (#329)", () => {
  it("ends with one active row per line and major, the rest deprecated, redirects and metrics untouched", async () => {
    pg = await freshDb();
    const log: string[] = [];
    expect(await loadModelSeeds(asSeedDb(pg), ENTRIES, true, (l) => log.push(l), LIFECYCLE)).toBe(0);
    expect(log.at(-1)).toMatch(/^apply: committed, \d+ row\(s\) written, \d+ status\(es\) set$/);

    const after = await statuses(pg);
    for (const row of LIFECYCLE.rows) expect(after.get(row.slug), row.slug).toBe(row.targetStatus);
    const activeModels = [...after].filter(([slug, s]) => s === "active" && slug !== "cursor").map(([slug]) => slug);
    const keys = activeModels.map((slug) => {
      const row = LIFECYCLE.rows.find((r) => r.slug === slug)!;
      return `${row.line}#${row.major}`;
    });
    expect(new Set(keys).size).toBe(keys.length);
    expect(after.get("opus-4-6")).toBe("redirect");
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
    expect(await loadModelSeeds(db, ENTRIES, true, () => {}, LIFECYCLE)).toBe(0);
    const log: string[] = [];
    expect(await loadModelSeeds(db, ENTRIES, false, (l) => log.push(l), LIFECYCLE)).toBe(0);
    expect(log).toContain(`totals: ${ENTRIES.length} row(s), 0 insert, 0 update, ${ENTRIES.length} unchanged, 0 refused`);
    expect(log).toContain(`status: ${LIFECYCLE.rows.length} row(s), 0 set active, 0 set deprecated, ${LIFECYCLE.rows.length} unchanged, 0 refused`);
  });
});
