import { describe, expect, it, vi } from "vitest";

/**
 * Tied scores rank in slug order, whatever order the database returns rows in.
 *
 * Why: tools with no metrics all score the same floor, and `computeRankings()` sorts by
 *   score only, so ties kept the order `loadActiveTools()` read them in. That read had no
 *   ORDER BY, so the rank of a tied tool depended on database storage order.
 * What: seeds the in-memory Drizzle stand-in with identical-data tools in a scrambled
 *   order, reads them through the real `createDbPersistence().loadActiveTools()`, and
 *   ranks them with `computeRankings()`. Ties must come out in slug order, and a
 *   higher-scoring tool must still rank first. Postgres ORDER BY uses the database
 *   collation; the fake sorts by code point, so this proves the sort exists, not the
 *   collation order.
 * Test: `npx vitest run tests/unit/ranking-tie-order-slug.test.ts`. No network.
 */

const db = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("../../lib/db/connection", () => ({ getDb: () => db.client }));

import { createFakeRankingsDb } from "../../lib/services/__fixtures__/fake-rankings-db";
import { computeRankings, createDbPersistence } from "../../lib/services/ranking-generation.service";

const NOW = new Date("2026-06-01T00:00:00Z");
const STAMP = new Date("2026-01-01T00:00:00Z");

function row(slug: string, data: Record<string, unknown> = {}) {
  return { id: `id-${slug}`, name: slug, slug, category: "other", status: "active", data, kind: "model", createdAt: STAMP, updatedAt: STAMP };
}

async function rankedSlugs(rows: ReturnType<typeof row>[]): Promise<string[]> {
  db.client = createFakeRankingsDb({ tools: rows }).client;
  const loaded = await createDbPersistence().loadActiveTools();
  return computeRankings(loaded, new Map(), NOW).map((entry) => entry.tool_slug);
}

describe("tie order by slug", () => {
  it("loads active tools in slug order whatever the stored order", async () => {
    db.client = createFakeRankingsDb({ tools: [row("delta"), row("alpha"), row("charlie"), row("bravo")] }).client;
    const loaded = await createDbPersistence().loadActiveTools();
    expect(loaded.map((tool) => tool.slug)).toEqual(["alpha", "bravo", "charlie", "delta"]);
  });

  it("ranks tied scores in slug order for two different input orders", async () => {
    const forward = await rankedSlugs([row("alpha"), row("bravo"), row("charlie"), row("delta")]);
    const scrambled = await rankedSlugs([row("charlie"), row("delta"), row("alpha"), row("bravo")]);
    expect(forward).toEqual(["alpha", "bravo", "charlie", "delta"]);
    expect(scrambled).toEqual(forward);
  });

  it("still ranks a higher score first, ahead of an earlier slug", async () => {
    const metrics = { info: { website: "https://example.invalid" }, metrics: { users: 5_000_000, swe_bench: { verified: 90 } } };
    const slugs = await rankedSlugs([row("alpha"), row("bravo"), row("zulu", metrics)]);
    expect(slugs[0]).toBe("zulu");
    expect(slugs.slice(1)).toEqual(["alpha", "bravo"]);
  });
});
