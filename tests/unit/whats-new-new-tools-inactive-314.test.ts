/**
 * #314: the What's New "New Tools" aggregation counts only active tools.
 *
 * Why: migrations 0018 and 0022 insert inactive rows with created_at = now(). Before this fix the
 *   monthly aggregation selected every tool created in the window, so those rows reached the public
 *   summary prompt and changed the data hash that triggers a regeneration.
 * What: runs `getMonthlyData` and `calculateDataHash` on the real schema (PGlite) with one active
 *   and one inactive tool created inside the window.
 * Test: `npx vitest run tests/unit/whats-new-new-tools-inactive-314.test.ts`. No server, no network.
 */

import type { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const { holder } = vi.hoisted(() => ({ holder: { db: null as unknown } }));
vi.mock("../../lib/db/connection", () => ({ getDb: () => holder.db }));
vi.mock("@/lib/db/connection", () => ({ getDb: () => holder.db }));

import { WhatsNewAggregationService } from "../../lib/services/whats-new-aggregation.service";
import { splitStatements } from "../../scripts/apply-migrations";
import { chainDb, readMigration } from "./fixtures/migration-chain-183";

let db: PGlite;
beforeAll(async () => {
  db = await chainDb("0017_backfill_tool_kind.sql");
  // rankings.list comes from 0020.
  for (const statement of splitStatements(readMigration("0020_rankings_per_list.sql"))) await db.exec(statement);
  holder.db = drizzle(db);
}, 120_000);
afterAll(async () => {
  await db.close();
});

async function newTools() {
  const svc = new WhatsNewAggregationService();
  const now = new Date();
  return svc.getMonthlyData(now.getUTCMonth() + 1, now.getUTCFullYear());
}

describe("#314 New Tools aggregation", () => {
  it("leaves out an inactive tool created inside the window and keeps the data hash", async () => {
    await db.query(`DELETE FROM public."tools"`);
    await db.query(
      `INSERT INTO public."tools" (slug, name, category, status, created_at) VALUES ('live-new', 'Live New', 'other', 'active', now())`
    );
    const svc = new WhatsNewAggregationService();
    const before = await newTools();
    const hashBefore = svc.calculateDataHash(before);
    expect(before.newTools.map((t) => t.name)).toEqual(["Live New"]);

    await db.query(
      `INSERT INTO public."tools" (slug, name, category, status, kind, created_at) VALUES ('seeded-inactive', 'Seeded Inactive', 'productivity', 'inactive', 'productivity', now())`
    );
    const after = await newTools();
    expect(after.newTools.map((t) => t.name)).toEqual(["Live New"]);
    expect(after.metadata.totalNewTools).toBe(1);
    expect(svc.calculateDataHash(after)).toBe(hashBefore);
  });
});
