/**
 * Web Worker for heavy data transformations.
 * 
 * WHY: Processing large datasets (rankings, tools, metrics) on the main thread
 * blocks user interactions and causes jank. Moving these operations to a
 * worker thread keeps the UI responsive.
 * 
 * CAPABILITIES:
 * - JSON parsing and transformation
 * - Data filtering and sorting
 * - Metric calculations and aggregations
 * - Ranking computations
 */

// Type definitions for data structures
interface Ranking {
  rank?: number;
  tool: string;
  scores: Record<string, number>;
  metrics?: Record<string, unknown>;
  previousRank?: number;
}

interface DataItem {
  [key: string]: unknown;
}

type WorkerMessage = 
  | { type: 'PARSE_JSON'; payload: { data: string; id: string } }
  | { type: 'TRANSFORM_RANKINGS'; payload: { rankings: Ranking[]; options: TransformOptions } }
  | { type: 'CALCULATE_METRICS'; payload: { data: DataItem[]; metrics: string[] } }
  | { type: 'FILTER_AND_SORT'; payload: { data: DataItem[]; filters: FilterOptions; sort: SortOptions } }
  | { type: 'AGGREGATE_DATA'; payload: { data: DataItem[]; groupBy: string; aggregations: AggregationOptions } };

interface TransformOptions {
  includeMetrics?: boolean;
  calculateChanges?: boolean;
  limit?: number;
}

interface FilterOptions {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'in';
  value: string | number | boolean | (string | number | boolean)[];
}

interface SortOptions {
  field: string;
  direction: 'asc' | 'desc';
}

interface AggregationOptions {
  [key: string]: 'sum' | 'avg' | 'min' | 'max' | 'count';
}

// Performance tracking for worker operations
const measurePerformance = <T>(name: string, fn: () => T): T => {
  const start = performance.now();
  const result = fn();
  const duration = performance.now() - start;
  
  // Log slow operations
  if (duration > 50) {
    console.warn(`Worker operation '${name}' took ${duration.toFixed(2)}ms`);
  }
  
  return result;
};

// Message handler
self.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
  const { type, payload } = event.data;
  
  try {
    switch (type) {
      case 'PARSE_JSON': {
        const result = measurePerformance('parse_json', () => {
          return JSON.parse(payload.data);
        });
        
        self.postMessage({
          type: 'PARSE_JSON_RESULT',
          payload: { data: result, id: payload.id },
          success: true
        });
        break;
      }
      
      case 'TRANSFORM_RANKINGS': {
        const result = measurePerformance('transform_rankings', () => {
          return transformRankings(payload.rankings, payload.options);
        });
        
        self.postMessage({
          type: 'TRANSFORM_RANKINGS_RESULT',
          payload: result,
          success: true
        });
        break;
      }
      
      case 'CALCULATE_METRICS': {
        const result = measurePerformance('calculate_metrics', () => {
          return calculateMetrics(payload.data, payload.metrics);
        });
        
        self.postMessage({
          type: 'CALCULATE_METRICS_RESULT',
          payload: result,
          success: true
        });
        break;
      }
      
      case 'FILTER_AND_SORT': {
        const result = measurePerformance('filter_and_sort', () => {
          const filtered = filterData(payload.data, payload.filters);
          return sortData(filtered, payload.sort);
        });
        
        self.postMessage({
          type: 'FILTER_AND_SORT_RESULT',
          payload: result,
          success: true
        });
        break;
      }
      
      case 'AGGREGATE_DATA': {
        const result = measurePerformance('aggregate_data', () => {
          return aggregateData(payload.data, payload.groupBy, payload.aggregations);
        });
        
        self.postMessage({
          type: 'AGGREGATE_DATA_RESULT',
          payload: result,
          success: true
        });
        break;
      }
      
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    self.postMessage({
      type: `${type}_ERROR`,
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false
    });
  }
});

/**
 * Transform rankings data with optimizations.
 */
function transformRankings(rankings: Ranking[], options: TransformOptions) {
  const { includeMetrics = true, calculateChanges = true, limit } = options;
  
  interface TransformedRanking extends Ranking {
    rankChange?: number;
    isImproving?: boolean;
  }
  
  let transformed = rankings.map((ranking, index): TransformedRanking => {
    const result: TransformedRanking = {
      rank: ranking.rank || index + 1,
      tool: ranking.tool,
      scores: ranking.scores
    };
    
    if (includeMetrics && ranking.metrics) {
      result.metrics = ranking.metrics;
    }
    
    if (calculateChanges && ranking.previousRank && result.rank) {
      result.rankChange = ranking.previousRank - result.rank;
      result.isImproving = result.rankChange > 0;
    }
    
    return result;
  });
  
  if (limit && limit > 0) {
    transformed = transformed.slice(0, limit);
  }
  
  return transformed;
}

/**
 * Calculate metrics for a dataset.
 */
function calculateMetrics(data: DataItem[], metricFields: string[]) {
  interface MetricStats {
    sum: number;
    avg: number;
    min: number;
    max: number;
    count: number;
  }
  
  interface MetricsResult {
    count: number;
    fields: Record<string, MetricStats>;
  }
  
  const metrics: MetricsResult = {
    count: data.length,
    fields: {}
  };
  
  for (const field of metricFields) {
    const values = data
      .map(item => getNestedValue(item, field))
      .filter((val): val is number => typeof val === 'number' && !Number.isNaN(val));
    
    if (values.length > 0) {
      metrics['fields'][field] = {
        sum: values.reduce((a, b) => a + b, 0),
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        count: values.length
      };
    }
  }
  
  return metrics;
}

/**
 * Filter data based on criteria.
 */
function filterData(data: DataItem[], filter: FilterOptions): DataItem[] {
  return data.filter(item => {
    const value = getNestedValue(item, filter.field);
    
    switch (filter.operator) {
      case 'eq':
        return value === filter.value;
      case 'neq':
        return value !== filter.value;
      case 'gt':
        return typeof value === 'number' && typeof filter.value === 'number' && value > filter.value;
      case 'lt':
        return typeof value === 'number' && typeof filter.value === 'number' && value < filter.value;
      case 'gte':
        return typeof value === 'number' && typeof filter.value === 'number' && value >= filter.value;
      case 'lte':
        return typeof value === 'number' && typeof filter.value === 'number' && value <= filter.value;
      case 'contains':
        return String(value).toLowerCase().includes(String(filter.value).toLowerCase());
      case 'in':
        return Array.isArray(filter.value) && filter.value.includes(value as string | number | boolean);
      default:
        return true;
    }
  });
}

/**
 * Sort data by field.
 */
function sortData(data: DataItem[], sort: SortOptions): DataItem[] {
  return [...data].sort((a, b) => {
    const aVal = getNestedValue(a, sort.field);
    const bVal = getNestedValue(b, sort.field);
    
    if (aVal === bVal) return 0;
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;
    
    // Convert to strings for comparison if not numbers
    const aStr = String(aVal);
    const bStr = String(bVal);
    
    const comparison = aStr < bStr ? -1 : 1;
    return sort.direction === 'asc' ? comparison : -comparison;
  });
}

/**
 * Aggregate data by grouping.
 */
function aggregateData(
  data: DataItem[], 
  groupBy: string, 
  aggregations: AggregationOptions
): Record<string, {
  count: number;
  values: Record<string, number>;
}> {
  const groups: Record<string, DataItem[]> = {};
  
  // Group data
  for (const item of data) {
    const key = String(getNestedValue(item, groupBy));
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
  }
  
  // Aggregate each group
  const results: Record<string, {
    count: number;
    values: Record<string, number>;
  }> = {};
  
  for (const [groupKey, groupData] of Object.entries(groups)) {
    results[groupKey] = {
      count: groupData.length,
      values: {}
    };
    
    for (const [field, operation] of Object.entries(aggregations)) {
      const values = groupData
        .map(item => getNestedValue(item, field))
        .filter((val): val is number => typeof val === 'number' && !Number.isNaN(val));
      
      if (values.length > 0) {
        switch (operation) {
          case 'sum':
            results[groupKey].values[field] = values.reduce((a, b) => a + b, 0);
            break;
          case 'avg':
            results[groupKey].values[field] = values.reduce((a, b) => a + b, 0) / values.length;
            break;
          case 'min':
            results[groupKey].values[field] = Math.min(...values);
            break;
          case 'max':
            results[groupKey].values[field] = Math.max(...values);
            break;
          case 'count':
            results[groupKey].values[field] = values.length;
            break;
        }
      }
    }
  }
  
  return results;
}

/**
 * Get nested value from object using dot notation.
 */
function getNestedValue(obj: DataItem, path: string): unknown {
  return path.split('.').reduce<unknown>((curr, prop) => {
    if (curr && typeof curr === 'object' && prop in curr) {
      return (curr as Record<string, unknown>)[prop];
    }
    return undefined;
  }, obj);
}

// Export for TypeScript
export default null;