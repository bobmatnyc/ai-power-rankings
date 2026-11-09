import { getUrl } from "@/lib/get-url";
import { loggers } from "@/lib/logger";
import { RANKING_LISTS, type RankingList } from "@/lib/rankings/lists";

/**
 * Whether the models board page (`/[lang]/rankings/models`) and its links are shown (D6e).
 *
 * Why: owner ruling D6e hides the Model page and every link to it until model metrics land.
 *   The page must come back by itself once the board carries a metric row, with no code
 *   change or redeploy, so the gate reads live data rather than a flag.
 * What: `isModelPageVisible()` reads `metric_row_count` from `/api/rankings?list=model`, the
 *   count the API already exposes (#329), through the same Next data-cache entry the list
 *   page's own fetch uses (same URL, revalidated every 300 s, tagged `rankings`). It is
 *   true only for an integer count above 0. A non-OK response, a missing or malformed count,
 *   or a thrown read logs and answers false: fail closed. `isRankingListVisible()` and
 *   `visibleRankingLists()` apply it to the model list only; the other lists are always
 *   visible and cost no read.
 * Test: `tests/unit/model-page-visibility-d6e.test.tsx`.
 */

/** The model board's `/api/rankings` URL, as `fetchListBoard` in the list page builds it. */
function modelBoardUrl(): string {
  return `${getUrl()}/api/rankings?list=model`;
}

/** D6e: true only when the API reports one or more model metric rows; false on any error. */
export async function isModelPageVisible(): Promise<boolean> {
  const isDev = process.env["NODE_ENV"] === "development";
  try {
    const response = await fetch(modelBoardUrl(), {
      // "rankings" is CACHE_TAGS.RANKINGS; importing that module starts a cleanup timer.
      next: { revalidate: isDev ? 0 : 300, tags: ["rankings"] },
    });
    if (!response.ok) {
      loggers.ranking.error("D6e: model board read failed; model page hidden", { status: response.status });
      return false;
    }
    const body = (await response.json()) as { list_meta?: { metric_row_count?: unknown } } | null;
    const count = body?.list_meta?.metric_row_count;
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
