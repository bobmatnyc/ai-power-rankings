/**
 * The news page's `/api/news` read, with failure kept apart from "no news".
 *
 * Why: `NewsContent` mapped a failed request to an empty list, so a 503 showed
 * the "no news items" card instead of an error (#152).
 * What: `{ ok: true, items }` for a 2xx whose body carries a `news` array, which
 * may be empty. `{ ok: false, reason }` for a non-2xx status, a body without a
 * `news` array, or a network or parse error. Never throws.
 * Test: `tests/unit/news-content-load.test.ts`.
 */
export type NewsLoadResult<T> = { ok: true; items: T[] } | { ok: false; reason: string };

/** The page the news page reads; the route's own ceiling. */
export const NEWS_PAGE_URL = "/api/news?limit=100";

export async function loadNewsItems<T>(
  fetchImpl: typeof fetch = fetch
): Promise<NewsLoadResult<T>> {
  try {
    // #152: a plain URL, so every visitor shares the edge's cached copy.
    const response = await fetchImpl(NEWS_PAGE_URL);
    if (!response.ok) {
      return { ok: false, reason: `HTTP ${response.status}` };
    }

    const data: unknown = await response.json();
    const news = (data as { news?: unknown } | null)?.news;
    if (!Array.isArray(news)) {
      return { ok: false, reason: "response has no news array" };
    }

    return { ok: true, items: news as T[] };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}
