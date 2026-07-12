/**
 * Unit coverage for the historical trending analyzer.
 *
 * Why: `analyzeTrendingData` powers the trend chart — it tracks the current
 * top-10 tools backwards through history (including their sub-top-10 rise),
 * computes best/worst positions and top-10 tenure, and null-fills periods where
 * a tool was absent. It was untested. These specs pin those behaviours plus the
 * `filterTrendingDataByTimeRange` passthrough/cutoff logic.
 *
 * Test: Pure — plain in-memory RankingPeriod fixtures, no DB, no I/O.
 */

import { describe, expect, it } from "vitest";
import {
  analyzeTrendingData,
  filterTrendingDataByTimeRange,
  type RankingPeriod,
} from "./trending-analyzer";

/** Two periods where tool C rises from #12 (outside top 10) into the top 10. */
const periods: RankingPeriod[] = [
  {
    period: "2025-05",
    rankings: [
      { tool_id: "A", tool_name: "Alpha", position: 1, score: 90 },
      { tool_id: "B", tool_name: "Bravo", position: 2, score: 88 },
      { tool_id: "C", tool_name: "Charlie", position: 12, score: 60 },
    ],
  },
  {
    period: "2025-06",
    rankings: [
      { tool_id: "B", tool_name: "Bravo", position: 1, score: 91 },
      { tool_id: "A", tool_name: "Alpha", position: 2, score: 89 },
      { tool_id: "C", tool_name: "Charlie", position: 3, score: 84 },
      { tool_id: "D", tool_name: "Delta", position: 5, score: 80 },
    ],
  },
];

describe("analyzeTrendingData", () => {
  it("returns an empty structure for no periods", () => {
    const result = analyzeTrendingData([]);
    expect(result.periods).toEqual([]);
    expect(result.tools).toEqual([]);
    expect(result.chart_data).toEqual([]);
    expect(result.metadata.total_periods).toBe(0);
  });

  it("orders periods chronologically and records the date range", () => {
    const result = analyzeTrendingData(periods);
    expect(result.periods).toEqual(["2025-05", "2025-06"]);
    expect(result.metadata.date_range).toEqual({ start: "2025-05", end: "2025-06" });
    expect(result.metadata.total_periods).toBe(2);
    expect(result.chart_data).toHaveLength(2);
  });

  it("sorts tools by current position (latest period leads)", () => {
    const result = analyzeTrendingData(periods);
    const order = result.tools.map((t) => t.tool_id);
    // Latest period: B(1), A(2), C(3), D(5).
    expect(order).toEqual(["B", "A", "C", "D"]);
    expect(result.tools.find((t) => t.tool_id === "B")!.current_position).toBe(1);
  });

  it("tracks a current top-10 tool back through its sub-top-10 history", () => {
    const result = analyzeTrendingData(periods);
    const charlie = result.tools.find((t) => t.tool_id === "C")!;
    // C was #12 in May (not top 10) and #3 in June (top 10).
    expect(charlie.best_position).toBe(3);
    expect(charlie.worst_position).toBe(12);
    expect(charlie.periods_in_top10).toBe(1); // only June counts
    expect(charlie.current_position).toBe(3);
    // The rise story keeps the >10 position visible in the chart series.
    expect(result.chart_data[0]!.C).toBe(12);
    expect(result.chart_data[1]!.C).toBe(3);
  });

  it("null-fills periods where a tracked tool was absent", () => {
    const result = analyzeTrendingData(periods);
    // Delta only appears in June, so its May chart value is null.
    expect(result.chart_data[0]!.D).toBeNull();
    expect(result.chart_data[1]!.D).toBe(5);
  });

  it("reads positions from the legacy 'rank' field when 'position' is absent", () => {
    const result = analyzeTrendingData([
      {
        period: "2025-07",
        rankings: [
          { tool_id: "X", tool_name: "Xray", rank: 1, score: 95 },
          { tool_id: "Y", tool_name: "Yankee", rank: 2, score: 90 },
        ],
      },
    ]);
    const xray = result.tools.find((t) => t.tool_id === "X")!;
    expect(xray.best_position).toBe(1);
    expect(xray.current_position).toBe(1);
    expect(result.chart_data[0]!.X).toBe(1);
  });
});

describe("filterTrendingDataByTimeRange", () => {
  it("returns the data unchanged for the 'all' range", () => {
    const full = analyzeTrendingData(periods);
    expect(filterTrendingDataByTimeRange(full, "all")).toBe(full);
  });

  it("drops periods older than the cutoff window", () => {
    const old = analyzeTrendingData([
      {
        period: "2000-01",
        rankings: [{ tool_id: "Z", tool_name: "Zulu", position: 1, score: 50 }],
      },
    ]);
    // A 1-month window relative to "now" excludes a year-2000 period entirely.
    const filtered = filterTrendingDataByTimeRange(old, 1);
    expect(filtered.periods).toEqual([]);
    expect(filtered.chart_data).toEqual([]);
    expect(filtered.metadata.top_tools_count).toBe(0);
  });
});
