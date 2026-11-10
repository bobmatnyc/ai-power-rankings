/**
 * Joins one list's stored boards to the legacy combined boards before them (T76).
 *
 * Why: per-list boards start at the first v8 publish (2026-11). The earlier monthly
 *   history exists only as `list='combined'` rows, so a per-list-only history shows one
 *   period. The trending chart keeps that earlier history and marks where the method changed.
 * What: pure helpers, no database.
 *   - `COMBINED_FALLBACK_LISTS`: the lists whose history reaches back into the combined
 *     boards. Only the coding harnesses: the pre-v8 boards were mostly coding tools.
 *   - `mergeTrendingHistory()`: every per-list period, plus each combined period strictly
 *     earlier than the first per-list period. A list with no per-list period gets none.
 * Test: `tests/unit/rankings-current-trending-185.test.ts`
 */

import type { RankingList } from "@/lib/rankings/lists";

/** Where one period of a trending history comes from. */
export type PeriodSource = "combined" | "list";

/** T76: the lists whose history falls back to the combined boards before their first board. */
export const COMBINED_FALLBACK_LISTS: readonly RankingList[] = ["harness"];

/** True when `list` reads the combined boards for the periods before its first board. */
export function usesCombinedFallback(list: RankingList): boolean {
  return COMBINED_FALLBACK_LISTS.includes(list);
}

/** The `YYYY-MM` month of a period (`2025-06` or `2025-06-01`), the unit periods are compared in. */
function monthOf(period: string): string {
  return period.slice(0, 7);
}

export interface MergedHistory<T extends { period: string }> {
  /** The periods, each tagged with its source. Order is unchanged; the analyzer sorts. */
  periods: Array<T & { source: PeriodSource }>;
  /** The earliest per-list period: the method-change boundary. Null with no per-list period. */
  firstListPeriod: string | null;
}

/**
 * Merges one list's periods with the combined periods before its first one.
 *
 * Postcondition: every `listPeriods` entry is kept; a combined entry is kept only when
 * its month is earlier than `firstListPeriod`'s month, so no month comes from both sources.
 */
export function mergeTrendingHistory<T extends { period: string }>(
  listPeriods: readonly T[],
  combinedPeriods: readonly T[]
): MergedHistory<T> {
  const firstListPeriod = listPeriods.reduce<string | null>(
    (first, p) => (first === null || monthOf(p.period) < monthOf(first) ? p.period : first),
    null
  );
  if (firstListPeriod === null) return { periods: [], firstListPeriod };

  const boundary = monthOf(firstListPeriod);
  const earlier = combinedPeriods.filter((p) => monthOf(p.period) < boundary);
  return {
    periods: [
      ...listPeriods.map((p) => ({ ...p, source: "list" as const })),
      ...earlier.map((p) => ({ ...p, source: "combined" as const })),
    ],
    firstListPeriod,
  };
}
