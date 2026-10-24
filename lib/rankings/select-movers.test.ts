import { describe, expect, it } from "vitest";
import { selectMovers } from "./select-movers";

/**
 * #192 slice 1: which tools the home page lists as rank movers.
 *
 * Why: the home strip took the first 3 risers in rank order from the top 30
 * only, and never listed a faller.
 * What: covers the size order across every rank (AC1), the separate signed
 * down list (AC2), and the exclusions and tie-break (AC4).
 * Test: `npx vitest run lib/rankings/select-movers.test.ts`.
 */

interface Row {
  rank: number;
  previousRank?: number | null;
  rankChange?: number | null;
  tool: { name: string };
}

/** A row whose previous rank is consistent with its change. */
const moved = (rank: number, name: string, rankChange: number): Row => ({
  rank,
  previousRank: rank + rankChange,
  rankChange,
  tool: { name },
});

const steady = (rank: number): Row => ({ rank, previousRank: rank, rankChange: 0, tool: { name: `Tool ${rank}` } });

/** 40 ranks; the biggest riser sits at rank 35, past the old 30-rank cap. */
function fortyRows(): Row[] {
  const rows = Array.from({ length: 40 }, (_, i) => steady(i + 1));
  rows[4] = moved(5, "Small Riser", 2);
  rows[9] = moved(10, "Mid Riser", 5);
  rows[19] = moved(20, "Tiny Riser", 1);
  rows[34] = moved(35, "Deep Riser", 20);
  rows[7] = moved(8, "Faller", -4);
  return rows;
}

const names = (rows: Row[]) => rows.map((r) => r.tool.name);

describe("selectMovers (#192)", () => {
  it("AC1: up holds the 3 largest positive changes across all ranks, largest first", () => {
    expect(names(selectMovers(fortyRows()).up)).toEqual(["Deep Riser", "Mid Riser", "Small Riser"]);
  });

  it("AC2: fallers go to a separate down list, largest drop first, sign kept", () => {
    const rows = fortyRows();
    rows[29] = moved(30, "Big Faller", -9);
    rows[30] = moved(31, "Small Faller", -1);
    rows[31] = moved(32, "Mid Faller", -6);
    rows[32] = moved(33, "Least Faller", -1);
    const { up, down } = selectMovers(rows);
    expect(names(down)).toEqual(["Big Faller", "Mid Faller", "Faller"]);
    expect(down.map((r) => r.rankChange)).toEqual([-9, -6, -4]);
    expect(up.every((r) => (r.rankChange ?? 0) > 0)).toBe(true);
  });

  it("AC4: a change with no previous rank, a zero and a non-number are excluded", () => {
    const rows: Row[] = [
      { rank: 1, previousRank: null, rankChange: 30, tool: { name: "New Null" } },
      { rank: 2, rankChange: 25, tool: { name: "New Absent" } },
      { rank: 3, previousRank: 3, rankChange: 0, tool: { name: "Zero" } },
      { rank: 4, previousRank: 9, rankChange: Number.NaN, tool: { name: "NaN" } },
      { rank: 5, previousRank: 5, tool: { name: "Undefined" } },
      moved(6, "Real", 2),
    ];
    expect(selectMovers(rows)).toEqual({ up: [rows[5]], down: [] });
  });

  it("AC4: equal changes break by better current rank, then by name", () => {
    const rows: Row[] = [
      moved(15, "Later Rank", 3),
      moved(10, "Zed", 3),
      moved(10, "Alpha", 3),
      moved(12, "Down B", -3),
      moved(11, "Down A", -3),
    ];
    const once = selectMovers(rows);
    expect(names(once.up)).toEqual(["Alpha", "Zed", "Later Rank"]);
    expect(names(once.down)).toEqual(["Down A", "Down B"]);
    expect(selectMovers([...rows].reverse())).toEqual(once);
  });

  it("respects the limit and returns empty lists when nothing moved", () => {
    expect(names(selectMovers(fortyRows(), { limit: 1 }).up)).toEqual(["Deep Riser"]);
    expect(selectMovers(Array.from({ length: 5 }, (_, i) => steady(i + 1)))).toEqual({ up: [], down: [] });
  });
});
