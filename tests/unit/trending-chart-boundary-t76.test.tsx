// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { methodBoundaryDate, TrendingChart } from "../../components/ranking/trending-chart";
import type { TrendingAnalysisResult } from "../../lib/trending-analyzer";

/**
 * T76: the trending chart marks the change from combined to per-list boards.
 *
 * Why: the harness history joins pre-v8 combined boards to v8 per-list boards. A reader
 *   must see where the method changed, and the subtitle must count the joined periods.
 * What: renders the real `TrendingChart` over a stub Recharts whose `ReferenceLine`
 *   prints its `x` and label, and checks the line, its label and the subtitle count.
 *   A history with no combined period draws no line.
 * Test: `npx vitest run tests/unit/trending-chart-boundary-t76.test.tsx`. No network.
 */

vi.mock("recharts", () => {
  const Pass = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const Empty = () => null;
  return {
    LineChart: Pass,
    ResponsiveContainer: Pass,
    Line: Empty,
    XAxis: Empty,
    YAxis: Empty,
    CartesianGrid: Empty,
    Tooltip: Empty,
    Legend: Empty,
    ReferenceLine: ({ x, label }: { x: string; label: { value: string } }) => (
      <div data-testid="method-boundary" data-x={x}>
        {label.value}
      </div>
    ),
  };
});

afterEach(cleanup);

function history(sources: Array<"combined" | "list">, firstListPeriod: string | null): TrendingAnalysisResult {
  const periods = sources.map((_, i) => `2026-${String(i + 1).padStart(2, "0")}`);
  return {
    periods,
    tools: [
      {
        tool_id: "h1",
        tool_name: "Tool h1",
        periods_in_top10: periods.length,
        first_appearance: periods[0] ?? "",
        last_appearance: periods[periods.length - 1] ?? "",
        best_position: 1,
        worst_position: 1,
      },
    ],
    chart_data: periods.map((period) => ({ period, date: `d-${period}`, h1: 1 })),
    period_sources: periods.map((period, i) => ({ period, source: sources[i] ?? "list" })),
    metadata: {
      total_periods: periods.length,
      date_range: { start: periods[0] ?? "", end: periods[periods.length - 1] ?? "" },
      top_tools_count: 1,
      first_list_period: firstListPeriod,
    },
  };
}

describe("TrendingChart method boundary (T76)", () => {
  it("draws a labelled line at the first per-list period and counts the merged periods", async () => {
    const data = history(["combined", "combined", "list"], "2026-03");
    render(<TrendingChart data={data} boundaryLabel="v8 per-list method" />);
    const line = await screen.findByTestId("method-boundary");
    expect(line.getAttribute("data-x")).toBe("d-2026-03");
    expect(line.textContent).toBe("v8 per-list method");
    expect(screen.getByText(/ranked over 3 periods/).textContent).toContain("(2026-01 to 2026-03)");
  });

  it("draws no line when no visible period is a combined one", async () => {
    render(<TrendingChart data={history(["list", "list"], "2026-01")} />);
    await screen.findByText(/ranked over 2 periods/);
    expect(screen.queryByTestId("method-boundary")).toBeNull();
    expect(methodBoundaryDate(history(["combined", "list"], null))).toBeNull();
  });
});
