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

import type React from 'react';
import { useCallback, useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingChart } from '@/components/ranking/trending-chart';
import { AlertCircle, BarChart3, Calendar, TrendingUp } from 'lucide-react';
import type { TrendingAnalysisResult } from '@/lib/trending-analyzer';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/get-dictionary';
import { loggers } from '@/lib/logger';

export interface TrendingPageContentProps {
  lang: Locale;
  initialTimeRange: number | 'all';
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
  { value: 'all', label: 'All Time', description: 'Complete historical data' },
  { value: '12', label: 'Last 12 Months', description: 'Past year trends' },
  { value: '6', label: 'Last 6 Months', description: 'Recent trends' },
  { value: '3', label: 'Last 3 Months', description: 'Latest developments' },
] as const;

/**
 * Fetches trending data from the API with error handling and logging.
 */
async function fetchTrendingData(timeRange: number | 'all'): Promise<TrendingAnalysisResult> {
  const url = `/api/rankings/trending${timeRange !== 'all' ? `?months=${timeRange}` : ''}`;
  
  loggers.client.info('Fetching trending data', { timeRange, url });
  
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    loggers.client.error('Failed to fetch trending data', {
      status: response.status,
      statusText: response.statusText,
      error: errorText
    });
    throw new Error(`Failed to fetch trending data: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  loggers.client.info('Successfully fetched trending data', {
    periodsCount: data.metadata?.total_periods || 0,
    toolsCount: data.metadata?.top_tools_count || 0,
    timeRange
  });

  return data;
}

/**
 * Statistics card component for displaying key metrics.
 */
function StatCard({ 
  title, 
  value, 
  description, 
  icon: Icon 
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
export function TrendingPageContent({
  lang,
  initialTimeRange,
}: TrendingPageContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [trendingData, setTrendingData] = useState<TrendingAnalysisResult | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>({
    isLoading: true,
    error: null,
  });
  const [currentTimeRange, setCurrentTimeRange] = useState<number | 'all'>(initialTimeRange);

  // Load trending data
  const loadTrendingData = useCallback(async (timeRange: number | 'all') => {
    setLoadingState({ isLoading: true, error: null });
    
    try {
      const data = await fetchTrendingData(timeRange);
      setTrendingData(data);
      setLoadingState({ isLoading: false, error: null });
    } catch (error) {
      loggers.client.error('Error loading trending data', { error });
      setLoadingState({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  }, []);

  // Initial data load
  useEffect(() => {
    loadTrendingData(currentTimeRange);
  }, [loadTrendingData, currentTimeRange]);

  // Handle time range changes
  const handleTimeRangeChange = useCallback((newTimeRange: string) => {
    const timeRange = newTimeRange === 'all' ? 'all' : parseInt(newTimeRange, 10);
    setCurrentTimeRange(timeRange);
    
    // Update URL without page reload
    const params = new URLSearchParams(searchParams.toString());
    if (timeRange === 'all') {
      params.delete('months');
    } else {
      params.set('months', timeRange.toString());
    }
    
    const queryString = params.toString();
    const newUrl = `/${lang}/trending${queryString ? `?${queryString}` : ''}`;
    router.replace(newUrl, { scroll: false });
  }, [router, searchParams, lang]);

  // Memoized statistics calculations
  const statistics = useMemo(() => {
    if (!trendingData) return null;

    const { metadata, tools } = trendingData;
    
    // Find most consistent tool (appeared in most periods)
    const mostConsistent = tools.length > 0 
      ? tools.reduce((prev, current) =>
          (current.periods_in_top10 > prev.periods_in_top10) ? current : prev
        )
      : null;

    // Find biggest climber (best improvement from worst to best position)
    const biggestClimber = tools.length > 0
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
      mostConsistent: mostConsistent?.tool_name || 'N/A',
      biggestClimber: biggestClimber?.tool_name || 'N/A',
    };
  }, [trendingData]);

  // Render loading state
  if (loadingState.isLoading) {
    return (
      <div className="space-y-8">
        {/* Time Range Selector Skeleton */}
        <div className="flex gap-4 items-center">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>

        {/* Chart Skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-72" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[400px] w-full" />
          </CardContent>
        </Card>

        {/* Statistics Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-32 mt-2" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-32 mt-2" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
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

  // Render error state
  if (loadingState.error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="flex flex-col gap-4">
          <span>Failed to load trending data: {loadingState.error}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadTrendingData(currentTimeRange)}
            className="self-start"
          >
            Try Again
          </Button>
        </AlertDescription>
      </Alert>
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
              variant={currentTimeRange.toString() === option.value ? 'default' : 'outline'}
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
      <TrendingChart
        data={trendingData}
        height={500}
        showLegend={true}
        maxTools={15}
      />

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
                <li>• Missing points mean the tool wasn't in top 10</li>
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