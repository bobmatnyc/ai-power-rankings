import { beforeEach, describe, expect, it, vi } from "vitest";
import { currentBoard } from "./helpers/current-board";

/**
 * #368: the ranking pages read their board from the database.
 *
 * Why: the pages fetched their own `/api/rankings`, a second function
 *   invocation per render that also kept them dynamic.
 * What: stubs `loadCurrentRankings()` and checks `loadListBoard()` returns what
 *   the page used to read from the API body: rows with ISO-string dates, the
 *   list's `list_meta`, and the header; the API's empty board when no snapshot
 *   is current; no rows and a null `meta` (noindex) when the read throws.
 * Test: `npx vitest run tests/unit/rankings-list-board-368.test.ts`.
 */

vi.mock("server-only", () => ({}));
const { loadCurrentRankings } = vi.hoisted(() => ({ loadCurrentRankings: vi.fn() }));
vi.mock("../../lib/rankings/current-rankings", () => ({ loadCurrentRankings }));

import { loadListBoard } from "../../lib/rankings/list-board";
import { rankingListMeta } from "../../lib/rankings/lists";

beforeEach(() => {
  loadCurrentRankings.mockReset();
});

describe("loadListBoard (#368)", () => {
  it("returns the API body's rows, list_meta and header from one database read", async () => {
    const board = currentBoard("model", 12, { metricRowCount: 10, version: "7.10", publishedAt: "2026-10-21T12:00:00.000Z" });
    const withDate = { ...board, rankings: board.rankings.map((r) => ({ ...r, updated_at: new Date("2026-10-20T00:00:00.000Z") })) };
    loadCurrentRankings.mockResolvedValueOnce(withDate);

    const out = await loadListBoard("model");

    expect(loadCurrentRankings).toHaveBeenCalledWith("model");
    expect(out.rankings).toHaveLength(12);
    expect(out.rankings[0]?.updated_at).toBe("2026-10-20T00:00:00.000Z");
    expect(out.meta).toEqual(rankingListMeta("model", 12, 10));
    expect(out.header).toEqual({ version: "7.10", publishedAt: "2026-10-21T12:00:00.000Z" });
  });

  it("falls back to created_at and v1.0 as the API does", async () => {
    const board = currentBoard("harness", 1);
    loadCurrentRankings.mockResolvedValueOnce({
      ...board,
      snapshot: { ...board.snapshot, algorithm_version: "", published_at: null, created_at: new Date("2026-09-01T00:00:00.000Z") },
    });
    expect((await loadListBoard("harness")).header).toEqual({ version: "v1.0", publishedAt: "2026-09-01T00:00:00.000Z" });
  });

  it("gives the API's empty board when no snapshot is current", async () => {
    loadCurrentRankings.mockResolvedValueOnce(null);
    expect(await loadListBoard("productivity")).toEqual({
      rankings: [],
      meta: rankingListMeta("productivity", 0),
      header: { version: "v1.0", publishedAt: null },
    });
  });

  it("gives no rows and a null meta when the read throws", async () => {
    loadCurrentRankings.mockRejectedValueOnce(new Error("connection refused"));
    expect(await loadListBoard("harness")).toEqual({
      rankings: [],
      meta: null,
      header: { version: null, publishedAt: null },
    });
  });
});
