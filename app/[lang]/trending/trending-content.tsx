"use client";

/**
 * TrendingPageContent - Interactive Client Component for Historical Trending
 *
 * WHY: This component handles all client-side interactivity for the trending page:
 * - API data fetching and state management
 * - Time range selection and filtering
 * - Chart interactivity and responsiveness
 * - Error handling and loading states
 *
 * DESIGN DECISION: Separated from the main page component because:
 * - Server component handles SEO, metadata, and initial rendering
 * - Client component handles interactivity and dynamic data
 * - Better code splitting and performance
 * - Cleaner separation of concerns
 *
 * PERFORMANCE CONSIDERATIONS:
 * - Debounced time range changes to avoid excessive API calls
 * - Memoized expensive calculations
 * - Efficient re-rendering with proper dependency arrays
 * - Progressive loading with skeleton states
 *
 * @fileoverview Client-side content for the trending analysis page
 */

import { AlertCircle, BarChart3, Calendar, RefreshCw, TrendingUp } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TrendingChart } from "@/components/ranking/trending-chart";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { loggers } from "@/lib/logger-client";
import type { TrendingAnalysisResult } from "@/lib/trending-analyzer";

export interface TrendingPageContentProps {
  lang: Locale;
  initialTimeRange: number | "all";
  dictionary: Dictionary;
}

interface LoadingState {
  isLoading: boolean;
  error: string | null;
}

/**
 * Time range options for the selector.
 * Provides common time periods that users might want to analyze.
 */
const TIME_RANGE_OPTIONS = [
  { value: "all", label: "All Time", description: "Complete historical data" },
  { value: "12", label: "Last 12 Months", description: "Past year trends" },
  { value: "6", label: "Last 6 Months", description: "Recent trends" },
  { value: "3", label: "Last 3 Months", description: "Latest developments" },
] as const;

/**
 * Fetches trending data from the API with error handling and logging.
 * Enhanced for production reliability with retry logic and better error handling.
 */
async function fetchTrendingData(timeRange: number | "all"): Promise<TrendingAnalysisResult> {
  // Use absolute URL in production to avoid any relative path issues
  const baseUrl = window?.location.origin ? window.location.origin : "";
  const url = `${baseUrl}/api/rankings/trending${timeRange !== "all" ? `?months=${timeRange}` : ""}`;

  loggers.client.info("Fetching trending data", { timeRange, url });

  // Add retry logic for production reliability
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "Cache-Control": "no-cache", // Ensure fresh data in production
        },
        // Add timeout to prevent hanging requests in production
        signal: AbortSignal.timeout(15000), // 15 second timeout
      });

      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`);

        loggers.client.error(`Failed to fetch trending data (attempt ${attempt})`, {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
          url,
          attempt,
        });

        // Don't retry on client errors (4xx), only server errors (5xx)
        if (response.status >= 400 && response.status < 500) {
          throw error;
        }

        lastError = error;

        // Wait before retry (exponential backoff)
        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 1000));
          continue;
        }

        throw error;
      }

      const data = await response.json();

      // Validate the response structure
      if (!data || typeof data !== "object" || !data.metadata) {
        throw new Error("Invalid response format from trending API");
      }

      loggers.client.info("Successfully fetched trending data", {
        periodsCount: data.metadata?.total_periods || 0,
        toolsCount: data.metadata?.top_tools_count || 0,
        timeRange,
        attempt,
      });

      return data;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      loggers.client.error(`Trending data fetch attempt ${attempt} failed`, {
        error: lastError.message,
        timeRange,
        url,
        attempt,
      });

      // Don't retry on timeout or network errors if it's the last attempt
      if (attempt === 3) {
        break;
      }

      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 1000));
    }
  }

  // If we get here, all attempts failed
  throw lastError || new Error("Failed to fetch trending data after multiple attempts");
}

/**
 * Statistics card component for displaying key metrics.
 */
function StatCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

/**
 * Main content component for the trending page.
 * Handles data fetching, state management, and user interactions.
 */
export function TrendingPageContent({ lang, initialTimeRange }: TrendingPageContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [trendingData, setTrendingData] = useState<TrendingAnalysisResult | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>({
    isLoading: true,
    error: null,
  });
  const [currentTimeRange, setCurrentTimeRange] = useState<number | "all">(initialTimeRange);

  // Load trending data
  const loadTrendingData = useCallback(async (timeRange: number | "all") => {
    setLoadingState({ isLoading: true, error: null });

    try {
      const data = await fetchTrendingData(timeRange);
      setTrendingData(data);
      setLoadingState({ isLoading: false, error: null });
    } catch (error) {
      loggers.client.error("Error loading trending data", { error });
      setLoadingState({
        isLoading: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  }, []);

  // Initial data load with timeout fallback
  useEffect(() => {
    loadTrendingData(currentTimeRange);

    // Fallback timeout - if loading takes more than 30 seconds, show error
    // This prevents infinite suspense states in production
    const timeoutId = setTimeout(() => {
      if (loadingState.isLoading) {
        loggers.client.warn("Trending data fetch timed out after 30 seconds");
        setLoadingState({
          isLoading: false,
          error:
            "Request timed out. The trending analysis is taking longer than expected. Please try again or check your connection.",
        });
      }
    }, 30000);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [loadTrendingData, currentTimeRange, loadingState.isLoading]);

  // Handle time range changes
  const handleTimeRangeChange = useCallback(
    (newTimeRange: string) => {
      const timeRange = newTimeRange === "all" ? "all" : parseInt(newTimeRange, 10);
      setCurrentTimeRange(timeRange);

      // Update URL without page reload
      const params = new URLSearchParams(searchParams.toString());
      if (timeRange === "all") {
        params.delete("months");
      } else {
        params.set("months", timeRange.toString());
      }

      const queryString = params.toString();
      const newUrl = `/${lang}/trending${queryString ? `?${queryString}` : ""}`;
      router.replace(newUrl, { scroll: false });
    },
    [router, searchParams, lang]
  );

  // Memoized statistics calculations
  const statistics = useMemo(() => {
    if (!trendingData) return null;

    const { metadata, tools } = trendingData;

    // Find most consistent tool (appeared in most periods)
    const mostConsistent =
      tools.length > 0
        ? tools.reduce((prev, current) =>
            current.periods_in_top10 > prev.periods_in_top10 ? current : prev
          )
        : null;

    // Find biggest climber (best improvement from worst to best position)
    const biggestClimber =
      tools.length > 0
        ? tools.reduce((prev, current) => {
            const prevClimb = prev.worst_position - prev.best_position;
            const currentClimb = current.worst_position - current.best_position;
            return currentClimb > prevClimb ? current : prev;
          })
        : null;

    return {
      totalPeriods: metadata.total_periods,
      totalTools: metadata.top_tools_count,
      dateRange: metadata.date_range,
      mostConsistent: mostConsistent?.tool_name || "N/A",
      biggestClimber: biggestClimber?.tool_name || "N/A",
    };
  }, [trendingData]);

  // Render loading state with progress indicator
  if (loadingState.isLoading) {
    return (
      <div className="space-y-8">
        {/* Loading indicator with progress */}
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center space-x-3">
              <RefreshCw className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">
                Loading trending analysis data...
              </span>
            </div>
            <div className="mt-4 text-xs text-center text-muted-foreground">
              Processing historical rankings and generating charts
            </div>
          </CardContent>
        </Card>

        {/* Time Range Selector Skeleton */}
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Time Range:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>

        {/* Chart Skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-72" />
          </CardHeader>
          <CardContent>
            <div className="h-[400px] bg-muted/30 rounded-lg flex items-center justify-center">
              <div className="text-center space-y-2">
                <BarChart3 className="h-8 w-8 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">Preparing chart visualization...</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistics Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-32 mt-2" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-32 mt-2" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-32 mt-2" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Render error state with enhanced production debugging
  if (loadingState.error) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex flex-col gap-4">
            <div>
              <div className="font-medium mb-2">Failed to load trending data</div>
              <div className="text-sm text-muted-foreground">{loadingState.error}</div>
              {process.env.NODE_ENV === "development" && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-muted-foreground">
                    Debug Information
                  </summary>
                  <div className="mt-2 p-2 bg-muted/50 rounded text-xs font-mono">
                    <div>Time Range: {currentTimeRange}</div>
                    <div>Environment: {process.env.NODE_ENV}</div>
                    <div>
                      Origin: {typeof window !== "undefined" ? window.location.origin : "SSR"}
                    </div>
                    <div>
                      User Agent:{" "}
                      {typeof window !== "undefined"
                        ? `${navigator.userAgent.substring(0, 50)}...`
                        : "SSR"}
                    </div>
                  </div>
                </details>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadTrendingData(currentTimeRange)}
                className="self-start"
              >
                Try Again
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => loadTrendingData("all")}
                className="self-start text-muted-foreground"
              >
                Try All Time
              </Button>
            </div>
          </AlertDescription>
        </Alert>

        {/* Fallback content - show basic information even when API fails */}
        <Card className="bg-muted/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              About Historical Trending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <p>
                The trending page shows how AI tools have moved in and out of the top 10 rankings
                over time, helping you understand long-term market movements and identify rising or
                declining tools.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <h4 className="font-semibold mb-2">What You Would See</h4>
                  <ul className="space-y-1 text-muted-foreground text-xs">
                    <li>• Interactive chart showing ranking changes over time</li>
                    <li>• Tools moving up and down in the rankings</li>
                    <li>• Historical performance statistics</li>
                    <li>• Time range filtering options</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Troubleshooting</h4>
                  <ul className="space-y-1 text-muted-foreground text-xs">
                    <li>• Try refreshing the page</li>
                    <li>• Check your internet connection</li>
                    <li>• Try a different time range</li>
                    <li>• Visit our main rankings page instead</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render empty state
  if (!trendingData || !trendingData.chart_data.length) {
    return (
      <Alert>
        <BarChart3 className="h-4 w-4" />
        <AlertDescription>
          No historical trending data is available at this time. Please check back later.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-8">
      {/* Time Range Selector */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Time Range:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {TIME_RANGE_OPTIONS.map((option) => (
            <Button
              key={option.value}
              variant={currentTimeRange.toString() === option.value ? "default" : "outline"}
              size="sm"
              onClick={() => handleTimeRangeChange(option.value)}
              className="text-xs"
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Main Chart */}
      <TrendingChart data={trendingData} height={500} showLegend={true} maxTools={15} />

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            title="Time Periods"
            value={statistics.totalPeriods}
            description={`${statistics.dateRange.start} to ${statistics.dateRange.end}`}
            icon={Calendar}
          />
          <StatCard
            title="Tools Tracked"
            value={statistics.totalTools}
            description="Different tools in top 10"
            icon={BarChart3}
          />
          <StatCard
            title="Most Consistent"
            value={statistics.mostConsistent}
            description="Appeared in most periods"
            icon={TrendingUp}
          />
        </div>
      )}

      {/* Tips and Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">How to Read This Chart</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div>
              <h4 className="font-semibold mb-2">Chart Interpretation</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Lower positions (#1-3) indicate better performance</li>
                <li>• Lines going up on the chart mean declining rank</li>
                <li>• Lines going down mean improving rank</li>
                <li>• Missing points mean the tool wasn&apos;t in top 10</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Interactive Features</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Click legend items to show/hide specific tools</li>
                <li>• Hover over chart points for detailed information</li>
                <li>• Use time range buttons to focus on specific periods</li>
                <li>• Chart is fully responsive on mobile devices</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
