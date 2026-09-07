import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression tests for #140 — the statements NewsRepository actually generates.
 *
 * Why: `/api/news` fetched `getPaginated(limit * 3, 0)` and then filtered and
 * sliced that pool in JavaScript, so `?limit=100&offset=300` returned an empty
 * `news` array and a `total` that was really the pool length. `/api/news/recent`
 * fetched the top 100 and applied `days` in memory, truncating any window with
 * more than 100 articles. Both are only fixed if the predicate, the ordering,
 * the bound and the offset are in the SQL, so this file asserts on the SQL.
 *
 * What: `getDb()` is replaced by a real Drizzle instance over the pg-proxy
 * driver, which needs no connection. Nothing here hand-writes a statement — the
 * repository's own query builders render through Drizzle and the fake driver
 * records what came out, so a change that stops emitting OFFSET, drops the
 * event_type predicate from the COUNT, or reverts to an in-memory filter shows
 * up as a failing assertion rather than passing on a mocked shape.
 *
 * Test: `npx vitest run lib/db/repositories/news.test.ts`. No database access,
 * no network.
 */

const { fixture } = vi.hoisted(() => {
  const state = {
    /** Every statement the fake driver was asked to run, in order. */
    statements: [] as string[],
    /** Bound parameters for each statement, index-aligned with `statements`. */
    params: [] as unknown[][],
    /** Result rows handed back, one entry per statement, in order. */
    responses: [] as unknown[][][],
  };

  function reset(): void {
    state.statements = [];
    state.params = [];
    state.responses = [];
  }

  return { fixture: { state, reset } };
});

// Relative path — tsconfig excludes *.test.ts from `include`, so the "@/..."
// alias never resolves inside this file itself (see
// lib/services/automated-ingestion.create-run.test.ts for the full note).
vi.mock("../connection", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");

  const builder = drizzle(async (statement: string, params: unknown[]) => {
    fixture.state.statements.push(statement);
    fixture.state.params.push(params);
    return { rows: fixture.state.responses.shift() ?? [] };
  });

  return { getDb: () => builder };
});

import { NEWS_EVENT_TYPES } from "../news-event-type";
import { NewsRepository } from "./news";

/** The count query answers with this many rows unless a test says otherwise. */
function countRows(total: number): unknown[][] {
  return [[String(total)]];
}

describe("NewsRepository.getPaginatedFiltered (#140)", () => {
  beforeEach(() => {
    fixture.reset();
  });

  it("puts the caller's limit and offset in the statement, not a tripled pool at offset 0", async () => {
    fixture.state.responses = [[], countRows(742)];

    await new NewsRepository().getPaginatedFiltered({ limit: 100, offset: 300 });

    const [page] = fixture.state.statements;
    expect(page).toBeDefined();
    expect(page.toLowerCase()).toContain("limit");
    expect(page.toLowerCase()).toContain("offset");
    // The old shape asked for limit * 3 rows starting at 0 and sliced afterwards.
    expect(fixture.state.params[0]).toContain(100);
    expect(fixture.state.params[0]).toContain(300);
    expect(fixture.state.params[0]).not.toContain(300 * 0);
  });

  it("reports total from COUNT(*) rather than the number of rows fetched", async () => {
    fixture.state.responses = [[], countRows(742)];

    const result = await new NewsRepository().getPaginatedFiltered({ limit: 100, offset: 300 });

    const countStatement = fixture.state.statements[1];
    expect(countStatement).toBeDefined();
    expect(countStatement.toLowerCase()).toContain("count(");
    // Zero rows came back on this page; total must still be the counted set.
    expect(result.total).toBe(742);
    expect(result.articles).toHaveLength(0);
  });

  it("orders by published_date with a tiebreak so a row cannot repeat across pages", async () => {
    fixture.state.responses = [[], countRows(0)];

    await new NewsRepository().getPaginatedFiltered({ limit: 20, offset: 0 });

    const [page] = fixture.state.statements;
    expect(page.toLowerCase()).toMatch(/order by\s+"?articles"?\."?published_date"?\s+desc/);
    expect(page.toLowerCase()).toContain('"id" desc');
  });

  it("filters event_type inside the query, in both the page and the count", async () => {
    fixture.state.responses = [[], countRows(12)];

    await new NewsRepository().getPaginatedFiltered({
      limit: 20,
      offset: 40,
      eventType: "milestone",
    });

    const [page, count] = fixture.state.statements;
    for (const statement of [page, count]) {
      expect(statement.toLowerCase()).toContain("array_to_string");
      expect(statement.toLowerCase()).toContain("like any");
      // The classification cascade itself, not a stored column.
      for (const eventType of NEWS_EVENT_TYPES) {
        expect(statement).toContain(`'${eventType}'`);
      }
    }
    // Page and count are filtered on the same value, so total describes the page's set.
    expect(fixture.state.params[0]).toContain("milestone");
    expect(fixture.state.params[1]).toContain("milestone");
    // A keyword from the ladder reaches the statement as a LIKE pattern.
    expect(fixture.state.params[0]).toContain("%funding%");
  });

  it("omits the event_type predicate entirely when no filter was asked for", async () => {
    fixture.state.responses = [[], countRows(3)];

    await new NewsRepository().getPaginatedFiltered({ limit: 20, offset: 0 });

    const count = fixture.state.statements[1];
    expect(count.toLowerCase()).toContain("count(");
    expect(count.toLowerCase()).not.toContain("like any");
    expect(count.toLowerCase()).toContain("status");
  });

  it("reports hasMore false past the end of the counted set", async () => {
    // Offset past `total`: the page is legitimately empty and nothing follows it.
    fixture.state.responses = [[], countRows(250)];

    const result = await new NewsRepository().getPaginatedFiltered({ limit: 100, offset: 300 });

    expect(result.total).toBe(250);
    expect(result.hasMore).toBe(false);
  });
});

describe("NewsRepository.countFiltered (#140)", () => {
  beforeEach(() => {
    fixture.reset();
  });

  it("issues a COUNT(*) over active articles", async () => {
    fixture.state.responses = [countRows(88)];

    const total = await new NewsRepository().countFiltered();

    expect(total).toBe(88);
    expect(fixture.state.statements).toHaveLength(1);
    expect(fixture.state.statements[0].toLowerCase()).toContain("count(");
    expect(fixture.state.statements[0].toLowerCase()).not.toContain("limit");
  });
});

describe("NewsRepository.getRecentWithin (#140)", () => {
  beforeEach(() => {
    fixture.reset();
  });

  it("bounds the window and the page in SQL, over published_date falling back to created_at", async () => {
    fixture.state.responses = [[]];

    await new NewsRepository().getRecentWithin({ days: 14, limit: 50 });

    expect(fixture.state.statements).toHaveLength(1);
    const [statement] = fixture.state.statements;
    const lower = statement.toLowerCase();

    // The days lower bound, expressed against the same coalesce the route used
    // to sort by in memory.
    expect(lower).toContain("coalesce");
    expect(lower).toContain("published_date");
    expect(lower).toContain("created_at");
    expect(lower).toContain("make_interval");
    expect(lower).toContain("now()");
    // Newest first, bounded — not "fetch 100 and filter".
    expect(lower).toContain("desc");
    expect(lower).toContain("limit");

    expect(fixture.state.params[0]).toContain(14);
    expect(fixture.state.params[0]).toContain(50);
    // The old implementation always asked for exactly 100 rows.
    expect(fixture.state.params[0]).not.toContain(100);
  });
});
