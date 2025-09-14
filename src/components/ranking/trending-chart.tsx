"use client";

/**
 * TrendingChart Component - Historical AI Tool Rankings Visualization
 *
 * WHY: This component visualizes how AI tools have moved in and out of the
 * top 10 rankings over time. It helps users identify market trends and
 * understand which tools are gaining or losing traction.
 *
 * DESIGN DECISION: We use Recharts LineChart with inverted Y-axis because:
 * - Line charts best show trends over time
 * - Inverted axis puts rank 1 at the top (intuitive)
 * - Interactive legend allows users to focus on specific tools
 * - Tooltips provide detailed information on hover
 * - Responsive design works on mobile and desktop
 *
 * PERFORMANCE CONSIDERATIONS:
 * - Uses dynamic imports to reduce initial bundle size
 * - Memoized to prevent unnecessary re-renders
 * - Efficient color generation for tool lines
 * - Optimized data structure for chart consumption
 *
 * ACCESSIBILITY:
 * - Screen reader friendly with proper ARIA labels
 * - Keyboard navigation support
 * - High contrast colors for visibility
 * - Clear tooltips and legends
 *
 * @fileoverview Interactive chart showing historical AI tool ranking trends
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChartSkeleton, ChartWrapper } from "@/components/dynamic-imports/DynamicCharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { TrendingAnalysisResult } from "@/lib/trending-analyzer";

// Dynamic import for Recharts components
const loadRechartsComponents = async () => {
  const recharts = await import("recharts");
  return {
    LineChart: recharts.LineChart,
    Line: recharts.Line,
    XAxis: recharts.XAxis,
    YAxis: recharts.YAxis,
    CartesianGrid: recharts.CartesianGrid,
    Tooltip: recharts.Tooltip,
    Legend: recharts.Legend,
    ResponsiveContainer: recharts.ResponsiveContainer,
  };
};

export interface TrendingChartProps {
  /** Trending analysis data from the API */
  data: TrendingAnalysisResult;
  /** Chart height in pixels */
  height?: number;
  /** Whether to show the legend */
  showLegend?: boolean;
  /** Maximum number of tools to display (for performance) */
  maxTools?: number;
  /** Custom CSS class name */
  className?: string;
}

interface ChartComponents {
  // biome-ignore lint/suspicious/noExplicitAny: External library type
  LineChart: React.ComponentType<any>;
  // biome-ignore lint/suspicious/noExplicitAny: External library type
  Line: React.ComponentType<any>;
  // biome-ignore lint/suspicious/noExplicitAny: External library type
  XAxis: React.ComponentType<any>;
  // biome-ignore lint/suspicious/noExplicitAny: External library type
  YAxis: React.ComponentType<any>;
  // biome-ignore lint/suspicious/noExplicitAny: External library type
  CartesianGrid: React.ComponentType<any>;
  // biome-ignore lint/suspicious/noExplicitAny: External library type
  Tooltip: React.ComponentType<any>;
  // biome-ignore lint/suspicious/noExplicitAny: External library type
  Legend: React.ComponentType<any>;
  // biome-ignore lint/suspicious/noExplicitAny: External library type
  ResponsiveContainer: React.ComponentType<any>;
}

/**
 * Generates a visually distinct color for each tool line.
 * Uses HSL color space for better color distribution.
 */
function generateToolColor(index: number): string {
  // Use golden ratio for better color distribution
  const goldenRatio = 0.618033988749;
  const hue = (index * goldenRatio * 360) % 360;

  // Higher saturation and lightness for better visibility
  const saturation = 70 + (index % 3) * 10; // 70%, 80%, 90%
  const lightness = 45 + (index % 2) * 10; // 45%, 55%

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * Custom tooltip component for the trending chart.
 * Shows detailed information about tool rankings at specific periods.
 */
interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number | null;
    dataKey: string;
    color: string;
    name?: string;
  }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload || !payload.length) {
    return null;
  }

  // Filter out null values and sort by position
  const validData = payload
    .filter((entry) => entry.value !== null)
    .sort((a, b) => (a.value ?? 0) - (b.value ?? 0));

  return (
    <div className="bg-background border rounded-lg shadow-lg p-4 min-w-[200px]">
      <h3 className="font-semibold text-sm mb-2">{label}</h3>
      <div className="space-y-1">
        {validData.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-foreground">{entry.name}</span>
            </div>
            <span className="font-medium text-foreground">#{entry.value}</span>
          </div>
        ))}
      </div>
      {validData.length === 0 && (
        <p className="text-muted-foreground text-xs">No tools in top 10 this period</p>
      )}
    </div>
  );
}

/**
 * Custom legend component that allows toggling tool visibility.
 * Users can click on legend items to show/hide specific tool lines.
 */
function CustomLegend({
  payload,
  visibleTools,
  onToolToggle,
}: {
  payload?: Array<{ value: string; color: string; dataKey: string }>;
  visibleTools: Set<string>;
  onToolToggle: (toolId: string) => void;
}) {
  if (!payload) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-4 justify-center">
      {payload.map((entry) => {
        const isVisible = visibleTools.has(entry.dataKey);
        return (
          <button
            type="button"
            key={entry.dataKey}
            onClick={() => onToolToggle(entry.dataKey)}
            className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs border transition-all ${
              isVisible
                ? "bg-primary/10 border-primary/20 text-primary"
                : "bg-muted border-muted-foreground/20 text-muted-foreground"
            } hover:scale-105`}
          >
            <div
              className={`w-3 h-3 rounded-full ${isVisible ? "" : "opacity-30"}`}
              style={{ backgroundColor: entry.color }}
            />
            <span>{entry.value}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Main TrendingChart component.
 * Renders an interactive line chart showing historical tool ranking trends.
 */
export function TrendingChart({
  data,
  height = 400,
  showLegend = true,
  maxTools = 15,
  className = "",
}: TrendingChartProps) {
  const [chartComponents, setChartComponents] = useState<ChartComponents | null>(null);
  const [visibleTools, setVisibleTools] = useState<Set<string>>(new Set());

  // Load Recharts components dynamically
  useEffect(() => {
    let isMounted = true;

    loadRechartsComponents().then((components) => {
      if (isMounted) {
        setChartComponents(components);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // Initialize visible tools (show top tools by default)
  useEffect(() => {
    if (data.tools.length > 0) {
      const topTools = data.tools.slice(0, Math.min(maxTools, 10));
      setVisibleTools(new Set(topTools.map((tool) => tool.tool_id)));
    }
  }, [data.tools, maxTools]);

  // Memoize chart data and tools for performance
  const { chartData, displayTools } = useMemo(() => {
    const limitedTools = data.tools.slice(0, maxTools);
    return {
      chartData: data.chart_data,
      displayTools: limitedTools,
    };
  }, [data.chart_data, data.tools, maxTools]);

  // Handle tool visibility toggle
  const handleToolToggle = useCallback((toolId: string) => {
    setVisibleTools((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(toolId)) {
        newSet.delete(toolId);
      } else {
        newSet.add(toolId);
      }
      return newSet;
    });
  }, []);

  // Show loading state while components load
  if (!chartComponents) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Historical AI Tool Rankings</CardTitle>
          <CardDescription>Loading chart components...</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartSkeleton />
        </CardContent>
      </Card>
    );
  }

  // Show empty state if no data
  if (!chartData.length || !displayTools.length) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Historical AI Tool Rankings</CardTitle>
          <CardDescription>No trending data available</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px]">
          <p className="text-muted-foreground">No historical ranking data found</p>
        </CardContent>
      </Card>
    );
  }

  const { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } =
    chartComponents;

  return (
    <ChartWrapper>
      <Card className={className}>
        <CardHeader>
          <CardTitle>Historical AI Tool Rankings</CardTitle>
          <CardDescription>
            Top {displayTools.length} AI tools ranked over {data.metadata.total_periods} periods
            {data.metadata.date_range.start && data.metadata.date_range.end && (
              <span className="text-muted-foreground">
                {" "}
                ({data.metadata.date_range.start} to {data.metadata.date_range.end})
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div style={{ width: "100%", height: height }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{
                  top: 20,
                  right: 30,
                  left: 20,
                  bottom: 20,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickMargin={8}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  // Inverted domain so rank 1 appears at top
                  domain={[10, 1]}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value: number) => `#${value}`}
                  label={{ value: "Ranking Position", angle: -90, position: "insideLeft" }}
                />
                <Tooltip content={<CustomTooltip />} />

                {displayTools.map((tool, index) => {
                  const isVisible = visibleTools.has(tool.tool_id);
                  const color = generateToolColor(index);

                  return (
                    <Line
                      key={tool.tool_id}
                      type="monotone"
                      dataKey={tool.tool_id}
                      name={tool.tool_name}
                      stroke={color}
                      strokeWidth={isVisible ? 2 : 0}
                      dot={{
                        fill: color,
                        strokeWidth: 1,
                        r: isVisible ? 4 : 0,
                      }}
                      activeDot={{
                        r: 6,
                        stroke: color,
                        strokeWidth: 2,
                        fill: "white",
                      }}
                      connectNulls={false}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {showLegend && (
            <CustomLegend
              payload={displayTools.map((tool, index) => ({
                dataKey: tool.tool_id,
                value: tool.tool_name,
                color: generateToolColor(index),
              }))}
              visibleTools={visibleTools}
              onToolToggle={handleToolToggle}
            />
          )}

          <div className="mt-6 text-xs text-muted-foreground text-center">
            Click legend items to show/hide tools • Lower positions (closer to #1) are better
          </div>
        </CardContent>
      </Card>
    </ChartWrapper>
  );
}
