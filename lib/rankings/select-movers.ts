/**
 * Picks the biggest rank movers for the home page strip (#192).
 *
 * Why: the strip took the first 3 risers in rank order from the top 30 ranks
 * only, so a large move lower down never showed and fallers never showed.
 * What: scans every row; drops rows with no previous rank or a zero or
 * non-numeric rankChange; splits risers (rankChange > 0) from fallers (< 0);
 * orders each by the size of the move, then better current rank, then name;
 * keeps `limit` of each. Pure, so the server and the client agree.
 * Test: `lib/rankings/select-movers.test.ts`, `tests/unit/home-movers-192.test.tsx`.
 */

export interface MoverRow {
  rank: number;
  previousRank?: number | null;
  rankChange?: number | null;
  tool: { name: string };
}

export interface Movers<T> {
  up: T[];
  down: T[];
}

function isMover(row: MoverRow): boolean {
  const { previousRank, rankChange } = row;
  return (
    typeof previousRank === "number" &&
    Number.isFinite(previousRank) &&
    typeof rankChange === "number" &&
    Number.isFinite(rankChange) &&
    rankChange !== 0
  );
}

/** Larger move first, then better (lower) current rank, then name in code-point order. */
function byMove(a: MoverRow, b: MoverRow): number {
  const size = Math.abs(b.rankChange as number) - Math.abs(a.rankChange as number);
  if (size !== 0) return size;
  if (a.rank !== b.rank) return a.rank - b.rank;
  return a.tool.name < b.tool.name ? -1 : a.tool.name > b.tool.name ? 1 : 0;
}

export function selectMovers<T extends MoverRow>(rows: readonly T[], { limit = 3 } = {}): Movers<T> {
  const moved = rows.filter(isMover).sort(byMove);
  return {
    up: moved.filter((r) => (r.rankChange as number) > 0).slice(0, limit),
    down: moved.filter((r) => (r.rankChange as number) < 0).slice(0, limit),
  };
}

/** A move as signed text: `+3` up, `-2` down. */
export function formatRankChange(rankChange: number): string {
  return rankChange > 0 ? `+${rankChange}` : String(rankChange);
}
