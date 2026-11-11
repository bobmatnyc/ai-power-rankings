/**
 * `raw` when it is an absolute http(s) URL, else null (#198, #421 review; shared by #442).
 *
 * Why: `source_url` and an article body's links are crawled data; a
 * `javascript:`, `data:` or relative value must not become a clickable link.
 * #442: one implementation for every public news view (the Article template,
 * the news card and the legacy detail view).
 * What: trims `raw`, parses it with no base, so a relative value fails, and
 * keeps the trimmed value only when the protocol is `http:` or `https:`.
 * Test: `tests/unit/article-template-198.test.tsx` ("source link" and
 * "referenced links" cases), `tests/unit/news-http-href-442.test.tsx`.
 */
export function httpSourceUrl(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}
