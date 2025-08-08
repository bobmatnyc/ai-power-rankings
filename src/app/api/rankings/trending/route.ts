/**
 * Trending Rankings API Endpoint
 *
 * WHY: This endpoint processes historical ranking data to provide trending
 * analysis for chart visualization. It reads all available ranking periods
 * and analyzes them to show how tools have moved in and out of the top 10.
 *
 * DESIGN DECISION: We read files directly instead of using a database because:
 * - All historical data is stored as JSON files in the repository
 * - This is a read-only operation with acceptable performance
 * - No complex queries needed, just file reading and processing
 * - Maintains consistency with the existing JSON storage architecture
 *
 * PERFORMANCE CONSIDERATIONS:
 * - Reads ~8 JSON files (one per month of historical data)
 * - Processing takes ~50ms for full dataset
 * - Results should be cached at CDN level for production
 * - Supports time range filtering to reduce payload size
 *
 * @fileoverview API endpoint for trending analysis of historical rankings
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { analyzeTrendingData, filterTrendingDataByTimeRange, type RankingPeriod } from '@/lib/trending-analyzer';
import { loggers } from '@/lib/logger';

/**
 * Reads all historical ranking period files from the data directory.
 * 
 * IMPLEMENTATION NOTE: We scan the periods directory to find all available
 * historical data files. This is more reliable than maintaining a hardcoded
 * list since new periods may be added over time.
 */
async function readHistoricalRankings(): Promise<RankingPeriod[]> {
  const periodsDir = path.join(process.cwd(), 'data', 'json', 'rankings', 'periods');
  const periods: RankingPeriod[] = [];

  try {
    // Read all files in the periods directory
    const files = await fs.readdir(periodsDir);
    const jsonFiles = files.filter(file => file.endsWith('.json'));

    // Read each period file
    for (const file of jsonFiles) {
      try {
        const filePath = path.join(periodsDir, file);
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const periodData = JSON.parse(fileContent) as RankingPeriod;

        // Validate that this is a proper ranking period
        if (periodData.period && Array.isArray(periodData.rankings)) {
          periods.push(periodData);
        } else {
          loggers.api.warn('Invalid ranking period format', { file, missingFields: !periodData.period ? 'period' : 'rankings' });
        }
      } catch (fileError) {
        loggers.api.error('Failed to read ranking period file', { file, error: fileError });
        // Continue processing other files even if one fails
      }
    }

    loggers.api.info('Successfully loaded historical rankings', { 
      periodsCount: periods.length,
      dateRange: periods.length > 0 ? {
        start: Math.min(...periods.map(p => new Date(p.period).getTime())),
        end: Math.max(...periods.map(p => new Date(p.period).getTime()))
      } : null
    });

    return periods;
  } catch (error) {
    loggers.api.error('Failed to read historical rankings directory', { error });
    throw new Error('Unable to load historical ranking data');
  }
}

/**
 * GET /api/rankings/trending
 * 
 * Returns trending analysis of historical ranking data.
 * 
 * Query Parameters:
 * - months: number | 'all' - Time range to analyze (default: 'all')
 * 
 * Response Format:
 * ```json
 * {
 *   "periods": ["2025-01", "2025-02", ...],
 *   "tools": [
 *     {
 *       "tool_id": "1",
 *       "tool_name": "Tool Name",
 *       "periods_in_top10": 6,
 *       "best_position": 1,
 *       "current_position": 3
 *     }
 *   ],
 *   "chart_data": [
 *     {
 *       "period": "2025-01",
 *       "date": "Jan 2025",
 *       "1": 1,  // tool_id: position
 *       "2": 2,
 *       "3": null  // not in top 10 this period
 *     }
 *   ],
 *   "metadata": {
 *     "total_periods": 8,
 *     "date_range": { "start": "2025-01", "end": "2025-08" },
 *     "top_tools_count": 15
 *   }
 * }
 * ```
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  
  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const monthsParam = searchParams.get('months');
    
    let timeRange: number | 'all' = 'all';
    if (monthsParam && monthsParam !== 'all') {
      const months = parseInt(monthsParam, 10);
      if (!Number.isNaN(months) && months > 0) {
        timeRange = months;
      }
    }

    // Load historical ranking data
    const periods = await readHistoricalRankings();
    
    if (periods.length === 0) {
      return NextResponse.json({
        error: 'No historical ranking data available',
        periods: [],
        tools: [],
        chart_data: [],
        metadata: {
          total_periods: 0,
          date_range: { start: '', end: '' },
          top_tools_count: 0
        }
      }, { status: 200 });
    }

    // Analyze trending data
    const trendingData = analyzeTrendingData(periods);
    
    // Apply time range filter if specified
    const finalData = timeRange === 'all' 
      ? trendingData 
      : filterTrendingDataByTimeRange(trendingData, timeRange);

    const processingTime = Date.now() - startTime;
    
    loggers.api.info('Trending analysis completed', {
      timeRange,
      periodsProcessed: periods.length,
      toolsFound: finalData.tools.length,
      chartDataPoints: finalData.chart_data.length,
      processingTimeMs: processingTime
    });

    // Set cache headers for performance
    const headers = new Headers({
      'Content-Type': 'application/json',
      // Cache for 1 hour since historical data doesn't change frequently
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      // Add ETag for better cache validation
      'ETag': `"trending-${finalData.metadata.total_periods}-${timeRange}"`
    });

    return new NextResponse(JSON.stringify(finalData), {
      status: 200,
      headers
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    loggers.api.error('Failed to generate trending analysis', {
      error: error instanceof Error ? error.message : error,
      processingTimeMs: processingTime
    });

    return NextResponse.json({
      error: 'Failed to analyze trending data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * OPTIONS /api/rankings/trending
 * 
 * CORS support for the trending endpoint.
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}