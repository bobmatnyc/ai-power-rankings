import { loggers } from "@/lib/logger";
import { loadListBoard } from "@/lib/rankings/list-board";
import { RANKING_LISTS, type RankingList } from "@/lib/rankings/lists";

/**
 * Whether the models board page (`/[lang]/rankings/models`) and its links are shown (D6e).
 *
 * Why: owner ruling D6e hides the Model page and every link to it until model metrics land.
 *   The page must come back by itself once the board carries a metric row, with no code
 *   change or redeploy, so the gate reads live data rather than a flag.
 * What: `isModelPageVisible()` reads `meta.metric_row_count` from `loadListBoard("model")`,
 *   the database read the ranking pages use (#368); nothing fetches over HTTP. It is true
 *   only for an integer count above 0. A thrown read, or a missing or malformed count, logs
 *   once and answers false: fail closed. `isRankingListVisible()` and `visibleRankingLists()`
 *   apply it to the model list only; the other lists are always visible and cost no read.
 *   Links and route differ on a thrown read (#369): links (list switcher, methodology) just
 *   drop the models entry, while the `/rankings/models` route reads the board itself before
 *   asking this gate, so a thrown read fails that render and ISR keeps the last good page.
 * Test: `tests/unit/model-page-visibility-d6e.test.tsx`.
 */

/** D6e: true only when the model board has one or more metric rows; false on any error. */
export async function isModelPageVisible(): Promise<boolean> {
  try {
    const { meta } = await loadListBoard("model");
    const count: unknown = meta?.metric_row_count;
    if (typeof count !== "number" || !Number.isInteger(count) || count < 0) {
      loggers.ranking.error("D6e: model board has no metric_row_count; model page hidden", { count });
      return false;
    }
    return count > 0;
  } catch (error) {
    loggers.ranking.error("D6e: model board read threw; model page hidden", {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/** D6e: whether `list`'s page is shown; only the model list is gated. */
export async function isRankingListVisible(list: RankingList): Promise<boolean> {
  return list === "model" ? isModelPageVisible() : true;
}

/** D6e: the lists whose page and links are shown, in `RANKING_LISTS` order. */
export async function visibleRankingLists(): Promise<RankingList[]> {
  const modelVisible = await isModelPageVisible();
  return RANKING_LISTS.filter((list) => list !== "model" || modelVisible);
}
