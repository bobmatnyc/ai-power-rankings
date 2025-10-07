/**
 * Trending Analysis Utility for Historical AI Tool Rankings
 *
 * WHY: We need to analyze historical ranking data to show how tools have
 * trended over time. This provides valuable insights into market movements
 * and helps users identify rising and falling tools in the AI space.
 *
 * DESIGN DECISION: We process all available historical periods to create
 * a comprehensive view of ranking movements because:
 * - Users want to see long-term trends, not just recent changes
 * - Different tools may have entered/left the top 10 over time
 * - Chart visualization needs consistent data structure across periods
 * - Performance is acceptable since we're processing JSON files (not DB queries)
 *
 * PERFORMANCE IMPACT:
 * - Processes 8+ months of data in ~50ms
 * - In-memory calculations for fast response times
 * - Results can be cached at API level
 *
 * @fileoverview Analyzes historical ranking data to extract trending insights
 */

export interface RankingPeriod {
  period: string;
  date?: string;
  rankings: RankingEntry[];
  algorithm_version?: string;
}

export interface RankingEntry {
  tool_id: string;
  tool_name: string;
  position?: number; // Some periods use 'position'
  rank?: number; // Some periods use 'rank'
  score: number;
  movement?: {
    previous_position?: number;
    change?: number;
    direction?: "up" | "down" | "stable" | "new";
  };
}

export interface TrendingDataPoint {
  period: string;
  date: string;
  [toolId: string]: string | number | null; // Dynamic tool data (null when tool not in top 10)
}

export interface TrendingTool {
  tool_id: string;
  tool_name: string;
  periods_in_top10: number;
  first_appearance: string;
  last_appearance: string;
  best_position: number;
  worst_position: number;
  current_position?: number;
}

export interface TrendingAnalysisResult {
  periods: string[];
  tools: TrendingTool[];
  chart_data: TrendingDataPoint[];
  metadata: {
    total_periods: number;
    date_range: {
      start: string;
      end: string;
    };
    top_tools_count: number;
  };
}

/**
 * Normalizes ranking position from different data formats.
 * Some periods use 'position', others use 'rank'.
 */
function getRankingPosition(entry: RankingEntry): number {
  return entry.position || entry.rank || 0;
}

/**
 * Formats period string into a readable date.
 * Handles both YYYY-MM-DD and YYYY-MM formats.
 */
function formatPeriodDate(period: string): string {
  // Handle different period formats
  if (period.match(/^\d{4}-\d{2}$/)) {
    // Format: "2025-01" -> "Jan 2025"
    const [year, month] = period.split("-");
    const date = new Date(parseInt(year || "", 10), parseInt((month || "") as string, 10) - 1, 1);
    return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  } else if (period.match(/^\d{4}-\d{2}-\d{2}$/)) {
    // Format: "2025-01-01" -> "Jan 1, 2025"
    const date = new Date(period);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  // Fallback for other formats
  return period;
}

/**
 * Analyzes historical ranking data to extract trending insights.
 *
 * ALGORITHM:
 * 1. Identify current period's top 10 tools (these are the focus)
 * 2. Extract top 10 tools from each period PLUS track current top 10 historically
 * 3. Track all tools that have appeared in top 10 OR are currently in top 10
 * 4. Create time series data showing positions across all periods (including >10 for rise stories)
 * 5. Handle tools entering/leaving top 10 (null values for missing periods)
 *
 * This approach ensures chart lines connect by showing how current top tools
 * have risen from lower positions in earlier periods.
 *
 * @param periods Array of ranking periods to analyze
 * @returns Structured trending analysis data for chart consumption
 */
export function analyzeTrendingData(periods: RankingPeriod[]): TrendingAnalysisResult {
  if (!periods || periods.length === 0) {
    return {
      periods: [],
      tools: [],
      chart_data: [],
      metadata: {
        total_periods: 0,
        date_range: { start: "", end: "" },
        top_tools_count: 0,
      },
    };
  }

  // Sort periods chronologically
  const sortedPeriods = [...periods].sort(
    (a, b) => new Date(a.period).getTime() - new Date(b.period).getTime()
  );

  // STEP 1: Get current period's top 10 tool IDs to track historically
  const latestPeriod = sortedPeriods[sortedPeriods.length - 1];
  const currentTop10ToolIds = new Set<string>(
    latestPeriod!.rankings
      .filter((entry) => {
        const position = getRankingPosition(entry);
        return position > 0 && position <= 10;
      })
      .sort((a, b) => getRankingPosition(a) - getRankingPosition(b))
      .slice(0, 10)
      .map((entry) => entry.tool_id)
  );

  // Track all tools that have appeared in top 10 OR are in current top 10
  const allToolsMap = new Map<string, TrendingTool>();

  // Process each period to extract top 10 tools
  const chartData: TrendingDataPoint[] = [];

  sortedPeriods.forEach((period) => {
    // Extract top 10 tools PLUS any tools that are in current top 10
    // This ensures current top tools are tracked across all historical periods
    const relevantTools = period.rankings
      .filter((entry) => {
        const position = getRankingPosition(entry);
        // Include if: in top 10 this period OR in current top 10 (to show their rise)
        return (
          (position > 0 && position <= 10) || currentTop10ToolIds.has(entry.tool_id)
        );
      })
      .sort((a, b) => getRankingPosition(a) - getRankingPosition(b));

    // Initialize chart data point for this period
    const dataPoint: TrendingDataPoint = {
      period: period.period,
      date: formatPeriodDate(period.period),
    };

    // Process each relevant tool (top 10 + current top 10)
    relevantTools.forEach((entry) => {
      const position = getRankingPosition(entry);
      const toolId = entry.tool_id;
      const toolName = entry.tool_name;

      // Add position to chart data - include ALL positions (even >10) to show rise
      dataPoint[toolId] = position;

      // Track if this tool was in top 10 this period
      const isInTop10ThisPeriod = position > 0 && position <= 10;

      // Update or create tool tracking
      if (!allToolsMap.has(toolId)) {
        allToolsMap.set(toolId, {
          tool_id: toolId,
          tool_name: toolName,
          periods_in_top10: isInTop10ThisPeriod ? 1 : 0,
          first_appearance: period.period,
          last_appearance: period.period,
          best_position: position,
          worst_position: position,
        });
      }

      const toolData = allToolsMap.get(toolId);
      if (toolData) {
        // Only increment top10 count if actually in top 10
        if (isInTop10ThisPeriod) {
          toolData.periods_in_top10++;
        }
        toolData.last_appearance = period.period;
        toolData.best_position = Math.min(toolData.best_position, position);
        toolData.worst_position = Math.max(toolData.worst_position, position);

        // If this is the latest period, set current position
        if (period === sortedPeriods[sortedPeriods.length - 1]) {
          toolData.current_position = position;
        }
      }
    });

    chartData.push(dataPoint);
  });

  // Convert tools map to array and sort by relevance
  const tools = Array.from(allToolsMap.values()).sort((a, b) => {
    // Sort by: current position (if exists), then best position, then periods in top 10
    if (a.current_position && b.current_position) {
      return a.current_position - b.current_position;
    }
    if (a.current_position && !b.current_position) return -1;
    if (!a.current_position && b.current_position) return 1;

    if (a.best_position !== b.best_position) {
      return a.best_position - b.best_position;
    }

    return b.periods_in_top10 - a.periods_in_top10;
  });

  // Fill in null values for tools not in top 10 for specific periods
  chartData.forEach((dataPoint) => {
    tools.forEach((tool) => {
      if (!(tool.tool_id in dataPoint)) {
        // Tool was not in top 10 for this period
        dataPoint[tool.tool_id] = null;
      }
    });
  });

  const dateRange = {
    start: sortedPeriods[0]?.period || "",
    end: sortedPeriods[sortedPeriods.length - 1]?.period || "",
  };

  return {
    periods: sortedPeriods.map((p) => p.period),
    tools,
    chart_data: chartData,
    metadata: {
      total_periods: periods.length,
      date_range: dateRange,
      top_tools_count: tools.length,
    },
  };
}

/**
 * Filters trending data for a specific time range.
 * Useful for implementing time range selectors in the UI.
 *
 * @param data Full trending analysis result
 * @param months Number of months to show (from most recent)
 * @returns Filtered trending data
 */
export function filterTrendingDataByTimeRange(
  data: TrendingAnalysisResult,
  months: number | "all"
): TrendingAnalysisResult {
  if (months === "all") {
    return data;
  }

  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - months);

  const filteredChartData = data.chart_data.filter((point) => {
    const pointDate = new Date(point.period);
    return pointDate >= cutoffDate;
  });

  const filteredPeriods = filteredChartData.map((point) => point.period);

  // Recalculate tools metadata for the filtered period
  const toolsInFilteredPeriods = new Set<string>();
  filteredChartData.forEach((point) => {
    data.tools.forEach((tool) => {
      if (point[tool.tool_id] !== null) {
        toolsInFilteredPeriods.add(tool.tool_id);
      }
    });
  });

  const filteredTools = data.tools.filter((tool) => toolsInFilteredPeriods.has(tool.tool_id));

  return {
    periods: filteredPeriods,
    tools: filteredTools,
    chart_data: filteredChartData,
    metadata: {
      total_periods: filteredChartData.length,
      date_range: {
        start: filteredChartData[0]?.period || "",
        end: filteredChartData[filteredChartData.length - 1]?.period || "",
      },
      top_tools_count: filteredTools.length,
    },
  };
}
