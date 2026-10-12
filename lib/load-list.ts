/**
 * A JSON list read that keeps a failed request apart from an empty list.
 *
 * Why: the news page and both `/api/whats-new` consumers mapped a failed
 * request to an empty list, so a 503 showed "no items" instead of an error
 * (#152).
 * What: `{ ok: true, items }` for a 2xx whose body carries an array under
 * `key`, which may be empty. `{ ok: false, reason }` for a non-2xx status, a
 * body without that array, or a network or parse error. Never throws, and adds
 * no caching of its own: `init` is passed to `fetch` unchanged.
 * Test: `tests/unit/news-content-load.test.ts`,
 * `tests/unit/whats-new-feed-load.test.ts`.
 */
export type ListLoadResult<T> = { ok: true; items: T[] } | { ok: false; reason: string };

export async function loadList<T>(
  url: string,
  key: string,
  init?: RequestInit,
  fetchImpl: typeof fetch = fetch
): Promise<ListLoadResult<T>> {
  try {
    const response = init ? await fetchImpl(url, init) : await fetchImpl(url);
    if (!response.ok) {
      return { ok: false, reason: `HTTP ${response.status}` };
    }

    const data: unknown = await response.json();
    const items = (data as Record<string, unknown> | null)?.[key];
    if (!Array.isArray(items)) {
      return { ok: false, reason: `response has no ${key} array` };
    }

    return { ok: true, items: items as T[] };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}
