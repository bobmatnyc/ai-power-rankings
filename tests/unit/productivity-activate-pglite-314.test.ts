/**
 * #314: migration 0033 (activate seven of the nine productivity rows, rulings Dd3 and D80) on the
 * real migration chain (PGlite).
 *
 * Why: 0033 is hand-applied inside the Dd3 window. Its claims are executor behaviour: the seven
 *   included rows 0027 left inactive become active, gemini-app and mistral-vibe stay inactive
 *   (D80), a row an admin changed or that 0027 did not create is left alone, no other row
 *   changes, a re-run is a no-op, and without 0027 it refuses.
 * What: chain 0000..0016 with the audit's tools, then 0017, 0027 and 0033 through
 *   `runMigrations --only`. Row snapshots compare whole rows before and after. Every test also
 *   asserts the rows it expects activated, so a no-op 0033 fails each one.
 * Test: `npx vitest run tests/unit/productivity-activate-pglite-314.test.ts`. No server, no network.
 */

import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runMigrations } from "../../scripts/apply-migrations";
import { chainDb, MIGRATION_FILES, readMigration } from "./fixtures/migration-chain-183";
import { pgliteMigrationDb } from "./fixtures/timestamptz-237-fixture";

// These tests run migrations and queries on PGlite, which can pass 5000 ms on a loaded machine.
vi.setConfig({ testTimeout: 60_000 });

const F17 = "0017_backfill_tool_kind.sql";
const F27 = "0027_create_productivity_rows.sql";
const F33 = "0033_activate_productivity_rows.sql";
// #314 D80: the seven rows 0033 activates; the two excluded rows stay inactive.
const SEVEN = ["chatgpt", "genspark", "grok-app", "hermes-agent", "manus", "microsoft-copilot", "notion-ai"];
const EXCLUDED = ["gemini-app", "mistral-vibe"];
const NINE = [...SEVEN, ...EXCLUDED].sort();

interface Ctx {
  db: PGlite;
  mdb: ReturnType<typeof pgliteMigrationDb>;
}

let ctx: Ctx;

async function apply(only: string, force = false) {
  return runMigrations(
    { db: ctx.mdb, files: { list: () => [...MIGRATION_FILES], read: readMigration }, log: () => {} },
    { dryRun: false, only, showColumns: null, force }
  );
}

/** Whole rows, keyed by slug, for the given slugs (or all rows). */
async function rows(slugs?: readonly string[]) {
  const r = await ctx.db.query<{ slug: string; row: Record<string, unknown> }>(
    `SELECT slug, to_jsonb(t) AS row FROM public."tools" t WHERE $1::text[] IS NULL OR slug = ANY($1) ORDER BY slug`,
    [slugs ?? null]
  );
  return r.rows;
}

/** A row without the two columns 0033 may write. */
function withoutActivation(row: Record<string, unknown>) {
  const { status: _s, updated_at: _u, ...rest } = row;
  return rest;
}

beforeEach(async () => {
  const db = await chainDb(F17);
  ctx = { db, mdb: pgliteMigrationDb(db) };
  expect((await apply(F17)).exitCode).toBe(0);
}, 120_000);
afterEach(async () => {
  await ctx.db.close();
});

/** Status by slug for the nine productivity rows. */
async function statuses(): Promise<Record<string, unknown>> {
  return Object.fromEntries((await rows(NINE)).map((r) => [r.slug, r.row["status"]]));
}

const EXPECTED_AFTER_0033 = Object.fromEntries(NINE.map((s) => [s, SEVEN.includes(s) ? "active" : "inactive"]));

describe("#314 migration 0033 activates seven of the nine productivity rows", () => {
  it("sets the seven included 0027 rows active, leaves the two excluded rows untouched, changes only status and updated_at", async () => {
    expect((await apply(F27)).exitCode).toBe(0);
    const before = await rows(NINE);
    expect(before.map((r) => r.row["status"])).toEqual(NINE.map(() => "inactive"));
    expect((await apply(F33)).exitCode).toBe(0);
    const after = await rows(NINE);
    expect(after.map((r) => r.slug)).toEqual(NINE);
    for (const [i, { slug, row }] of after.entries()) {
      if (EXCLUDED.includes(slug)) {
        // #314 D80: gemini-app and mistral-vibe are not activated and not touched at all.
        expect(row, slug).toEqual(before[i]!.row);
        continue;
      }
      expect(row["status"], slug).toBe("active");
      expect(withoutActivation(row), slug).toEqual(withoutActivation(before[i]!.row));
    }
  });

  it("leaves alone a row an admin changed and a same-slug row 0027 did not create", async () => {
    // #314: a manus row that predates 0027 (no marker); 0027's ON CONFLICT keeps it as it is.
    await ctx.db.query(
      `INSERT INTO public."tools" (slug, name, category, status, kind, data)
       VALUES ('manus', 'Manus', 'productivity', 'inactive', 'productivity', '{"name": "Manus"}'::jsonb)`
    );
    expect((await apply(F27)).exitCode).toBe(0);
    // #314: an admin already moved notion-ai off inactive.
    await ctx.db.query(`UPDATE public."tools" SET status = 'deprecated' WHERE slug = 'notion-ai'`);
    const kept = await rows(["manus", "notion-ai"]);
    expect((await apply(F33)).exitCode).toBe(0);
    expect(await rows(["manus", "notion-ai"])).toEqual(kept);
    const rest = SEVEN.filter((s) => s !== "manus" && s !== "notion-ai");
    expect((await rows(rest)).map((r) => r.row["status"])).toEqual(rest.map(() => "active"));
    expect((await rows(EXCLUDED)).map((r) => r.row["status"])).toEqual(["inactive", "inactive"]);
  });

  it("leaves every other tool untouched", async () => {
    expect((await apply(F27)).exitCode).toBe(0);
    const others = (await rows()).filter((r) => !NINE.includes(r.slug));
    expect(others.length).toBeGreaterThan(0);
    expect((await apply(F33)).exitCode).toBe(0);
    const all = await rows();
    expect(all.filter((r) => !NINE.includes(r.slug))).toEqual(others);
    expect(await statuses()).toEqual(EXPECTED_AFTER_0033);
  });

  it("is a no-op on a forced second run", async () => {
    expect((await apply(F27)).exitCode).toBe(0);
    expect((await apply(F33)).exitCode).toBe(0);
    const once = await rows();
    expect(await statuses()).toEqual(EXPECTED_AFTER_0033);
    expect((await apply(F33, true)).exitCode).toBe(0);
    expect(await rows()).toEqual(once);
  });

  it("refuses, writing nothing, when 0027 is not applied", async () => {
    const before = await rows();
    expect((await apply(F33)).exitCode).not.toBe(0);
    expect(await rows()).toEqual(before);
  });
});
