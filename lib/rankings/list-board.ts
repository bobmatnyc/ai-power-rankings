import { cache } from "react";
import { loggers } from "@/lib/logger";
import { loadCurrentRankings } from "@/lib/rankings/current-rankings";
import { type RankingList, type RankingListMeta, rankingListMeta } from "@/lib/rankings/lists";

/** One list's board as the ranking page renders it (#186, #305). */
export interface ListBoard {
  /** Display rows in the `/api/rankings` JSON form (dates as ISO strings). */
  rankings: Array<{ tool?: { name?: string }; name?: string; updated_at?: string }>;
  /** The list's `list_meta` (D53/D63 index rules). */
  meta: RankingListMeta;
  /** #305: the published ranking's `algorithm.version` and `published_at`. */
  header: { version: string | null; publishedAt: string | null };
}

/**
 * Reads one list's board for the ranking pages, straight from the database.
 *
 * Why: #368 — the page fetched its own `/api/rankings` over HTTP, a second
 *   function invocation per render, and that self-fetch kept the page dynamic.
 * What: Reads through `loadCurrentRankings()`, the function `/api/rankings`
 *   uses, and returns the fields the page read from that API's body: the rows
 *   (JSON round-tripped, so dates are ISO strings as before), `list_meta`, and
 *   the header (`algorithm_version` or `v1.0`; `published_at` else
 *   `created_at`). No current snapshot gives the API's empty board (0 entries,
 *   `v1.0`, no date). #368: a thrown read is logged and rethrown, so a failed
 *   ISR regeneration keeps the last good page. React `cache()` shares one read
 *   between `generateMetadata` and the page in a render.
 *   #195: `openWeightOnly` reads the open-weight board (`?open=1`); `meta` then
 *   counts that board's rows. The unfiltered call passes no option, as before.
 * Test: `tests/unit/ranking-list-pages-186.test.tsx`,
 *   `tests/unit/rankings-list-board-368.test.ts`, `tests/unit/rankings-open-weight-195.test.ts`.
 */
export const loadListBoard = cache(async (list: RankingList, openWeightOnly = false): Promise<ListBoard> => {
  let current: Awaited<ReturnType<typeof loadCurrentRankings>>;
  try {
    // #195: the unfiltered read keeps its one-argument call.
    current = openWeightOnly ? await loadCurrentRankings(list, { openWeightOnly }) : await loadCurrentRankings(list);
  } catch (error) {
    // #368: rethrown, so the ISR page keeps its last good render instead of caching an empty board.
    loggers.ranking.error("Failed to read rankings on server", { error, list });
    throw error;
  }
  if (!current) {
    return { rankings: [], meta: rankingListMeta(list, 0), header: { version: "v1.0", publishedAt: null } };
  }
  const { snapshot, rankings, metricRowCount } = current;
  return {
    rankings: JSON.parse(JSON.stringify(rankings)),
    meta: rankingListMeta(list, rankings.length, metricRowCount),
    header: {
      version: snapshot.algorithm_version || "v1.0",
      publishedAt: (snapshot.published_at ?? snapshot.created_at).toISOString(),
    },
  };
});
