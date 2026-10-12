import { type ListLoadResult, loadList } from "@/lib/load-list";

/**
 * The news page's `/api/news` read, with failure kept apart from "no news".
 *
 * Why: `NewsContent` mapped a failed request to an empty list, so a 503 showed
 * the "no news items" card instead of an error (#152).
 * What: `loadList` over the `news` array — `{ ok: true, items }` for a 2xx
 * whose body carries a `news` array, which may be empty; `{ ok: false, reason }`
 * otherwise. Never throws.
 * Test: `tests/unit/news-content-load.test.ts`.
 */
export type NewsLoadResult<T> = ListLoadResult<T>;

/** The page the news page reads; the route's own ceiling. */
export const NEWS_PAGE_URL = "/api/news?limit=100";

export function loadNewsItems<T>(fetchImpl: typeof fetch = fetch): Promise<NewsLoadResult<T>> {
  // #152: a plain URL, so every visitor shares the edge's cached copy.
  return loadList<T>(NEWS_PAGE_URL, "news", undefined, fetchImpl);
}
