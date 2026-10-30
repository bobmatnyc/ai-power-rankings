/**
 * #186: migration 0020 on real Postgres (PGlite).
 *
 * Why: the per-list key, the one-current-per-list rule and the D52 modality backfill are
 *   catalog and executor behaviour no in-memory double shows. The file is written for a
 *   later apply; this test is the only place it runs.
 * What: builds `rankings` as 0000 created it and a minimal `tools`, seeds legacy rows,
 *   applies 0020 twice, and checks: existing rows become 'combined' and keep their data;
 *   (period, list) is unique while the same period may hold one row per list; a second
 *   current row in one list is refused while each list may hold one; an unknown list is
 *   refused; the image and video models get their modality and nothing else changes;
 *   the precondition refuses two current rows before the column exists.
 * Test: `npx vitest run tests/unit/rankings-per-list-migration-186.test.ts`. No server.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// These tests run migrations and queries on PGlite, which can pass 5000 ms on a loaded machine.
vi.setConfig({ testTimeout: 60_000 });

const SQL_0020 = readFileSync(path.resolve(__dirname, "../../lib/db/migrations/0020_rankings_per_list.sql"), "utf8");

// `rankings` as 0000_oval_manta.sql created it; `tools` reduced to the columns 0020 reads.
const BASE = `
CREATE TABLE "rankings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "period" text NOT NULL,
  "algorithm_version" text DEFAULT 'v1.0' NOT NULL,
  "is_current" boolean DEFAULT false NOT NULL,
  "published_at" timestamp,
  "data" jsonb DEFAULT '[]' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "rankings_period_idx" ON "rankings" USING btree ("period");
CREATE INDEX "rankings_current_idx" ON "rankings" USING btree ("is_current");
CREATE TABLE "tools" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "kind" text DEFAULT 'harness' NOT NULL,
  "data" jsonb DEFAULT '{}' NOT NULL
);
`;

async function fresh(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(BASE);
  return db;
}

describe("#186 migration 0020 on PGlite", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await fresh();
    await db.exec(`
      INSERT INTO rankings (period, is_current, data) VALUES
        ('2026-08', false, '[{"tool_id":"a","rank":1}]'),
        ('2026-09', true, '[{"tool_id":"b","rank":1}]');
      INSERT INTO tools (slug, kind, data) VALUES
        ('nano-banana-pro', 'model', '{"info":{}}'),
        ('seedance-2-0', 'model', '{}'),
        ('bytedance-seedance-2-0', 'model', '{}'),
        ('opus-4-6', 'model', '{}'),
        ('cursor', 'harness', '{}'),
        ('preset', 'model', '{"modality":"text"}');
    `);
    await db.exec(SQL_0020);
    await db.exec(SQL_0020); // a re-run is a no-op
  });
  afterAll(async () => {
    await db.close();
  });

  it("marks every existing row 'combined' and keeps its data", async () => {
    const rows = (await db.query<{ period: string; list: string; is_current: boolean; data: unknown }>(
      "SELECT period, list, is_current, data FROM rankings ORDER BY period"
    )).rows;
    expect(rows).toEqual([
      { period: "2026-08", list: "combined", is_current: false, data: [{ tool_id: "a", rank: 1 }] },
      { period: "2026-09", list: "combined", is_current: true, data: [{ tool_id: "b", rank: 1 }] },
    ]);
  });

  it("replaces the period-only unique index with (period, list)", async () => {
    const names = (await db.query<{ indexname: string }>("SELECT indexname FROM pg_indexes WHERE tablename = 'rankings'")).rows.map(
      (r) => r.indexname
    );
    expect(names).toContain("rankings_period_list_idx");
    expect(names).toContain("rankings_one_current_per_list_idx");
    expect(names).not.toContain("rankings_period_idx");
  });

  it("holds one row per list for a period, and refuses a second row for the same (period, list)", async () => {
    await db.exec(`INSERT INTO rankings (period, list) VALUES ('2026-09', 'harness'), ('2026-09', 'model')`);
    await expect(db.exec(`INSERT INTO rankings (period, list) VALUES ('2026-09', 'model')`)).rejects.toThrow(
      /rankings_period_list_idx/
    );
  });

  it("allows one current row per list and refuses a second current row in a list", async () => {
    await db.exec(`UPDATE rankings SET is_current = true WHERE period = '2026-09' AND list IN ('harness', 'model')`);
    const current = (await db.query<{ list: string }>("SELECT list FROM rankings WHERE is_current ORDER BY list")).rows;
    expect(current.map((r) => r.list)).toEqual(["combined", "harness", "model"]);
    await expect(db.exec(`UPDATE rankings SET is_current = true WHERE period = '2026-08'`)).rejects.toThrow(
      /rankings_one_current_per_list_idx/
    );
  });

  it("refuses an unknown list", async () => {
    await expect(db.exec(`INSERT INTO rankings (period, list) VALUES ('2026-10', 'other')`)).rejects.toThrow(
      /rankings_list_check/
    );
  });

  it("D52: sets the modality of the image and video models only, keeping their other data", async () => {
    const rows = (await db.query<{ slug: string; data: Record<string, unknown> }>("SELECT slug, data FROM tools ORDER BY slug")).rows;
    expect(Object.fromEntries(rows.map((r) => [r.slug, r.data]))).toEqual({
      "bytedance-seedance-2-0": { modality: "video" },
      cursor: {},
      "nano-banana-pro": { info: {}, modality: "image" },
      "opus-4-6": {},
      preset: { modality: "text" },
      "seedance-2-0": { modality: "video" },
    });
  });

  it("refuses to run, writing nothing, when two rows are current before the column exists", async () => {
    const other = await fresh();
    await other.exec(`DROP INDEX rankings_period_idx;
      INSERT INTO rankings (period, is_current) VALUES ('2026-08', true), ('2026-09', true)`);
    await expect(other.exec(SQL_0020)).rejects.toThrow(/2 rankings rows are current/);
    const cols = (await other.query("SELECT 1 FROM information_schema.columns WHERE table_name = 'rankings' AND column_name = 'list'")).rows;
    expect(cols).toHaveLength(0);
    await other.close();
  });
});
