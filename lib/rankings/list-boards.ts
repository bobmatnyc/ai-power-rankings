/**
 * Reading every list's current board at once, for the readers that need all ranked tools (#185).
 *
 * Why: before v8 activation, article ingestion, the article service and the category
 *   counts read the one current combined board to learn every ranked tool and its rank.
 *   After activation the combined board is no public view (its rows are kept for
 *   rollback and export), so these readers read the per-list boards instead. A tool is
 *   ranked in at most one list, so the union of the boards ranks each tool once, and a
 *   tool's rank is its rank within its own list.
 * What: `currentListBoardsWhere()` is the `rankings` condition for the current row of
 *   every list in `RANKING_LISTS`, and never the combined row. `listBoardEntries()`
 *   flattens such rows into one entry array in `RANKING_LISTS` order, each entry tagged
 *   with its `list`; a row of any other list is ignored.
 * Test: `tests/unit/list-boards-185.test.ts`.
 */

import { and, eq, inArray, type SQL } from "drizzle-orm";
import { rankings } from "@/lib/db/schema";
import { RANKING_LISTS, type RankingList } from "@/lib/rankings/lists";
import { snapshotRows } from "@/lib/rankings/snapshot-rows";

/** The `rankings` condition for the current board of every list (never `combined`). */
export function currentListBoardsWhere(): SQL {
  return and(eq(rankings.isCurrent, true), inArray(rankings.list, [...RANKING_LISTS]))!;
}

/**
 * #185: the database answered but no list has a current board. Readers that record rank
 * changes or snapshots refuse instead of recording them against an empty rank set.
 */
export class NoCurrentListBoardsError extends Error {
  constructor(reader: string) {
    super(`${reader}: no current per-list ranking board; refusing to use empty ranks`);
    this.name = "NoCurrentListBoardsError";
  }
}

export type ListBoardEntry =Record<string, unknown> & { list: RankingList };

/**
 * One entry array from the current rows of the lists, in `RANKING_LISTS` order.
 *
 * Postcondition: every entry comes from a row whose `list` is in `RANKING_LISTS`,
 * keeps its stored fields (its `rank` is within its list), and carries that `list`.
 */
export function listBoardEntries(rows: ReadonlyArray<{ list?: string | null; data: unknown }>): ListBoardEntry[] {
  return RANKING_LISTS.flatMap((list) =>
    rows
      .filter((row) => row.list === list)
      .flatMap((row) => snapshotRows(row.data).map((entry) => ({ ...(entry as Record<string, unknown>), list })))
  );
}
