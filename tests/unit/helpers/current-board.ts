/**
 * A made-up `loadCurrentRankings()` result for the ranking page tests.
 *
 * Why: #368 — the ranking pages read the board from `loadCurrentRankings()`
 *   instead of fetching `/api/rankings`, so their tests stub that function.
 * What: `currentBoard(list, n, options)` returns a `CurrentListBoard`-shaped
 *   value with `n` rows ("Tool 0".."Tool n-1"), a snapshot carrying the given
 *   algorithm version and publish date, and the given metric-row count.
 */
export function currentBoard(
  list: string,
  n: number,
  options: { metricRowCount?: number; version?: string; publishedAt?: string } = {}
) {
  const published = new Date(options.publishedAt ?? "2026-10-01T00:00:00.000Z");
  return {
    list,
    source: "list" as const,
    snapshot: {
      id: "snap-1",
      period: "2026-10",
      algorithm_version: options.version ?? "7.6",
      is_current: true,
      published_at: published,
      created_at: published,
      data: [],
    },
    rankings: Array.from({ length: n }, (_, i) => ({ rank: i + 1, tool: { id: `t${i}`, name: `Tool ${i}` } })),
    metricRowCount: options.metricRowCount ?? 0,
  };
}
